import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const releaseRoot = path.join(rootDir, 'build', 'FastNote')
const updatesRoot = path.join(rootDir, 'build', 'updates')
const versionFile = path.join(releaseRoot, 'version.json')

await ensureExists(releaseRoot, 'release directory')
await ensureExists(versionFile, 'release version metadata')

const version = JSON.parse(await fs.readFile(versionFile, 'utf8'))
const targetKey = version.platform || `${os.platform()}-${os.arch()}`
const extension = os.platform() === 'win32' ? 'zip' : 'tar.gz'
const artifactFileName = `FastNote-${version.appVersion}-${targetKey}.${extension}`
const artifactPath = path.join(updatesRoot, artifactFileName)
const manifestPath = path.join(updatesRoot, 'latest.json')
const versionedManifestPath = path.join(updatesRoot, `manifest-${version.appVersion}-${targetKey}.json`)
const releaseAssetBaseUrl = process.env.FASTNOTE_RELEASE_ASSET_BASE_URL || ''
const releaseNotesUrl = process.env.FASTNOTE_RELEASE_NOTES_URL || ''

await fs.rm(updatesRoot, { recursive: true, force: true })
await fs.mkdir(updatesRoot, { recursive: true })

if (os.platform() === 'win32')
  await packZip(releaseRoot, artifactPath)
else
  await packTarGz(releaseRoot, artifactPath)

const checksum = await sha256(artifactPath)
const stats = await fs.stat(artifactPath)
const artifactURL = releaseAssetBaseUrl
  ? `${releaseAssetBaseUrl.replace(/\/$/, '')}/${artifactFileName}`
  : pathToFileURL(artifactPath).href

const manifest = {
  schemaVersion: 1,
  channel: version.channel || 'stable',
  generatedAt: new Date().toISOString(),
  latest: {
    version: version.appVersion,
    publishedAt: version.builtAt || new Date().toISOString(),
    notes: releaseNotesUrl,
    minSupportedVersion: version.appVersion,
  },
  artifacts: {
    [targetKey]: {
      url: artifactURL,
      sha256: checksum,
      fileName: artifactFileName,
      sizeBytes: stats.size,
    },
  },
}

await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')
await fs.writeFile(versionedManifestPath, JSON.stringify(manifest, null, 2), 'utf8')

console.log(JSON.stringify({
  manifestPath,
  versionedManifestPath,
  artifactPath,
  artifactURL,
  checksum,
}))

async function ensureExists(filePath, label) {
  try {
    await fs.access(filePath)
  }
  catch {
    throw new Error(`missing ${label}: ${filePath}`)
  }
}

async function sha256(filePath) {
  const hash = createHash('sha256')

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })

  return hash.digest('hex')
}

function packTarGz(sourceDir, archivePath) {
  const parentDir = path.dirname(sourceDir)
  const directoryName = path.basename(sourceDir)

  return run('tar', ['-czf', archivePath, '-C', parentDir, directoryName], rootDir)
}

function packZip(sourceDir, archivePath) {
  return run(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${archivePath}" -Force`,
    ],
    rootDir,
  )
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: process.env,
    })

    child.on('exit', (code) => {
      if (code === 0)
        resolve()
      else
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
