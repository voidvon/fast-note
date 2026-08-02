import type { ComputedRef, DefineComponent, Ref } from 'vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

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
  listRef: Ref<DefineComponent | null>,
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

  const rootElement = () => listRef.value?.$el as HTMLElement | undefined
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

  function setup() {
    const root = rootElement()
    root?.addEventListener('pointerdown', onPointerDown)
    root?.addEventListener('pointermove', onPointerMove)
    root?.addEventListener('pointerup', cancel)
    root?.addEventListener('pointercancel', cancel)
    root?.addEventListener('click', onClick, true)
    root?.addEventListener('contextmenu', onContextMenu)
  }

  function cleanup() {
    cancel()
    const root = rootElement()
    root?.removeEventListener('pointerdown', onPointerDown)
    root?.removeEventListener('pointermove', onPointerMove)
    root?.removeEventListener('pointerup', cancel)
    root?.removeEventListener('pointercancel', cancel)
    root?.removeEventListener('click', onClick, true)
    root?.removeEventListener('contextmenu', onContextMenu)
  }

  onMounted(setup)
  onBeforeUnmount(cleanup)
  watch(isEnabled, enabled => !enabled && cancel())

  return { isLongPressing, longPressTriggered, cleanupLongPressGesture: cleanup }
}
