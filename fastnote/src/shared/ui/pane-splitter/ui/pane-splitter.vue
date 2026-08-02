<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'

const props = withDefaults(defineProps<{
  controls: string
  disabled?: boolean
  label: string
  max: number
  min: number
  modelValue: number
  step?: number
}>(), {
  disabled: false,
  step: 8,
})

const emit = defineEmits<{
  'reset': []
  'resizeCancel': []
  'resizeEnd': []
  'update:modelValue': [value: number]
}>()

const splitterRef = ref<HTMLElement | null>(null)
let activePointerId: number | null = null
let dragStartX = 0
let dragStartValue = 0

function clamp(value: number) {
  return Math.min(Math.max(value, props.min), props.max)
}

function setDraggingState(dragging: boolean) {
  document.body.classList.toggle('pane-splitter-resizing', dragging)
  window.removeEventListener('keydown', handleDragKeydown, true)
  if (dragging) {
    window.addEventListener('keydown', handleDragKeydown, true)
  }
}

function finishDrag(commit: boolean) {
  if (activePointerId === null) {
    return
  }

  const pointerId = activePointerId
  activePointerId = null
  setDraggingState(false)

  if (!commit) {
    emit('update:modelValue', dragStartValue)
    emit('resizeCancel')
  }
  else {
    emit('resizeEnd')
  }

  if (splitterRef.value?.hasPointerCapture(pointerId)) {
    splitterRef.value.releasePointerCapture(pointerId)
  }
}

function handlePointerDown(event: PointerEvent) {
  if (props.disabled || event.button !== 0 || activePointerId !== null) {
    return
  }

  event.preventDefault()
  activePointerId = event.pointerId
  dragStartX = event.clientX
  dragStartValue = props.modelValue
  splitterRef.value?.setPointerCapture(event.pointerId)
  setDraggingState(true)
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerId !== activePointerId) {
    return
  }

  emit('update:modelValue', clamp(dragStartValue + event.clientX - dragStartX))
}

function handlePointerUp(event: PointerEvent) {
  if (event.pointerId === activePointerId) {
    finishDrag(true)
  }
}

function handlePointerCancel(event: PointerEvent) {
  if (event.pointerId === activePointerId) {
    finishDrag(false)
  }
}

function handleLostPointerCapture(event: PointerEvent) {
  if (event.pointerId === activePointerId) {
    finishDrag(true)
  }
}

function handleDragKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }

  event.preventDefault()
  event.stopImmediatePropagation()
  finishDrag(false)
}

function handleKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  const amount = event.shiftKey ? props.step * 4 : props.step
  let nextValue: number | null = null

  switch (event.key) {
    case 'ArrowLeft':
      nextValue = props.modelValue - amount
      break
    case 'ArrowRight':
      nextValue = props.modelValue + amount
      break
    case 'Home':
      nextValue = props.min
      break
    case 'End':
      nextValue = props.max
      break
    default:
      return
  }

  event.preventDefault()
  emit('update:modelValue', clamp(nextValue))
  emit('resizeEnd')
}

function handleDoubleClick() {
  if (!props.disabled) {
    emit('reset')
  }
}

onBeforeUnmount(() => {
  if (activePointerId !== null) {
    activePointerId = null
    setDraggingState(false)
  }
})
</script>

<template>
  <div
    ref="splitterRef"
    class="pane-splitter"
    :class="{ 'pane-splitter--disabled': disabled }"
    role="separator"
    aria-orientation="vertical"
    :aria-controls="controls"
    :aria-label="label"
    :aria-valuemax="Math.round(max)"
    :aria-valuemin="Math.round(min)"
    :aria-valuenow="Math.round(modelValue)"
    :aria-disabled="disabled || undefined"
    :tabindex="disabled ? -1 : 0"
    @dblclick="handleDoubleClick"
    @keydown="handleKeydown"
    @lostpointercapture="handleLostPointerCapture"
    @pointercancel="handlePointerCancel"
    @pointerdown="handlePointerDown"
    @pointermove="handlePointerMove"
    @pointerup="handlePointerUp"
  />
</template>

<style>
.pane-splitter {
  position: relative;
  z-index: 3;
  width: 1px;
  height: 100%;
  outline: 0;
  background: var(--c-pane-divider);
  cursor: col-resize;
  touch-action: none;
}

.pane-splitter::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -4px;
  width: 9px;
  content: '';
}

.pane-splitter::after {
  position: absolute;
  top: 0;
  bottom: 0;
  left: -1px;
  width: 3px;
  content: '';
  background: transparent;
  transition: background-color 120ms ease;
}

.pane-splitter:hover::after,
.pane-splitter:focus-visible::after {
  background: var(--app-color-primary);
}

.pane-splitter--disabled {
  cursor: default;
}

.pane-splitter--disabled::before {
  display: none;
}

body.pane-splitter-resizing,
body.pane-splitter-resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>
