export function resetTestEnvironment() {
  localStorage.clear()
  sessionStorage.clear()

  if (typeof window.matchMedia === 'function') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    if (typeof mediaQuery.addEventListener === 'function' && typeof mediaQuery.removeEventListener === 'function')
      return
  }

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => true,
    }),
  })
}

export function createMockFile(
  name: string,
  type: string,
  content = 'mock-content',
): File {
  return new File([content], name, { type })
}
