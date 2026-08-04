import { f7 } from 'framework7-vue'

type NavbarScrollContainer = HTMLElement & {
  f7DetachNavbarScrollHandlers?: () => void
}

interface NavbarScrollApi {
  initNavbarOnScroll?: (
    container: HTMLElement,
    navbar: HTMLElement,
    hideOnScroll: boolean,
    collapseLargeTitle: boolean,
    transparentOnScroll: boolean,
  ) => void
}

export function bindLargeNavbarScroll(container: HTMLElement, navbar: HTMLElement) {
  const scrollContainer = container as NavbarScrollContainer
  const navbarApi = f7?.navbar as NavbarScrollApi | undefined

  scrollContainer.f7DetachNavbarScrollHandlers?.()
  navbarApi?.initNavbarOnScroll?.(scrollContainer, navbar, false, true, false)

  return () => {
    scrollContainer.f7DetachNavbarScrollHandlers?.()
  }
}
