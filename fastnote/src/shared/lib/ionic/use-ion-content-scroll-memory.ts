import type { Ref } from 'vue'
import { nextTick } from 'vue'

interface IonContentLike {
  $el?: IonContentElementLike
  getScrollElement?: () => Promise<HTMLElement>
}

interface IonContentElementLike extends HTMLElement {
  getScrollElement?: () => Promise<HTMLElement>
}

const STORAGE_PREFIX = 'ion-content-scroll:'

function getIonContentElement(contentRef: Ref<IonContentLike | undefined>) {
  if (!contentRef.value)
    return null

  if (contentRef.value.getScrollElement)
    return contentRef.value

  return contentRef.value.$el ?? null
}

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`
}

async function getScrollElement(contentRef: Ref<IonContentLike | undefined>) {
  const ionContent = getIonContentElement(contentRef)
  if (!ionContent?.getScrollElement)
    return null

  try {
    return await ionContent.getScrollElement()
  }
  catch {
    return null
  }
}

export function useIonContentScrollMemory(
  contentRef: Ref<IonContentLike | undefined>,
  getKey: () => string,
) {
  async function saveScrollPosition() {
    const key = getKey()
    if (!key)
      return

    const scrollElement = await getScrollElement(contentRef)
    if (!scrollElement)
      return

    try {
      sessionStorage.setItem(getStorageKey(key), String(scrollElement.scrollTop))
    }
    catch {
    }
  }

  async function restoreScrollPosition() {
    const key = getKey()
    if (!key)
      return

    let savedPosition: string | null = null

    try {
      savedPosition = sessionStorage.getItem(getStorageKey(key))
    }
    catch {
      savedPosition = null
    }

    if (savedPosition == null)
      return

    const top = Number(savedPosition)
    if (!Number.isFinite(top))
      return

    await nextTick()
    await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))

    const scrollElement = await getScrollElement(contentRef)
    if (!scrollElement)
      return

    scrollElement.scrollTop = top
  }

  async function scrollToTop() {
    await nextTick()

    const scrollElement = await getScrollElement(contentRef)
    if (!scrollElement)
      return

    scrollElement.scrollTop = 0
  }

  return {
    saveScrollPosition,
    restoreScrollPosition,
    scrollToTop,
  }
}
