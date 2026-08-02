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

<style scoped lang="scss">
.ai-chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.ai-chat-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.ai-chat-toolbar__mode-chip {
  margin: 0;
  --background: rgba(255, 255, 255, 0.08);
  --color: #f5f5f7;
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  min-width: 0;
}

.ai-chat-toolbar__mode-chip .app-icon {
  color: #7dd3fc;
}

.ai-chat-toolbar__context-percent {
  color: rgba(245, 245, 247, 0.72);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.ai-chat-toolbar__actions {
  gap: 4px;
}

.ai-chat-toolbar__button {
  --border-radius: 999px;
  --color: #f5f5f7;
  --padding-start: 8px;
  --padding-end: 8px;
  --background-hover: rgba(255, 255, 255, 0.08);
  margin: 0;
  min-height: 34px;
  min-width: 34px;
}

.ai-chat-toolbar__button[disabled] {
  opacity: 0.45;
}
</style>
