/**
 * FastNote Release Version Bump Logic
 *
 * Rules:
 * - Version format: [v]major.minor.patch
 * - Patch increment: patch + 1 (e.g. 0.1.0 -> 0.1.1)
 * - When patch reaches 20: 0.1.20 -> 0.2.0 (patch resets to 0, minor + 1)
 * - When minor reaches 20 and patch reaches 20: 0.20.20 -> 1.0.0 (patch and minor reset to 0, major + 1)
 * - Preserves leading 'v' prefix if present.
 */

const VERSION_REGEX = /^v?(\d+)\.(\d+)\.(\d+)$/

/**
 * Parse a version string into components
 * @param {string} versionStr - Raw version string
 * @returns {{ major: number, minor: number, patch: number, hasPrefix: boolean } | null} Parsed version or null
 */
export function parseVersion(versionStr) {
  if (typeof versionStr !== 'string') {
    return null
  }

  const trimmed = versionStr.trim()
  const match = trimmed.match(VERSION_REGEX)
  if (!match) {
    return null
  }

  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    hasPrefix: trimmed.startsWith('v'),
  }
}

/**
 * Compare two parsed versions or version strings
 * @param {string | { major: number, minor: number, patch: number }} v1 - First version
 * @param {string | { major: number, minor: number, patch: number }} v2 - Second version
 * @returns {number} Comparison result
 */
export function compareVersions(v1, v2) {
  const p1 = typeof v1 === 'string' ? parseVersion(v1) : v1
  const p2 = typeof v2 === 'string' ? parseVersion(v2) : v2

  if (!p1 || !p2) {
    throw new Error(`Cannot compare invalid versions: ${JSON.stringify(v1)} vs ${JSON.stringify(v2)}`)
  }

  if (p1.major !== p2.major) {
    return p1.major - p2.major
  }
  if (p1.minor !== p2.minor) {
    return p1.minor - p2.minor
  }
  return p1.patch - p2.patch
}

/**
 * Calculate the next release version following the bump rules:
 * - +1 patch until 20
 * - after .20 -> bump minor, reset patch to 0
 * - after .20.20 -> bump major, reset minor and patch to 0
 *
 * @param {string} currentVersion - Current version string
 * @returns {string} Calculated next version
 */
export function getNextVersion(currentVersion) {
  const parsed = parseVersion(currentVersion)
  if (!parsed) {
    throw new Error(`Invalid version format: "${currentVersion}". Expected [v]X.Y.Z`)
  }

  let { major, minor, patch, hasPrefix } = parsed

  if (patch < 20) {
    patch += 1
  }
  else {
    // patch >= 20: carry over to minor
    patch = 0
    if (minor < 20) {
      minor += 1
    }
    else {
      // minor >= 20 and patch >= 20: carry over to major
      minor = 0
      major += 1
    }
  }

  const nextStr = `${major}.${minor}.${patch}`
  return hasPrefix ? `v${nextStr}` : nextStr
}

/**
 * Find the latest stable release tag from a list of git tags.
 * Ignores pre-release tags like -alpha, -beta, etc.
 *
 * @param {string[]} tags - Tag strings
 * @returns {string | null} Latest stable tag or null
 */
export function findLatestReleaseVersion(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null
  }

  const candidates = []

  for (const tag of tags) {
    const parsed = parseVersion(tag)
    if (parsed) {
      candidates.push({ tag, parsed })
    }
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => compareVersions(a.parsed, b.parsed))
  return candidates[candidates.length - 1].tag
}
