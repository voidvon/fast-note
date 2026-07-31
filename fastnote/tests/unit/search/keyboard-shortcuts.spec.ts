import { describe, expect, it } from 'vitest'
import { isOpenGlobalSearchShortcut } from '@/features/global-search/lib/keyboard-shortcuts'

function createShortcutEvent(overrides: Record<string, unknown> = {}) {
  return {
    altKey: false,
    ctrlKey: false,
    key: 'k',
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

describe('global search keyboard shortcuts', () => {
  it('supports command+k and ctrl+k case-insensitively', () => {
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ key: 'K', metaKey: true }))).toBe(true)
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ ctrlKey: true }))).toBe(true)
  })

  it('ignores synthetic key events without a string key', () => {
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ key: undefined }))).toBe(false)
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ key: null }))).toBe(false)
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ key: 75 }))).toBe(false)
  })

  it('rejects shortcuts with extra modifiers', () => {
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ altKey: true, metaKey: true }))).toBe(false)
    expect(isOpenGlobalSearchShortcut(createShortcutEvent({ ctrlKey: true, shiftKey: true }))).toBe(false)
  })
})
