import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePageScrollMemory } from '@/shared/lib/framework7'

describe('usePageScrollMemory', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.unstubAllGlobals()
  })

  it('waits for virtual list content before restoring the saved scroll position', async () => {
    const element = document.createElement('div')
    let scrollHeight = 500
    let scrollTop = 0
    let frameCount = 0

    Object.defineProperties(element, {
      clientHeight: {
        get: () => 500,
      },
      scrollHeight: {
        get: () => scrollHeight,
      },
      scrollTop: {
        get: () => scrollTop,
        set: (value: number) => {
          scrollTop = Math.min(value, Math.max(0, scrollHeight - 500))
        },
      },
    })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frameCount += 1
      if (frameCount === 3)
        scrollHeight = 1200
      callback(0)
      return frameCount
    })
    sessionStorage.setItem('page-scroll:private:/f/folder-a', '520')

    const contentRef = ref({ $el: element })
    const { restoreScrollPosition } = usePageScrollMemory(
      contentRef,
      () => 'private:/f/folder-a',
    )

    await restoreScrollPosition()

    expect(scrollTop).toBe(520)
    expect(frameCount).toBeGreaterThanOrEqual(6)
  })

  it('saves the active folder position synchronously from a scroll event', () => {
    const element = document.createElement('div')
    element.scrollTop = 380
    const contentRef = ref({ $el: element })
    const { saveScrollPositionFromEvent } = usePageScrollMemory(
      contentRef,
      () => 'private:/f/folder-a',
    )

    element.addEventListener('scroll', saveScrollPositionFromEvent)
    element.dispatchEvent(new Event('scroll'))

    expect(sessionStorage.getItem('page-scroll:private:/f/folder-a')).toBe('380')
  })
})
