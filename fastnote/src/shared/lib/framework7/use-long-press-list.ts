import type { ComputedRef, DefineComponent, Ref } from 'vue'
import { getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface LongPressListOptions {
  duration?: number
  maxMovePx?: number
  itemSelector: string
  onItemLongPress: (element: HTMLElement, event?: UIEvent) => void
  onItemClick?: (element: HTMLElement, event: MouseEvent) => void
  pressedClass?: string
  isDesktop?: boolean
  enabled?: Ref<boolean> | ComputedRef<boolean>
}

export function useLongPressList(
  listRef: Ref<HTMLElement | DefineComponent | null | undefined>,
  options: LongPressListOptions,
) {
  const {
    duration = 500,
    maxMovePx = 10,
    itemSelector,
    onItemLongPress,
    onItemClick,
    pressedClass = 'long-press-active',
    isDesktop = false,
    enabled,
  } = options
  const isLongPressing = ref(false)
  const longPressTriggered = ref(false)
  let target: HTMLElement | null = null
  let timer: number | undefined
  let startX = 0
  let startY = 0
  let currentElement: HTMLElement | null = null

  const getElement = () => {
    const raw = listRef.value
    if (!raw)
      return null
    if (raw instanceof HTMLElement)
      return raw
    return (raw.$el as HTMLElement | undefined) ?? null
  }

  const isEnabled = () => enabled?.value ?? true
  const findItem = (event: Event) => (event.target as HTMLElement | null)?.closest(itemSelector) as HTMLElement | null

  function cancel() {
    if (timer)
      window.clearTimeout(timer)
    timer = undefined
    target?.classList.remove(pressedClass)
    target = null
    isLongPressing.value = false
  }

  function onPointerDown(event: PointerEvent) {
    if (!isEnabled() || isDesktop || event.button !== 0)
      return
    target = findItem(event)
    if (!target)
      return
    startX = event.clientX
    startY = event.clientY
    isLongPressing.value = true
    target.classList.add(pressedClass)
    const selectedTarget = target
    timer = window.setTimeout(() => {
      longPressTriggered.value = true
      onItemLongPress(selectedTarget, event)
      cancel()
    }, duration)
  }

  function onPointerMove(event: PointerEvent) {
    if (!target)
      return
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > maxMovePx)
      cancel()
  }

  function onClick(event: MouseEvent) {
    if (longPressTriggered.value) {
      event.preventDefault()
      event.stopImmediatePropagation()
      longPressTriggered.value = false
      return
    }
    const item = findItem(event)
    if (item && onItemClick)
      onItemClick(item, event)
  }

  function onContextMenu(event: MouseEvent) {
    if (!isEnabled())
      return
    const item = findItem(event)
    if (!item)
      return
    event.preventDefault()
    onItemLongPress(item, event)
  }

  function attach(el: HTMLElement | null) {
    if (currentElement === el)
      return
    detach()
    if (!el)
      return
    currentElement = el
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', cancel)
    el.addEventListener('pointercancel', cancel)
    el.addEventListener('click', onClick, true)
    el.addEventListener('contextmenu', onContextMenu)
  }

  function detach() {
    cancel()
    if (currentElement) {
      currentElement.removeEventListener('pointerdown', onPointerDown)
      currentElement.removeEventListener('pointermove', onPointerMove)
      currentElement.removeEventListener('pointerup', cancel)
      currentElement.removeEventListener('pointercancel', cancel)
      currentElement.removeEventListener('click', onClick, true)
      currentElement.removeEventListener('contextmenu', onContextMenu)
      currentElement = null
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => attach(getElement()))
    onBeforeUnmount(detach)
  }
  else {
    attach(getElement())
  }
  watch(getElement, attach, { flush: 'post' })
  watch(isEnabled, enabled => !enabled && cancel())

  return { isLongPressing, longPressTriggered, cleanupLongPressGesture: detach }
}
