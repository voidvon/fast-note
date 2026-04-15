import type { Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

export function injectVersion(): Plugin {
  return {
    name: 'inject-version',
    closeBundle() {
      // Get current UTC time
      const nowUtc = new Date()
      // Calculate UTC+8 time
      const now = new Date(nowUtc.getTime() + 8 * 60 * 60 * 1000)

      // Extract components based on UTC+8 time
      const month = (now.getUTCMonth() + 1).toString().padStart(2, '0')
      const day = now.getUTCDate().toString().padStart(2, '0')
      const hours = now.getUTCHours().toString().padStart(2, '0')
      const minutes = now.getUTCMinutes().toString().padStart(2, '0')
      const version = `${month}${day}${hours}${minutes}`

      const indexPath = path.resolve(__dirname, 'dist/index.html')
      try {
        let indexContent = fs.readFileSync(indexPath, 'utf-8')
        indexContent = indexContent.replace('##version##', version)
        // Ensure the script tag with the version is present if the placeholder wasn't found initially
        // This handles cases where the initial build might not have the placeholder script
        if (!indexContent.includes(`window.version = '${version}'`)) {
          // Find the closing </head> tag and insert the script before it
          const headEndTag = '</head>'
          const scriptTag = `  <script>\n      window.threshold = window.innerWidth;\n      window.version = '${version}';\n    </script>\n`
          if (indexContent.includes(headEndTag)) {
            indexContent = indexContent.replace(headEndTag, `${scriptTag}${headEndTag}`)
          }
          else {
            // Fallback: append to body if head tag is missing (unlikely)
            indexContent = indexContent.replace('</body>', `${scriptTag}</body>`)
          }
        }
        fs.writeFileSync(indexPath, indexContent, 'utf-8')
        console.warn(`Version ${version} injected into ${indexPath}`)
      }
      catch (error) {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
          console.warn(`Warning: ${indexPath} not found. Skipping version injection. Run 'npm run build' first.`)
        }
        else {
          console.error('Error injecting version:', error)
        }
      }
    },
  }
}
