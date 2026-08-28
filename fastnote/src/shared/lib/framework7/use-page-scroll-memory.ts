import type { Ref } from 'vue'
import { nextTick } from 'vue'

interface PageContentLike {
  $el?: HTMLElement
  getScrollElement?: () => Promise<HTMLElement>
}

const STORAGE_PREFIX = 'page-scroll:'
const RESTORE_MAX_FRAMES = 12
const RESTORE_STABLE_FRAMES = 4

function waitForAnimationFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

async function getScrollElement(contentRef: Ref<PageContentLike | undefined>) {
  const value = contentRef.value
  if (!value)
    return null
  if (value.getScrollElement)
    return value.getScrollElement()
  return value.$el ?? null
}

export function usePageScrollMemory(contentRef: Ref<PageContentLike | undefined>, getKey: () => string) {
  function saveScrollPositionFromEvent(event: Event) {
    const key = getKey()
    const element = event.currentTarget
    if (key && element instanceof HTMLElement)
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, String(element.scrollTop))
  }

  async function restoreScrollPosition() {
    const key = getKey()
    const saved = key ? sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) : null
    const savedTop = Number(saved)
    if (saved == null || !Number.isFinite(savedTop))
      return

    let element: HTMLElement | null = null
    let stableFrames = 0
    for (let frame = 0; frame < RESTORE_MAX_FRAMES; frame += 1) {
      await nextTick()
      await waitForAnimationFrame()
      element = await getScrollElement(contentRef)
      if (!element)
        continue

      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight)
      if (savedTop > maxScrollTop) {
        stableFrames = 0
        continue
      }

      element.scrollTop = savedTop
      stableFrames += 1
      if (stableFrames >= RESTORE_STABLE_FRAMES)
        return
    }

    element ??= await getScrollElement(contentRef)
    if (element)
      element.scrollTop = savedTop
  }

  async function scrollToTop() {
    await nextTick()
    const element = await getScrollElement(contentRef)
    if (element)
      element.scrollTop = 0
  }

  return { restoreScrollPosition, saveScrollPositionFromEvent, scrollToTop }
}
