import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(fileURLToPath(new URL('../..', import.meta.url)))

await run('node', ['scripts/package/build-web.mjs'], rootDir)
await run('node', ['scripts/package/build-launcher.mjs'], rootDir)
await run('node', ['scripts/package/fetch-pocketbase.mjs'], rootDir)
await run('node', ['scripts/package/assemble-release.mjs'], rootDir)
await run('node', ['scripts/package/build-manifest.mjs'], rootDir)

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
