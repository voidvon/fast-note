import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontendDistDir = join(rootDir, 'fastnote', 'dist')
const embeddedAssetsDir = join(rootDir, 'backend', 'internal', 'server', 'bootstrap', 'pb_public')

if (!existsSync(frontendDistDir)) {
  if (existsSync(embeddedAssetsDir)) {
    console.warn(`[sync-web-assets] frontend dist not found, keep current embedded assets: ${embeddedAssetsDir}`)
    process.exit(0)
  }

  console.error(`[sync-web-assets] frontend dist not found: ${frontendDistDir}`)
  console.error('[sync-web-assets] run `npm --prefix fastnote run build` first')
  process.exit(1)
}

rmSync(embeddedAssetsDir, { recursive: true, force: true })
mkdirSync(embeddedAssetsDir, { recursive: true })
cpSync(frontendDistDir, embeddedAssetsDir, { recursive: true })
writeFileSync(join(embeddedAssetsDir, '.keep'), '')

console.log(`[sync-web-assets] embedded assets updated: ${embeddedAssetsDir}`)
