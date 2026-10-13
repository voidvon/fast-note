import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  findLatestReleaseVersion,
  getNextVersion,
  parseVersion,
} from './release-version.mjs'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutputDir = join(rootDir, 'build', 'releases')

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    console.error(`[release] failed to execute ${command}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }

  return result
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
    ...options,
  })

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ? result.stdout.trim() : '',
    stderr: result.stderr ? result.stderr.trim() : '',
  }
}

function printHelp() {
  console.log(`Usage: make release [ARGS="options"]
   or: node scripts/release-github.mjs [options]

Options:
  --version <value>        Explicitly specify the release version (e.g. v0.1.19).
                           If omitted, automatically bumped from the latest git tag.
  --dry-run                Simulate the release without building, tagging, or publishing.
  --target <value>         Build a single target (e.g. darwin-arm64, linux-amd64).
  --targets <a,b,c>        Build a comma-separated list of targets.
  --output-dir <path>      Override release output directory (default: build/releases).
  --notes <text>           Release notes content.
  --notes-file <path>      Path to release notes file.
  --draft                  Publish as a draft release.
  --prerelease             Mark the release as a prerelease.
  --allow-dirty            Allow releasing with uncommitted git changes.
  --skip-build             Skip building release packages (reuse existing build/releases).
  --skip-git-tag           Skip creating and pushing git tag (if already created).
  --help, -h               Print this help message.

Version Bump Rules:
  - Patch increments by +1 (e.g. 0.1.0 -> 0.1.1).
  - After .20, patch rolls over to next minor (0.1.20 -> 0.2.0).
  - After .20.20, rolls over to next major (0.20.20 -> 1.0.0).
`)
}

function parseArgs(argv) {
  const options = {
    version: '',
    dryRun: false,
    outputDir: defaultOutputDir,
    targetTokens: [],
    notes: '',
    notesFile: '',
    draft: false,
    prerelease: false,
    allowDirty: false,
    skipBuild: false,
    skipGitTag: false,
    showHelp: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true
      continue
    }

    if (arg === '--dry-run') {
      options.dryRun = true
      continue
    }

    if (arg === '--draft') {
      options.draft = true
      continue
    }

    if (arg === '--prerelease') {
      options.prerelease = true
      continue
    }

    if (arg === '--allow-dirty') {
      options.allowDirty = true
      continue
    }

    if (arg === '--skip-build') {
      options.skipBuild = true
      continue
    }

    if (arg === '--skip-git-tag') {
      options.skipGitTag = true
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

    if (arg === '--output-dir') {
      options.outputDir = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg.startsWith('--output-dir=')) {
      options.outputDir = arg.slice('--output-dir='.length)
      continue
    }

    if (arg === '--notes') {
      options.notes = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg.startsWith('--notes=')) {
      options.notes = arg.slice('--notes='.length)
      continue
    }

    if (arg === '--notes-file') {
      options.notesFile = argv[index + 1] ?? ''
      index += 1
      continue
    }

    if (arg.startsWith('--notes-file=')) {
      options.notesFile = arg.slice('--notes-file='.length)
      continue
    }

    console.error(`[release] Unknown argument: ${arg}`)
    process.exit(1)
  }

  return {
    ...options,
    version: options.version.trim(),
    outputDir: resolve(rootDir, options.outputDir.trim()),
    notesFile: options.notesFile ? resolve(rootDir, options.notesFile.trim()) : '',
  }
}

function checkPrerequisites(options) {
  // 1. Check git
  const gitVersion = runCapture('git', ['--version'])
  if (!gitVersion.ok) {
    console.error('[release] git is not installed or not in PATH.')
    process.exit(1)
  }

  // 2. Check gh
  const ghVersion = runCapture('gh', ['--version'])
  if (!ghVersion.ok) {
    console.error('[release] GitHub CLI (gh) is not installed.')
    console.error('[release] Please install it first (e.g. brew install gh) and run gh auth login.')
    process.exit(1)
  }

  const ghAuth = runCapture('gh', ['auth', 'status'])
  if (!ghAuth.ok) {
    console.error('[release] GitHub CLI (gh) is not authenticated.')
    console.error('[release] Please run "gh auth login" to authenticate with your GitHub account.')
    process.exit(1)
  }

  // 3. Check dirty git state
  if (!options.allowDirty) {
    const gitStatus = runCapture('git', ['status', '--porcelain'], { cwd: rootDir })
    if (gitStatus.ok && gitStatus.stdout.length > 0) {
      console.error('[release] Error: Working tree has uncommitted changes.')
      console.error(gitStatus.stdout)
      console.error('[release] Please commit or stash your changes before releasing, or pass --allow-dirty.')
      process.exit(1)
    }
  }

  // 4. Try fetching latest tags from remote (non-fatal if offline)
  const fetchTags = runCapture('git', ['fetch', '--tags', 'origin'], { cwd: rootDir })
  if (!fetchTags.ok) {
    console.warn('[release] Notice: Could not fetch tags from remote origin. Falling back to local tags.')
  }
}

function resolveReleaseVersion(explicitVersion) {
  if (explicitVersion) {
    const parsed = parseVersion(explicitVersion)
    if (!parsed) {
      console.error(
        `[release] Invalid explicit version "${explicitVersion}". Must match [v]major.minor.patch (e.g. v0.1.19).`,
      )
      process.exit(1)
    }
    return {
      latestVersion: null,
      targetVersion: explicitVersion,
      autoBumped: false,
    }
  }

  // Auto-calculate from git tags
  const tagsResult = runCapture('git', ['tag', '-l'], { cwd: rootDir })
  const tags = tagsResult.ok && tagsResult.stdout ? tagsResult.stdout.split('\n').map(t => t.trim()).filter(Boolean) : []
  const latestTag = findLatestReleaseVersion(tags)

  if (!latestTag) {
    const defaultInitial = 'v0.1.0'
    console.warn(`[release] No existing release tags found. Starting with default ${defaultInitial}`)
    return {
      latestVersion: null,
      targetVersion: defaultInitial,
      autoBumped: true,
    }
  }

  const nextVersion = getNextVersion(latestTag)
  return {
    latestVersion: latestTag,
    targetVersion: nextVersion,
    autoBumped: true,
  }
}

function checkTagAvailability(targetVersion, options) {
  if (options.skipGitTag) {
    return
  }

  // Check local tag
  const localTag = runCapture('git', ['rev-parse', '--verify', `refs/tags/${targetVersion}`], {
    cwd: rootDir,
  })
  if (localTag.ok) {
    console.error(`[release] Error: Tag "${targetVersion}" already exists locally.`)
    console.error('[release] If you want to republish an existing tag, pass --skip-git-tag.')
    process.exit(1)
  }

  // Check remote tag
  const remoteTag = runCapture('git', ['ls-remote', '--tags', 'origin', `refs/tags/${targetVersion}`], {
    cwd: rootDir,
  })
  if (remoteTag.ok && remoteTag.stdout.includes(targetVersion)) {
    console.error(`[release] Error: Tag "${targetVersion}" already exists on remote origin.`)
    console.error('[release] Please check your release history or delete the tag on remote if aborted.')
    process.exit(1)
  }
}

function collectReleaseAssets(outputDir, targetVersion) {
  if (!existsSync(outputDir)) {
    return []
  }

  const entries = readdirSync(outputDir)
  const assets = []

  for (const entry of entries) {
    if (entry.endsWith('.zip') && entry.includes(targetVersion)) {
      assets.push(join(outputDir, entry))
    }
  }

  const manifestPath = join(outputDir, 'manifest.json')
  if (existsSync(manifestPath)) {
    assets.push(manifestPath)
  }

  return assets
}

function executeRelease() {
  const argv = process.argv.slice(2)
  const options = parseArgs(argv)

  if (options.showHelp) {
    printHelp()
    process.exit(0)
  }

  checkPrerequisites(options)

  const { latestVersion, targetVersion, autoBumped } = resolveReleaseVersion(options.version)

  console.log('='.repeat(60))
  console.log(`[release] Target Release Version: ${targetVersion}`)
  if (autoBumped && latestVersion) {
    console.log(`[release] Automatically bumped from latest: ${latestVersion} -> ${targetVersion}`)
  }
  console.log(`[release] Output directory: ${options.outputDir}`)
  console.log('='.repeat(60))

  checkTagAvailability(targetVersion, options)

  // Dry run
  if (options.dryRun) {
    console.log('\n[dry-run] --- DRY RUN MODE (No changes will be made) ---')
    console.log(`[dry-run] 1. Would build release packages:`)
    console.log(`          node scripts/release.mjs --version=${targetVersion} --output-dir=${options.outputDir}`)
    if (!options.skipGitTag) {
      console.log(`[dry-run] 2. Would create git tag:`)
      console.log(`          git tag -a ${targetVersion} -m "Release ${targetVersion}"`)
      console.log(`          git push origin ${targetVersion}`)
    }
    console.log(`[dry-run] 3. Would publish to GitHub via gh release create:`)
    console.log(`          gh release create ${targetVersion} [assets...] --title "${targetVersion}" --generate-notes`)
    console.log('[dry-run] --- Dry run completed successfully ---')
    process.exit(0)
  }

  // 1. Build releases
  if (!options.skipBuild) {
    console.log(`\n[release] Step 1/3: Building release packages for ${targetVersion}...`)
    const buildArgs = [
      resolve(rootDir, 'scripts/release.mjs'),
      '--version',
      targetVersion,
      '--output-dir',
      options.outputDir,
    ]

    for (const token of options.targetTokens) {
      buildArgs.push('--target', token)
    }

    run('node', buildArgs, { cwd: rootDir })
  }
  else {
    console.log(`\n[release] Step 1/3: Skipping build (--skip-build specified).`)
  }

  // 2. Git Tag & Push
  if (!options.skipGitTag) {
    console.log(`\n[release] Step 2/3: Creating and pushing git tag ${targetVersion}...`)
    run('git', ['tag', '-a', targetVersion, '-m', `Release ${targetVersion}`], { cwd: rootDir })
    run('git', ['push', 'origin', targetVersion], { cwd: rootDir })
  }
  else {
    console.log(`\n[release] Step 2/3: Skipping git tag creation (--skip-git-tag specified).`)
  }

  // 3. GitHub Release
  console.log(`\n[release] Step 3/3: Publishing release to GitHub...`)
  const assets = collectReleaseAssets(options.outputDir, targetVersion)

  if (assets.length === 0) {
    console.error(`[release] Error: No release assets (.zip or manifest.json) found in ${options.outputDir}`)
    process.exit(1)
  }

  console.log(`[release] Uploading ${assets.length} assets:`)
  for (const asset of assets) {
    console.log(`  - ${asset}`)
  }

  const ghArgs = [
    'release',
    'create',
    targetVersion,
    ...assets,
    '--title',
    targetVersion,
  ]

  if (options.notes) {
    ghArgs.push('--notes', options.notes)
  }
  else if (options.notesFile) {
    ghArgs.push('--notes-file', options.notesFile)
  }
  else {
    ghArgs.push('--generate-notes')
  }

  if (options.draft) {
    ghArgs.push('--draft')
  }

  if (options.prerelease) {
    ghArgs.push('--prerelease')
  }

  run('gh', ghArgs, { cwd: rootDir })

  console.log(`\n${'='.repeat(60)}`)
  console.log(`[release] Successfully published ${targetVersion} to GitHub!`)
  console.log(`[release] View release: https://github.com/voidvon/fast-note/releases/tag/${targetVersion}`)
  console.log('='.repeat(60))
}

executeRelease()
