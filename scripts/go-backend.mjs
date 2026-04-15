import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = resolve(rootDir, 'backend')
const goCacheDir = resolve(rootDir, '.tmp', 'go-build-cache')

mkdirSync(goCacheDir, { recursive: true })

const result = spawnSync('go', process.argv.slice(2), {
  cwd: backendDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    GOCACHE: goCacheDir,
  },
})

process.exit(result.status ?? 1)
