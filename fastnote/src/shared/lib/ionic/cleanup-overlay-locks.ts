function cleanupElementLocks(element: HTMLElement | null) {
  if (!element) {
    return
  }

  element.classList.remove('backdrop-no-scroll')

  if (element.style.overflow === 'hidden') {
    element.style.overflow = ''
  }

  if (element.style.touchAction === 'none') {
    element.style.touchAction = ''
  }

  if (element.style.pointerEvents === 'none') {
    element.style.pointerEvents = ''
  }
}

export function cleanupIonicOverlayLocks() {
  if (typeof document === 'undefined') {
    return
  }

  cleanupElementLocks(document.documentElement)
  cleanupElementLocks(document.body)
  cleanupElementLocks(document.querySelector('ion-app'))
}

export function cleanupIonicOverlayLocksAsync() {
  if (typeof window === 'undefined') {
    cleanupIonicOverlayLocks()
    return
  }

  window.setTimeout(() => {
    cleanupIonicOverlayLocks()

    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => {
        cleanupIonicOverlayLocks()
      })
    }
  }, 0)
}
