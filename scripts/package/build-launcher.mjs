import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const launcherDir = path.join(rootDir, 'apps', 'launcher')
const outDir = path.join(rootDir, '.tmp', 'launcher')
const goCacheDir = path.join(rootDir, '.tmp', 'go-build-cache')
const binaryName = os.platform() === 'win32' ? 'fastnote.exe' : 'fastnote'

await fs.mkdir(outDir, { recursive: true })
await fs.mkdir(goCacheDir, { recursive: true })

await run(
  'go',
  ['build', '-o', path.join(outDir, binaryName), './cmd/fastnote'],
  launcherDir,
  {
    GOCACHE: goCacheDir,
  },
)

function run(command, args, cwd, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
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
