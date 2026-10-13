import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  findLatestReleaseVersion,
  getNextVersion,
  parseVersion,
} from '../../../../scripts/release-version.mjs'

describe('release version bump rules', () => {
  describe('parseVersion', () => {
    it('parses semver with or without v prefix', () => {
      expect(parseVersion('0.1.0')).toEqual({
        major: 0,
        minor: 1,
        patch: 0,
        hasPrefix: false,
      })
      expect(parseVersion('v0.1.18')).toEqual({
        major: 0,
        minor: 1,
        patch: 18,
        hasPrefix: true,
      })
    })

    it('returns null for pre-release or invalid version strings', () => {
      expect(parseVersion('v0.1.1-beta.1')).toBeNull()
      expect(parseVersion('invalid')).toBeNull()
      expect(parseVersion('')).toBeNull()
    })
  })

  describe('getNextVersion', () => {
    it('increments patch by +1 when patch < 20', () => {
      expect(getNextVersion('0.1.0')).toBe('0.1.1')
      expect(getNextVersion('0.1.1')).toBe('0.1.2')
      expect(getNextVersion('0.1.18')).toBe('0.1.19')
      expect(getNextVersion('0.1.19')).toBe('0.1.20')
    })

    it('rolls over to next minor (0.2.0) after 0.1.20', () => {
      expect(getNextVersion('0.1.20')).toBe('0.2.0')
      expect(getNextVersion('0.2.0')).toBe('0.2.1')
      expect(getNextVersion('0.2.19')).toBe('0.2.20')
      expect(getNextVersion('0.2.20')).toBe('0.3.0')
    })

    it('rolls over to 1.0.0 after 0.20.20', () => {
      expect(getNextVersion('0.20.19')).toBe('0.20.20')
      expect(getNextVersion('0.20.20')).toBe('1.0.0')
      expect(getNextVersion('1.0.0')).toBe('1.0.1')
    })

    it('continues rule across major versions', () => {
      expect(getNextVersion('1.0.20')).toBe('1.1.0')
      expect(getNextVersion('1.20.20')).toBe('2.0.0')
    })

    it('preserves leading "v" prefix if present', () => {
      expect(getNextVersion('v0.1.0')).toBe('v0.1.1')
      expect(getNextVersion('v0.1.18')).toBe('v0.1.19')
      expect(getNextVersion('v0.1.19')).toBe('v0.1.20')
      expect(getNextVersion('v0.1.20')).toBe('v0.2.0')
      expect(getNextVersion('v0.20.20')).toBe('v1.0.0')
    })

    it('throws on invalid version format', () => {
      expect(() => getNextVersion('invalid')).toThrow(/Invalid version format/)
    })
  })

  describe('compareVersions', () => {
    it('compares versions by numeric values instead of string lexicographical order', () => {
      expect(compareVersions('v0.1.18', 'v0.1.9')).toBeGreaterThan(0)
      expect(compareVersions('0.2.0', '0.1.20')).toBeGreaterThan(0)
      expect(compareVersions('1.0.0', '0.20.20')).toBeGreaterThan(0)
      expect(compareVersions('v0.1.5', 'v0.1.5')).toBe(0)
    })
  })

  describe('findLatestReleaseVersion', () => {
    it('identifies the latest stable release ignoring prerelease tags', () => {
      const tags = [
        'v0.1.1',
        'v0.1.1-alpha.1',
        'v0.1.1-beta.6',
        'v0.1.2',
        'v0.1.9',
        'v0.1.10',
        'v0.1.18',
      ]
      expect(findLatestReleaseVersion(tags)).toBe('v0.1.18')
    })

    it('returns null if tag list is empty or has no stable tags', () => {
      expect(findLatestReleaseVersion([])).toBeNull()
      expect(findLatestReleaseVersion(['v0.1.1-beta.1', 'dev'])).toBeNull()
    })
  })
})
