import type { Ref } from 'vue'
import { nextTick } from 'vue'

interface PageContentLike {
  $el?: HTMLElement
  getScrollElement?: () => Promise<HTMLElement>
}

const STORAGE_PREFIX = 'page-scroll:'

async function getScrollElement(contentRef: Ref<PageContentLike | undefined>) {
  const value = contentRef.value
  if (!value)
    return null
  if (value.getScrollElement)
    return value.getScrollElement()
  return value.$el ?? null
}

export function usePageScrollMemory(contentRef: Ref<PageContentLike | undefined>, getKey: () => string) {
  async function saveScrollPosition() {
    const key = getKey()
    const element = key ? await getScrollElement(contentRef) : null
    if (element)
      sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, String(element.scrollTop))
  }

  async function restoreScrollPosition() {
    const key = getKey()
    const saved = key ? sessionStorage.getItem(`${STORAGE_PREFIX}${key}`) : null
    if (saved == null || !Number.isFinite(Number(saved)))
      return
    await nextTick()
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
    const element = await getScrollElement(contentRef)
    if (element)
      element.scrollTop = Number(saved)
  }

  async function scrollToTop() {
    await nextTick()
    const element = await getScrollElement(contentRef)
    if (element)
      element.scrollTop = 0
  }

  return { saveScrollPosition, restoreScrollPosition, scrollToTop }
}
