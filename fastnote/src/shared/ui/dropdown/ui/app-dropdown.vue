<script setup lang="ts">
import { F7Popover } from '@/shared/ui/f7'

defineOptions({
  name: 'AppDropdown',
  inheritAttrs: false,
})

withDefaults(defineProps<{
  isOpen: boolean
  size?: 'compact' | 'default'
  targetEl: string | HTMLElement
  verticalPosition?: 'auto' | 'bottom' | 'top'
}>(), {
  size: 'default',
  verticalPosition: 'auto',
})

defineEmits<{
  'didDismiss': []
  'update:isOpen': [value: boolean]
}>()
</script>

<template>
  <F7Popover
    v-bind="$attrs"
    :is-open
    :target-el
    :vertical-position
    class="app-dropdown"
    :class="`app-dropdown--${size}`"
    @update:is-open="$emit('update:isOpen', $event)"
    @did-dismiss="$emit('didDismiss')"
  >
    <div class="app-dropdown__content">
      <slot />
    </div>
  </F7Popover>
</template>

<style lang="scss">
.app-dropdown {
  --background: var(--c-modal-background);
  --f7-popover-width: max-content;

  max-width: min(280px, calc(100vw - 24px));
}

.app-dropdown__content {
  max-height: min(520px, calc(100dvh - 140px));
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}

.app-dropdown__list {
  .app-list-item {
    --background: var(--c-list-background);
    --color: var(--c-text-primary);
  }
}

.app-dropdown__icon {
  width: 24px;
  height: 24px;
  color: var(--f7-theme-color);
}

.app-dropdown--compact {
  --f7-list-inset-side-margin: 10px;
  --f7-list-item-padding-horizontal: 14px;
  --f7-list-item-padding-vertical: 1px;
  --f7-list-item-media-margin: 10px;
  --f7-list-item-min-height: 36px;
  --f7-list-item-title-font-size: 15px;
  --f7-list-item-title-font-weight: 500;
  --f7-list-item-title-line-height: 20px;

  .app-dropdown__icon {
    width: 20px;
    height: 20px;
  }
}

.app-dropdown__icon--success {
  color: var(--app-color-success);
}

.app-dropdown__icon--danger {
  color: var(--f7-color-red);
}
</style>
