import { spawn } from 'node:child_process'
import process from 'node:process'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const children = []
let shuttingDown = false
const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const backendDir = resolve(rootDir, 'backend')
const goCacheDir = resolve(rootDir, '.tmp', 'go-build-cache')

mkdirSync(goCacheDir, { recursive: true })

function start(name, command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options,
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.error(`[dev] ${name} exited with ${reason}`)
    shutdown(code ?? 1)
  })

  children.push(child)
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM')
    }
  }

  setTimeout(() => process.exit(exitCode), 100)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

start('frontend', 'npm', ['--prefix', 'fastnote', 'run', 'dev'], {
  cwd: rootDir,
})
start('backend', 'go', ['run', '.', 'serve'], {
  cwd: backendDir,
  env: {
    ...process.env,
    GOCACHE: goCacheDir,
  },
})
