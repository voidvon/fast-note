import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { useLongPressList } from '@/shared/lib/framework7/use-long-press-list'

describe('useLongPressList', () => {
  it('triggers contextmenu on desktop and prevents default event', async () => {
    const root = document.createElement('div')
    const item = document.createElement('div')
    item.className = 'test-item'
    root.appendChild(item)
    document.body.appendChild(root)

    const onItemLongPress = vi.fn()
    const listRef = ref<HTMLElement | null>(root)

    useLongPressList(listRef, {
      itemSelector: '.test-item',
      isDesktop: true,
      onItemLongPress,
    })

    await nextTick()

    const event = new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 50,
      clientY: 100,
    })
    item.dispatchEvent(event)

    expect(onItemLongPress).toHaveBeenCalledTimes(1)
    expect(onItemLongPress).toHaveBeenCalledWith(item, event)
    expect(event.defaultPrevented).toBe(true)

    document.body.removeChild(root)
  })

  it('re-attaches listeners when listRef target changes dynamically', async () => {
    const rootA = document.createElement('div')
    const itemA = document.createElement('div')
    itemA.className = 'test-item'
    rootA.appendChild(itemA)

    const rootB = document.createElement('div')
    const itemB = document.createElement('div')
    itemB.className = 'test-item'
    rootB.appendChild(itemB)

    const onItemLongPress = vi.fn()
    const listRef = ref<HTMLElement | null>(rootA)

    useLongPressList(listRef, {
      itemSelector: '.test-item',
      isDesktop: true,
      onItemLongPress,
    })

    await nextTick()

    // Trigger on A
    itemA.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).toHaveBeenCalledTimes(1)
    expect(onItemLongPress).toHaveBeenLastCalledWith(itemA, expect.anything())

    // Switch ref to B
    listRef.value = rootB
    await nextTick()

    // Trigger on A (should be detached)
    itemA.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).toHaveBeenCalledTimes(1)

    // Trigger on B (should be attached)
    itemB.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).toHaveBeenCalledTimes(2)
    expect(onItemLongPress).toHaveBeenLastCalledWith(itemB, expect.anything())
  })

  it('respects enabled ref when toggled', async () => {
    const root = document.createElement('div')
    const item = document.createElement('div')
    item.className = 'test-item'
    root.appendChild(item)

    const onItemLongPress = vi.fn()
    const listRef = ref<HTMLElement | null>(root)
    const enabled = ref(true)

    useLongPressList(listRef, {
      itemSelector: '.test-item',
      isDesktop: true,
      enabled,
      onItemLongPress,
    })

    await nextTick()

    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).toHaveBeenCalledTimes(1)

    enabled.value = false
    await nextTick()

    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).toHaveBeenCalledTimes(1)
  })

  it('cleans up listeners when cleanup is invoked', async () => {
    const root = document.createElement('div')
    const item = document.createElement('div')
    item.className = 'test-item'
    root.appendChild(item)

    const onItemLongPress = vi.fn()
    const listRef = ref<HTMLElement | null>(root)

    const { cleanupLongPressGesture } = useLongPressList(listRef, {
      itemSelector: '.test-item',
      isDesktop: true,
      onItemLongPress,
    })

    await nextTick()

    cleanupLongPressGesture()

    item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    expect(onItemLongPress).not.toHaveBeenCalled()
  })
})
