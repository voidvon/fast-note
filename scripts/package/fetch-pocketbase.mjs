import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const configPath = path.join(rootDir, 'pocketbase', 'version.json')
const cacheDir = path.join(rootDir, '.tmp', 'pocketbase')
const config = JSON.parse(await fs.readFile(configPath, 'utf8'))
const targetKey = `${os.platform()}-${os.arch()}`
const asset = config.assets[targetKey]

if (!asset)
  throw new Error(`unsupported platform target: ${targetKey}`)

if (!asset.sha256)
  throw new Error(`missing sha256 for target ${targetKey} in pocketbase/version.json`)

await fs.mkdir(cacheDir, { recursive: true })

const archivePath = path.join(cacheDir, asset.filename)
const extractDir = path.join(cacheDir, `${config.version}-${targetKey}`)
const downloadUrl = `${config.baseUrl}/v${config.version}/${asset.filename}`

if (!(await exists(archivePath)))
  await run('curl', ['-L', downloadUrl, '-o', archivePath], rootDir)

const sha256 = await checksum(archivePath)
if (sha256 !== asset.sha256)
  throw new Error(`sha256 mismatch for ${asset.filename}: expected ${asset.sha256} got ${sha256}`)

await fs.rm(extractDir, { recursive: true, force: true })
await fs.mkdir(extractDir, { recursive: true })

if (os.platform() === 'win32')
  await run('powershell', ['-NoProfile', '-Command', `Expand-Archive -Path "${archivePath}" -DestinationPath "${extractDir}" -Force`], rootDir)
else
  await run('unzip', ['-oq', archivePath, '-d', extractDir], rootDir)

console.log(JSON.stringify({
  version: config.version,
  targetKey,
  archivePath,
  extractDir,
}))

async function checksum(filePath) {
  const hash = createHash('sha256')

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', resolve)
    stream.on('error', reject)
  })

  return hash.digest('hex')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
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
