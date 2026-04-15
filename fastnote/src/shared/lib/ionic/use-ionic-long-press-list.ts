import type { Gesture } from '@ionic/vue'
import type { ComputedRef, DefineComponent, Ref } from 'vue'
import { createGesture } from '@ionic/vue'
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

export function useIonicLongPressList(
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
  const currentTarget = ref<HTMLElement | null>(null)
  let pendingLongPressTarget: HTMLElement | null = null
  let pendingLongPressEvent: UIEvent | undefined

  let gesture: Gesture | undefined
  let longPressTimeout: number | undefined

  const isEnabled = () => enabled?.value ?? true

  const findItemElement = (event: Event): HTMLElement | null => {
    if (!event || !event.target)
      return null

    let element = event.target as HTMLElement
    while (element && element !== listRef.value?.$el) {
      if (element.matches(itemSelector)) {
        return element
      }
      element = element.parentElement as HTMLElement
    }

    return null
  }

  const cancelLongPress = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout)
      longPressTimeout = undefined
    }

    if (currentTarget.value && pressedClass) {
      currentTarget.value.classList.remove(pressedClass)
    }

    currentTarget.value = null
    isLongPressing.value = false
  }

  const resetPendingLongPress = () => {
    pendingLongPressTarget = null
    pendingLongPressEvent = undefined
  }

  const triggerPendingLongPress = () => {
    const target = pendingLongPressTarget
    const event = pendingLongPressEvent

    resetPendingLongPress()

    if (!target) {
      return
    }

    window.setTimeout(() => {
      onItemLongPress(target, event)
    }, 0)
  }

  const handleClick = (event: MouseEvent) => {
    if (!isEnabled()) {
      return
    }

    if (longPressTriggered.value) {
      event.stopImmediatePropagation()
      event.preventDefault()
      longPressTriggered.value = false
      return
    }

    const itemElement = findItemElement(event)
    if (itemElement && onItemClick)
      onItemClick(itemElement, event)
  }

  const handleContextMenu = (event: MouseEvent) => {
    if (!isEnabled()) {
      return
    }

    const itemElement = findItemElement(event)
    if (itemElement) {
      event.preventDefault()
      event.stopPropagation()
      onItemLongPress(itemElement, event)
    }
  }

  const setupLongPressGesture = () => {
    if (!listRef.value?.$el)
      return

    listRef.value.$el.addEventListener('click', handleClick, true)
    listRef.value.$el.addEventListener('contextmenu', handleContextMenu, true)

    if (isDesktop)
      return

    gesture = createGesture({
      el: listRef.value.$el,
      threshold: 0,
      gestureName: 'long-press-list',

      onStart: (detail) => {
        if (!isEnabled()) {
          return
        }

        longPressTriggered.value = false
        resetPendingLongPress()
        const itemElement = findItemElement(detail.event)
        if (!itemElement)
          return

        currentTarget.value = itemElement
        isLongPressing.value = true

        if (pressedClass) {
          itemElement.classList.add(pressedClass)
        }

        const startX = detail.currentX
        const startY = detail.currentY

        longPressTimeout = window.setTimeout(() => {
          if (currentTarget.value === itemElement) {
            longPressTriggered.value = true
            pendingLongPressTarget = itemElement
            pendingLongPressEvent = detail.event
          }
        }, duration)

        ;(gesture as any).__startX = startX
        ;(gesture as any).__startY = startY
      },

      onMove: (detail) => {
        if (!isEnabled()) {
          cancelLongPress()
          return
        }

        if (!isLongPressing.value || !currentTarget.value)
          return

        const startX = (gesture as any).__startX || detail.startX
        const startY = (gesture as any).__startY || detail.startY
        const moveDistance = Math.sqrt(
          (detail.currentX - startX) ** 2 + (detail.currentY - startY) ** 2,
        )

        if (moveDistance > maxMovePx) {
          cancelLongPress()
          resetPendingLongPress()
          longPressTriggered.value = false
        }
      },

      onEnd: () => {
        cancelLongPress()
        triggerPendingLongPress()
      },
      onCancel: () => {
        cancelLongPress()
        resetPendingLongPress()
        longPressTriggered.value = false
      },
    })

    gesture.enable(isEnabled())
  }

  const cleanupLongPressGesture = () => {
    cancelLongPress()
    resetPendingLongPress()
    longPressTriggered.value = false

    if (listRef.value?.$el) {
      listRef.value.$el.removeEventListener('click', handleClick, true)
      listRef.value.$el.removeEventListener('contextmenu', handleContextMenu, true)
    }

    if (gesture) {
      gesture.destroy()
      gesture = undefined
    }
  }

  onMounted(setupLongPressGesture)
  onBeforeUnmount(cleanupLongPressGesture)

  watch(() => isEnabled(), (nextEnabled) => {
    if (!nextEnabled) {
      cancelLongPress()
      resetPendingLongPress()
      longPressTriggered.value = false
    }

    gesture?.enable(nextEnabled)
  })

  return {
    isLongPressing,
    longPressTriggered,
    cleanupLongPressGesture,
  }
}
