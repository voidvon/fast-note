import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const frontendDistDir = join(rootDir, 'fastnote', 'dist')
const backendDir = join(rootDir, 'backend')
const goCacheDir = join(rootDir, '.tmp', 'go-build-cache')
const defaultOutputDir = join(rootDir, 'build', 'releases')

const supportedTargets = [
  {
    id: 'darwin-amd64',
    goos: 'darwin',
    goarch: 'amd64',
    packageSuffix: 'darwin_amd64',
    binaryName: 'fastnote',
    aliases: ['darwin-amd', 'macos-amd64', 'macos-amd', 'mac-amd64', 'mac-amd'],
  },
  {
    id: 'darwin-arm64',
    goos: 'darwin',
    goarch: 'arm64',
    packageSuffix: 'darwin_arm64',
    binaryName: 'fastnote',
    aliases: ['darwin-arm', 'macos-arm64', 'macos-arm', 'mac-arm64', 'mac-arm'],
  },
  {
    id: 'linux-amd64',
    goos: 'linux',
    goarch: 'amd64',
    packageSuffix: 'linux_amd64',
    binaryName: 'fastnote',
    aliases: ['linux-amd'],
  },
  {
    id: 'linux-arm64',
    goos: 'linux',
    goarch: 'arm64',
    packageSuffix: 'linux_arm64',
    binaryName: 'fastnote',
    aliases: ['linux-arm64-v8'],
  },
  {
    id: 'linux-armv7',
    goos: 'linux',
    goarch: 'arm',
    goarm: '7',
    packageSuffix: 'linux_armv7',
    binaryName: 'fastnote',
    aliases: ['linux-arm', 'linux-arm32', 'linux-armhf'],
  },
  {
    id: 'linux-ppc64le',
    goos: 'linux',
    goarch: 'ppc64le',
    packageSuffix: 'linux_ppc64le',
    binaryName: 'fastnote',
    aliases: [],
  },
  {
    id: 'linux-s390x',
    goos: 'linux',
    goarch: 's390x',
    packageSuffix: 'linux_s390x',
    binaryName: 'fastnote',
    aliases: [],
  },
  {
    id: 'windows-amd64',
    goos: 'windows',
    goarch: 'amd64',
    packageSuffix: 'windows_amd64',
    binaryName: 'fastnote.exe',
    aliases: ['windows-amd', 'win-amd64', 'win-amd'],
  },
  {
    id: 'windows-arm64',
    goos: 'windows',
    goarch: 'arm64',
    packageSuffix: 'windows_arm64',
    binaryName: 'fastnote.exe',
    aliases: ['windows-arm', 'win-arm64', 'win-arm'],
  },
]

