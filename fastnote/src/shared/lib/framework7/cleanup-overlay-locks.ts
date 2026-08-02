function cleanupElementLocks(element: HTMLElement | null) {
  if (!element)
    return

  element.classList.remove('backdrop-no-scroll')
  if (element.style.overflow === 'hidden')
    element.style.overflow = ''
  if (element.style.touchAction === 'none')
    element.style.touchAction = ''
  if (element.style.pointerEvents === 'none')
    element.style.pointerEvents = ''
}

export function cleanupOverlayLocks() {
  if (typeof document === 'undefined')
    return

  cleanupElementLocks(document.documentElement)
  cleanupElementLocks(document.body)
  cleanupElementLocks(document.querySelector('#framework7-root'))
}

export function cleanupOverlayLocksAsync() {
  if (typeof window === 'undefined') {
    cleanupOverlayLocks()
    return
  }

  window.setTimeout(() => {
    cleanupOverlayLocks()
    requestAnimationFrame?.(cleanupOverlayLocks)
  }, 0)
}
