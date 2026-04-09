import os from 'node:os'

export const PACKAGE_NAME = 'fastnote'

const TARGETS = {
  'darwin-x64': {
    platform: 'darwin',
    arch: 'x64',
    goos: 'darwin',
    goarch: 'amd64',
  },
  'darwin-arm64': {
    platform: 'darwin',
    arch: 'arm64',
    goos: 'darwin',
    goarch: 'arm64',
  },
  'linux-x64': {
    platform: 'linux',
    arch: 'x64',
    goos: 'linux',
    goarch: 'amd64',
  },
  'linux-arm64': {
    platform: 'linux',
    arch: 'arm64',
    goos: 'linux',
    goarch: 'arm64',
  },
  'win32-x64': {
    platform: 'win32',
    arch: 'x64',
    goos: 'windows',
    goarch: 'amd64',
  },
}

export function resolveTargetKey() {
  const requested = process.env.FASTNOTE_TARGET_PLATFORM?.trim()
  if (requested) {
    if (!TARGETS[requested])
      throw new Error(`unsupported target platform: ${requested}`)
    return requested
  }

  const hostKey = `${os.platform()}-${normalizeHostArch(os.arch())}`
  if (!TARGETS[hostKey])
    throw new Error(`unsupported host platform: ${hostKey}`)

  return hostKey
}

export function getTargetConfig(targetKey = resolveTargetKey()) {
  const target = TARGETS[targetKey]
  if (!target)
    throw new Error(`unsupported target platform: ${targetKey}`)

  return {
    ...target,
    targetKey,
    binaryName: target.platform === 'win32' ? `${PACKAGE_NAME}.exe` : PACKAGE_NAME,
    pocketbaseBinaryName: target.platform === 'win32' ? 'pocketbase.exe' : 'pocketbase',
    archiveExtension: target.platform === 'win32' ? 'zip' : 'tar.gz',
  }
}

function normalizeHostArch(arch) {
  if (arch === 'x64' || arch === 'arm64')
    return arch
  if (arch === 'amd64')
    return 'x64'
  return arch
}
