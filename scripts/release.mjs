import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontendDistDir = join(rootDir, 'fastnote', 'dist')
const backendDir = join(rootDir, 'backend')
const releaseDir = join(rootDir, 'build', 'fastnote')
const binaryName = process.platform === 'win32' ? 'fastnote.exe' : 'fastnote'
const binaryPath = join(releaseDir, binaryName)
const dataDir = join(releaseDir, 'pb_data')
const goCacheDir = join(rootDir, '.tmp', 'go-build-cache')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

run('npm', ['--prefix', 'fastnote', 'run', 'build'], { cwd: rootDir })
run('node', ['scripts/sync-web-assets.mjs'], { cwd: rootDir })

if (!existsSync(frontendDistDir)) {
	console.error(`[release] frontend dist not found: ${frontendDistDir}`)
	process.exit(1)
}

rmSync(releaseDir, { recursive: true, force: true })
mkdirSync(releaseDir, { recursive: true })
mkdirSync(goCacheDir, { recursive: true })

run('go', ['build', '-o', binaryPath, '.'], {
  cwd: backendDir,
  env: {
    ...process.env,
    GOCACHE: goCacheDir,
  },
})
mkdirSync(dataDir, { recursive: true })
writeFileSync(
  join(releaseDir, 'README.md'),
  [
    '# fastnote Release',
    '',
    `- Binary: ./${binaryName}`,
    '- Embedded static assets: built into the binary',
    '- Runtime data: ./pb_data',
    '- Optional static override: set FASTNOTE_WEB_DIST or place files in ./pb_public',
    '',
    'Run the application from this directory:',
    '',
    process.platform === 'win32' ? `  .\\${binaryName} serve` : '  ./fastnote serve',
    '',
  ].join('\n'),
)

console.log(`[release] binary: ${binaryPath}`)
console.log('[release] static assets: embedded in binary')
console.log(`[release] runtime data dir: ${dataDir}`)