const supportedTargetIds = new Set(
  supportedTargets.flatMap(target => [target.id, ...target.aliases]),
)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    console.error(`[release] failed to run ${command}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runQuiet(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
    ...options,
  })

  return result.status === 0
}

function printHelp() {
  console.log(`Usage: node scripts/release.mjs [options]

Options:
  --version <value>        Set the release version used in output names. Default: dev
  --target <value>         Build a single target. Can be repeated.
  --targets <a,b,c>        Build a comma-separated list of targets.
  --current                Build only the current host target.
  --local                  Alias of --current.
  --output-dir <path>      Override output directory. Default: build/releases
  --skip-frontend-build    Reuse the existing frontend dist output.
  --no-archive             Skip zip archive generation and keep unpacked folders only.
  --list-targets           Print supported targets and exit.
  --help                   Print this help message.

Supported targets:
  ${supportedTargets.map(target => target.id).join('\n  ')}
`)
}

function normalizeTargetToken(token) {
  if (!token) {
    return null
  }

  const normalized = token.trim().toLowerCase()

  if (!normalized) {
    return null
  }

  if (normalized === 'all') {
    return 'all'
  }

  const matchedTarget = supportedTargets.find(target =>
    target.id === normalized || target.aliases.includes(normalized),
  )

  return matchedTarget?.id ?? null
}

function parseArgs(argv) {
  const options = {
    version: 'dev',
    outputDir: defaultOutputDir,
    skipFrontendBuild: false,
    archive: true,
    targetTokens: [],
    useCurrentTargetOnly: false,
    showHelp: false,
    listTargets: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true
      continue
    }

    if (arg === '--list-targets') {
      options.listTargets = true
      continue
    }

    if (arg === '--skip-frontend-build') {
      options.skipFrontendBuild = true
      continue
    }

    if (arg === '--no-archive') {
      options.archive = false
      continue
    }

    if (arg === '--current' || arg === '--local') {
      options.useCurrentTargetOnly = true
      continue
    }

    if (arg === '--version') {
      options.version = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg.startsWith('--version=')) {
      options.version = arg.slice('--version='.length)
      continue
    }

    if (arg === '--output-dir') {
      options.outputDir = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length)
      continue
    }

    if (arg === '--target') {
      options.targetTokens.push(argv[index + 1] ?? '')
      index += 1
      continue
    }

    if (arg.startsWith('--target=')) {
      options.targetTokens.push(arg.slice('--target='.length))
      continue
    }

    if (arg === '--targets') {
      options.targetTokens.push(argv[index + 1] ?? '')
      index += 1
      continue
    }

    if (arg.startsWith('--targets=')) {
      options.targetTokens.push(arg.slice('--targets='.length))
      continue
    }

    console.error(`[release] unknown argument: ${arg}`)
    process.exit(1)
  }

  if (!options.version.trim()) {
    console.error('[release] --version must not be empty')
    process.exit(1)
  }

  if (!options.outputDir.trim()) {
    console.error('[release] --output-dir must not be empty')
    process.exit(1)
  }

  return {
    ...options,
    version: options.version.trim(),
    outputDir: resolve(rootDir, options.outputDir.trim()),
  }
}

function resolveCurrentTarget() {
  const arch = process.arch
  const platform = process.platform

  if (platform === 'darwin' && arch === 'x64') {
    return 'darwin-amd64'
  }

  if (platform === 'darwin' && arch === 'arm64') {
    return 'darwin-arm64'
  }

  if (platform === 'linux' && arch === 'x64') {
    return 'linux-amd64'
  }

  if (platform === 'linux' && arch === 'arm64') {
    return 'linux-arm64'
  }

  if (platform === 'linux' && arch === 'arm') {
    return 'linux-armv7'
  }

  if (platform === 'linux' && arch === 'ppc64') {
    return 'linux-ppc64le'
  }

  if (platform === 'linux' && arch === 's390x') {
    return 'linux-s390x'
  }

  if (platform === 'win32' && arch === 'x64') {
    return 'windows-amd64'
  }

  if (platform === 'win32' && arch === 'arm64') {
    return 'windows-arm64'
  }

  return null
}

function resolveTargets(options) {
  if (options.useCurrentTargetOnly) {
    const currentTarget = resolveCurrentTarget()

    if (!currentTarget) {
      console.error(
        `[release] current host target is unsupported: ${process.platform}/${process.arch}`,
      )
      process.exit(1)
    }

    return supportedTargets.filter(target => target.id === currentTarget)
  }

  if (options.targetTokens.length === 0) {
    return [...supportedTargets]
  }

  const requested = new Set()

  for (const tokenGroup of options.targetTokens) {
    for (const rawToken of tokenGroup.split(',')) {
      const normalizedToken = normalizeTargetToken(rawToken)

      if (!normalizedToken) {
        const trimmedToken = rawToken.trim()
        if (!trimmedToken) {
          continue
        }

        console.error(
          `[release] unsupported target "${trimmedToken}". Supported values: ${[
            ...supportedTargetIds,
          ].join(', ')}`,
        )
        process.exit(1)
      }

      if (normalizedToken === 'all') {
        return [...supportedTargets]
      }

      requested.add(normalizedToken)
    }
  }

  return supportedTargets.filter(target => requested.has(target.id))
}

function createReleaseReadme({ releaseVersion, target, binaryName }) {
  const command = target.goos === 'windows' ? `.\\${binaryName} serve` : `./${binaryName} serve`

  return [
    '# fastnote Release',
    '',
    `- Version: ${releaseVersion}`,
    `- Target: ${target.id}`,
    `- Binary: ./${binaryName}`,
    '- Embedded static assets: built into the binary',
    '- Runtime data: ./pb_data',
    '- Optional static override: set FASTNOTE_WEB_DIST or place files in ./pb_public',
    '',
    'Run the application from this directory:',
    '',
    `  ${command}`,
    '',
  ].join('\n')
}

function ensureFrontendBuild(skipFrontendBuild) {
  if (!skipFrontendBuild) {
    run('npm', ['--prefix', 'fastnote', 'run', 'build'], { cwd: rootDir })
    run('node', ['scripts/sync-web-assets.mjs'], { cwd: rootDir })
  }

  if (!existsSync(frontendDistDir)) {
    console.error(`[release] frontend dist not found: ${frontendDistDir}`)
    process.exit(1)
  }
}

function buildRelease(options) {
  const targets = resolveTargets(options)
  const archiveEnabled = options.archive
  const zipAvailable = archiveEnabled && runQuiet('zip', ['-v'])
  const manifest = []

  ensureFrontendBuild(options.skipFrontendBuild)
  mkdirSync(goCacheDir, { recursive: true })
  rmSync(options.outputDir, { recursive: true, force: true })
  mkdirSync(options.outputDir, { recursive: true })

  if (archiveEnabled && !zipAvailable) {
    console.warn('[release] zip command not found, archives will be skipped')
  }

  console.log(
    `[release] building ${targets.length} target(s): ${targets
      .map(target => target.id)
      .join(', ')}`,
  )

  for (const target of targets) {
    const packageBaseName = `fastnote_${options.version}_${target.packageSuffix}`
    const targetDir = join(options.outputDir, packageBaseName)
    const binaryPath = join(targetDir, target.binaryName)
    const dataDir = join(targetDir, 'pb_data')
    const archivePath = `${targetDir}.zip`

    rmSync(targetDir, { recursive: true, force: true })
    rmSync(archivePath, { force: true })
    mkdirSync(targetDir, { recursive: true })
    mkdirSync(dataDir, { recursive: true })

    writeFileSync(join(dataDir, '.gitkeep'), '')

    console.log(`[release] go build => ${target.id}`)
    run('go', ['build', '-trimpath', '-o', binaryPath, '.'], {
      cwd: backendDir,
      env: {
        ...process.env,
        GOCACHE: goCacheDir,
        CGO_ENABLED: '0',
        GOOS: target.goos,
        GOARCH: target.goarch,
        ...(target.goarm ? { GOARM: target.goarm } : {}),
      },
    })

    writeFileSync(
      join(targetDir, 'README.md'),
      createReleaseReadme({
        releaseVersion: options.version,
        target,
        binaryName: target.binaryName,
      }),
    )

    let archived = false

    if (archiveEnabled && zipAvailable) {
      run('zip', ['-q', '-r', archivePath, packageBaseName], {
        cwd: options.outputDir,
      })
      archived = true
    }

    manifest.push({
      id: target.id,
      goos: target.goos,
      goarch: target.goarch,
      goarm: target.goarm ?? null,
      directory: targetDir,
      archive: archived ? archivePath : null,
      binary: binaryPath,
    })
  }

  writeFileSync(
    join(options.outputDir, 'manifest.json'),
    `${JSON.stringify(
      {
        version: options.version,
        generatedAt: new Date().toISOString(),
        targets: manifest,
      },
      null,
      2,
    )}\n`,
  )

  console.log(`[release] output dir: ${options.outputDir}`)

  for (const entry of manifest) {
    console.log(`[release] ${entry.id} dir: ${entry.directory}`)
    if (entry.archive) {
      console.log(`[release] ${entry.id} zip: ${entry.archive}`)
    }
  }
}

const options = parseArgs(process.argv.slice(2))

if (options.showHelp) {
  printHelp()
  process.exit(0)
}

if (options.listTargets) {
  for (const target of supportedTargets) {
    console.log(target.id)
  }
  process.exit(0)
}

buildRelease(options)
