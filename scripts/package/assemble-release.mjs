import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTargetConfig, PACKAGE_NAME } from './target.mjs'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const target = getTargetConfig()
const releaseRoot = path.join(rootDir, 'build', 'release', target.targetKey, PACKAGE_NAME)
const tempDir = path.join(rootDir, '.tmp')
const webDist = path.join(rootDir, 'apps', 'web', 'dist')
const launcherBinary = path.join(tempDir, 'launcher', target.targetKey, target.binaryName)
const versionConfig = JSON.parse(await fs.readFile(path.join(rootDir, 'pocketbase', 'version.json'), 'utf8'))
const appVersionConfig = JSON.parse(await fs.readFile(path.join(rootDir, 'release', 'version.json'), 'utf8'))
const pocketbaseExtractDir = path.join(tempDir, 'pocketbase', `${versionConfig.version}-${target.targetKey}`)
const pocketbaseBinaryPath = path.join(pocketbaseExtractDir, target.pocketbaseBinaryName)

await fs.rm(releaseRoot, { recursive: true, force: true })
await fs.mkdir(path.join(releaseRoot, 'backend'), { recursive: true })
await fs.mkdir(path.join(releaseRoot, 'data'), { recursive: true })
await fs.mkdir(path.join(releaseRoot, 'logs'), { recursive: true })

await ensureExists(webDist, 'web build output')
await ensureExists(launcherBinary, 'launcher binary')
await ensureExists(pocketbaseBinaryPath, 'PocketBase binary')

await fs.copyFile(launcherBinary, path.join(releaseRoot, path.basename(launcherBinary)))
await fs.copyFile(pocketbaseBinaryPath, path.join(releaseRoot, 'backend', target.pocketbaseBinaryName))
await fs.writeFile(
  path.join(releaseRoot, 'version.json'),
  JSON.stringify(
    {
      ...appVersionConfig,
      pocketBaseVersion: versionConfig.version,
      builtAt: new Date().toISOString(),
      platform: target.targetKey,
    },
    null,
    2,
  ),
  'utf8',
)
await fs.chmod(path.join(releaseRoot, path.basename(launcherBinary)), 0o755).catch(() => {})
await fs.chmod(path.join(releaseRoot, 'backend', target.pocketbaseBinaryName), 0o755).catch(() => {})

await copyDir(path.join(rootDir, 'pocketbase', 'pb_hooks'), path.join(releaseRoot, 'backend', 'pb_hooks'))
await copyDir(path.join(rootDir, 'pocketbase', 'pb_migrations'), path.join(releaseRoot, 'backend', 'pb_migrations'))
await copyDir(webDist, path.join(releaseRoot, 'backend', 'pb_public'))

const readme = `# FastNote

## Layout

- \`fastnote\`: launcher entrypoint
- \`backend/\`: PocketBase runtime and static assets
- \`version.json\`: app version metadata for launcher commands
- \`data/\`: PocketBase data directory
- \`logs/\`: launcher and PocketBase logs

## Start

\`\`\`bash
./${path.basename(launcherBinary)}
\`\`\`

## Notes

- Keep \`data/\` and \`logs/\` when upgrading.
- Replace \`fastnote\` and \`backend/\` when publishing a new version.
`

await fs.writeFile(path.join(releaseRoot, 'README.md'), readme, 'utf8')

async function ensureExists(filePath, label) {
  try {
    await fs.access(filePath)
  }
  catch {
    throw new Error(`missing ${label}: ${filePath}`)
  }
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true })
  await fs.cp(from, to, { recursive: true })
}
