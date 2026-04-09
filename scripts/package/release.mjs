import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { getTargetConfig, resolveTargetKey } from './target.mjs'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const releaseVersion = JSON.parse(await fs.readFile(path.join(rootDir, 'release', 'version.json'), 'utf8'))
const configuredTargets = Array.isArray(releaseVersion.releaseTargets) ? releaseVersion.releaseTargets.join(',') : ''
const targetKeys = (process.env.FASTNOTE_RELEASE_TARGETS || configuredTargets || resolveTargetKey())
  .split(',')
  .map(targetKey => targetKey.trim())
  .filter(Boolean)

for (const targetKey of targetKeys)
  getTargetConfig(targetKey)

await run('node', ['scripts/package/build-web.mjs'], rootDir)
for (const targetKey of targetKeys) {
  const env = {
    ...process.env,
    FASTNOTE_TARGET_PLATFORM: targetKey,
  }
  await run('node', ['scripts/package/build-launcher.mjs'], rootDir, env)
  await run('node', ['scripts/package/fetch-pocketbase.mjs'], rootDir, env)
  await run('node', ['scripts/package/assemble-release.mjs'], rootDir, env)
  await run('node', ['scripts/package/build-manifest.mjs'], rootDir, env)
}

function run(command, args, cwd, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      env,
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
