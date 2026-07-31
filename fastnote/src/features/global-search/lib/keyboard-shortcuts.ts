type KeyboardShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'> & {
  key?: string | null
}

export function isOpenGlobalSearchShortcut(event: KeyboardShortcutEvent) {
  const key = typeof event.key === 'string' ? event.key.toLowerCase() : ''

  return key === 'k'
    && (event.metaKey || event.ctrlKey)
    && !event.altKey
    && !event.shiftKey
}
