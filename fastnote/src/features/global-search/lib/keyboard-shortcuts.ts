type KeyboardShortcutEvent = Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>

export function isOpenGlobalSearchShortcut(event: KeyboardShortcutEvent) {
  return event.key.toLowerCase() === 'k'
    && (event.metaKey || event.ctrlKey)
    && !event.altKey
    && !event.shiftKey
}
