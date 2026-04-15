<script setup lang="ts">
import { IonButton, IonButtons, IonChip, IonIcon, IonLabel, IonNote } from '@ionic/vue'
import { refreshOutline, settingsOutline, sparklesOutline, stopCircleOutline } from 'ionicons/icons'

defineProps<{
  canClear: boolean
  isBusy: boolean
  providerLabel: string
  sessionLabel: string
  sessionPhase: 'error' | 'ready' | 'responding' | 'thinking' | 'unconfigured'
  statusText: string
}>()

const emit = defineEmits<{
  clear: []
  openSettings: []
  stop: []
}>()
</script>

<template>
  <div class="ai-chat-toolbar">
    <div class="ai-chat-toolbar__meta">
      <IonChip class="ai-chat-toolbar__mode-chip">
        <IonIcon :icon="sparklesOutline" />
        <IonLabel>{{ providerLabel }}</IonLabel>
      </IonChip>
      <IonChip
        class="ai-chat-toolbar__phase-chip"
        :class="`ai-chat-toolbar__phase-chip--${sessionPhase}`"
      >
        <IonLabel>{{ sessionLabel }}</IonLabel>
      </IonChip>
      <IonNote class="ai-chat-toolbar__status-note">
        {{ statusText }}
      </IonNote>
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
      <IonButton
        v-if="isBusy"
        fill="clear"
        class="ai-chat-toolbar__button"
        aria-label="停止生成"
        @click="emit('stop')"
      >
        <IonIcon :icon="stopCircleOutline" />
      </IonButton>
    </IonButtons>
  </div>
</template>

<style scoped lang="scss">
.ai-chat-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ai-chat-toolbar__meta {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.ai-chat-toolbar__mode-chip {
  margin: 0;
  --background: rgba(255, 255, 255, 0.08);
  --color: #f5f5f7;
  border-radius: 999px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.ai-chat-toolbar__mode-chip ion-icon {
  color: #7dd3fc;
}

.ai-chat-toolbar__status-note {
  font-size: 12px;
  color: #8e8e93;
}

.ai-chat-toolbar__phase-chip {
  margin: 0;
  --color: #e4e4e7;
  --background: rgba(255, 255, 255, 0.06);
  border-radius: 999px;
}

.ai-chat-toolbar__phase-chip--ready {
  --background: rgba(34, 197, 94, 0.16);
  --color: #bbf7d0;
}

.ai-chat-toolbar__phase-chip--thinking,
.ai-chat-toolbar__phase-chip--responding {
  --background: rgba(56, 189, 248, 0.16);
  --color: #bae6fd;
}

.ai-chat-toolbar__phase-chip--error {
  --background: rgba(var(--ion-color-danger-rgb), 0.18);
  --color: #fecaca;
}

.ai-chat-toolbar__phase-chip--unconfigured {
  --background: rgba(245, 158, 11, 0.18);
  --color: #fde68a;
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
