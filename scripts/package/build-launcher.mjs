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
const releaseVersion = JSON.parse(await fs.readFile(path.join(rootDir, 'release', 'version.json'), 'utf8'))
const pocketbaseVersion = JSON.parse(await fs.readFile(path.join(rootDir, 'pocketbase', 'version.json'), 'utf8'))
const buildTime = new Date().toISOString()
const commit = process.env.GIT_COMMIT ?? ''

await fs.mkdir(outDir, { recursive: true })
await fs.mkdir(goCacheDir, { recursive: true })

await run(
  'go',
  [
    'build',
    '-ldflags',
    [
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildAppVersion=${releaseVersion.appVersion}`,
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildChannel=${releaseVersion.channel}`,
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildManifestURL=${releaseVersion.manifestUrl}`,
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildPocketBaseVersion=${pocketbaseVersion.version}`,
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildTime=${buildTime}`,
      `-X github.com/coder-virjay/fast-note/apps/launcher/internal/version.BuildCommit=${commit}`,
    ].join(' '),
    '-o',
    path.join(outDir, binaryName),
    './cmd/fastnote',
  ],
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
