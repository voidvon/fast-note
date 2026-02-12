import type { Gesture } from '@ionic/vue'
import type { DefineComponent, Ref } from 'vue'
import { createGesture } from '@ionic/vue'
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface LongPressListOptions {
  /** 长按所需的时间 (毫秒), 默认 500ms */
  duration?: number
  /** 触发长按事件的最大移动距离 (像素), 默认 10px */
  maxMovePx?: number
  /** 获取列表项目的选择器 */
  itemSelector: string
  /** 当长按某个项目时的回调 */
  onItemLongPress: (element: HTMLElement, event?: UIEvent) => void
  /** 当点击某个项目时的回调 */
  onItemClick?: (element: HTMLElement, event: MouseEvent) => void
  /** 按下时添加的CSS类名, 默认 'long-press-active' */
  pressedClass?: string
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
  } = options

  const isLongPressing = ref(false)
  const longPressTriggered = ref(false) // 标志：是否触发了长按
  const currentTarget = ref<HTMLElement | null>(null)

  let gesture: Gesture | undefined
  let longPressTimeout: number | undefined

  // 查找触摸事件中对应的列表项元素
  const findItemElement = (event: Event): HTMLElement | null => {
    if (!event || !event.target)
      return null

    // 从事件目标向上查找，直到匹配到 itemSelector 或到达委托容器
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

  const handleClick = (event: MouseEvent) => {
    // 如果是长按触发后的点击，阻止点击事件
    if (longPressTriggered.value) {
      event.stopImmediatePropagation()
      event.preventDefault()
      return
    }

    // 判断点击的目标是否是列表项
    const itemElement = findItemElement(event)
    if (itemElement && onItemClick) {
      onItemClick(itemElement, event)
    }
  }

  // 处理右键菜单事件（PC端）
  const handleContextMenu = (event: MouseEvent) => {
    const itemElement = findItemElement(event)
    if (itemElement) {
      // 阻止系统右键菜单
      event.preventDefault()
      event.stopPropagation()

      // 触发长按回调
      onItemLongPress(itemElement, event)
    }
  }

  const setupLongPressGesture = () => {
    if (!listRef.value?.$el)
      return

    // 添加捕获阶段的点击事件监听器
    listRef.value?.$el.addEventListener('click', handleClick, true)

    // 添加右键菜单事件监听器（PC端）
    listRef.value?.$el.addEventListener('contextmenu', handleContextMenu, true)

    gesture = createGesture({
      el: listRef.value?.$el,
      threshold: 0,
      gestureName: 'long-press-list',

      onStart: (detail) => {
        longPressTriggered.value = false

        const itemElement = findItemElement(detail.event)
        if (!itemElement)
          return

        currentTarget.value = itemElement
        isLongPressing.value = true

        if (pressedClass) {
          itemElement.classList.add(pressedClass)
        }

        longPressTimeout = window.setTimeout(() => {
          if (currentTarget.value === itemElement) {
            // 标记长按已触发
            longPressTriggered.value = true

            // 触发长按回调
            onItemLongPress(itemElement, detail.event)
          }
          cancelLongPress()
        }, duration)
      },

      onMove: (detail) => {
        if (
          Math.abs(detail.deltaX) > maxMovePx
          || Math.abs(detail.deltaY) > maxMovePx
        ) {
          cancelLongPress()
        }
      },

      onEnd: () => {
        cancelLongPress()
      },
    })

    gesture.enable()
  }

  onMounted(() => {
    setupLongPressGesture()
  })

  onBeforeUnmount(() => {
    cancelLongPress()

    if (gesture) {
      gesture.destroy()
      gesture = undefined
    }

    if (listRef.value?.$el) {
      listRef.value?.$el.removeEventListener('click', handleClick, true)
      listRef.value?.$el.removeEventListener('contextmenu', handleContextMenu, true)
    }
  })

  return {
    isLongPressing,
    currentTarget,
  }
}
