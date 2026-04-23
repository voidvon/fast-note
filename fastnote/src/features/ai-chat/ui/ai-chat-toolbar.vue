<script setup lang="ts">
import { IonButton, IonButtons, IonChip, IonIcon, IonLabel } from '@ionic/vue'
import { refreshOutline, settingsOutline, sparklesOutline } from 'ionicons/icons'

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
      <IonChip class="ai-chat-toolbar__mode-chip">
        <IonIcon :icon="sparklesOutline" />
        <IonLabel>{{ providerLabel }}</IonLabel>
      </IonChip>
      <span class="ai-chat-toolbar__context-percent">{{ contextRemainingPercent }}%</span>
    </div>

    <IonButtons class="ai-chat-toolbar__actions">
      <IonButton
        fill="clear"
        class="ai-chat-toolbar__button"
        aria-label="配置 AI"
        @click="emit('openSettings')"
      >
        <IonIcon :icon="settingsOutline" />
      </IonButton>
      <IonButton
        fill="clear"
        class="ai-chat-toolbar__button"
        :disabled="!canClear"
        aria-label="新建对话"
        @click="emit('clear')"
      >
        <IonIcon :icon="refreshOutline" />
      </IonButton>
    </IonButtons>
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

.ai-chat-toolbar__mode-chip ion-icon {
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
