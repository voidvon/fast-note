import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveTargetKey } from './target.mjs'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))
const targetKeys = (process.env.FASTNOTE_RELEASE_TARGETS || resolveTargetKey())
  .split(',')
  .map(targetKey => targetKey.trim())
  .filter(Boolean)

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
