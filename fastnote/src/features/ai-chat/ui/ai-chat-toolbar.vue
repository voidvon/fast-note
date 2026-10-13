<script setup lang="ts">
import { F7Button, F7Buttons, F7Chip, F7Icon, F7Label } from '@/shared/ui/f7'
import { refreshOutline, settingsOutline, sparklesOutline } from '@/shared/ui/icons'

defineProps<{
  canClear: boolean
  contextRemainingPercent: number
  providerLabel: string
}>()

const emit = defineEmits<{
  clear: []
  openSettings: []
}>()
</script>

<template>
  <div class="ai-chat-toolbar">
    <div class="ai-chat-toolbar__meta">
      <F7Chip class="ai-chat-toolbar__mode-chip">
        <F7Icon :icon="sparklesOutline" />
        <F7Label>{{ providerLabel }}</F7Label>
      </F7Chip>
      <span class="ai-chat-toolbar__context-percent">{{ contextRemainingPercent }}%</span>
    </div>

    <F7Buttons class="ai-chat-toolbar__actions">
      <F7Button
        fill="clear"
        class="ai-chat-toolbar__button"
        aria-label="配置 AI"
        @click="emit('openSettings')"
      >
        <F7Icon :icon="settingsOutline" />
      </F7Button>
      <F7Button
        fill="clear"
        class="ai-chat-toolbar__button"
        :disabled="!canClear"
        aria-label="新建对话"
        @click="emit('clear')"
      >
        <F7Icon :icon="refreshOutline" />
      </F7Button>
    </F7Buttons>
  </div>
</template>

<style lang="scss">
.ai-chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  &__meta {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  &__mode-chip {
    margin: 0;
    --color: var(--c-text-primary);
    border-radius: 999px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
    min-width: 0;

    .app-icon {
      color: var(--f7-theme-color);
    }
  }

  &__context-percent {
    color: var(--c-text-secondary);
    font-size: 12px;
    line-height: 1;
    white-space: nowrap;
  }

  &__actions {
    gap: 4px;
  }

  &__button {
    --border-radius: 999px;
    --color: var(--c-text-primary);
    --padding-start: 8px;
    --padding-end: 8px;
    margin: 0;
    min-height: 34px;
    min-width: 34px;

    &[disabled] {
      opacity: 0.45;
    }
  }
}
</style>
