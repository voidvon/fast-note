<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { ref } from 'vue'
import AiChatSettingsCard from './ai-chat-settings-card.vue'

defineProps<{
  apiKey: string
  baseUrl: string
  canDismiss: boolean
  contextWindowHint?: string
  contextWindowTokens?: number | string
  isOpen: boolean
  model: string
  tokenizerHint?: string
}>()

const emit = defineEmits<{
  'cancel': []
  'close': []
  'reset': []
  'save': []
  'update:apiKey': [value: string]
  'update:baseUrl': [value: string]
  'update:contextWindowTokens': [value: string]
  'update:model': [value: string]
}>()

const modalRef = ref()

function canDismissByCancelRole(_data: unknown, role?: string) {
  return role === 'cancel'
}

async function handleCancel() {
  const modal = modalRef.value?.$el as HTMLIonModalElement | undefined
  await modal?.dismiss?.(undefined, 'cancel')
  emit('cancel')
}

function handleDidDismiss() {
  emit('close')
}
</script>

<template>
  <IonModal
    ref="modalRef"
    :is-open="isOpen"
    :can-dismiss="canDismiss ? true : canDismissByCancelRole"
    @did-dismiss="handleDidDismiss"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>配置直连模型</IonTitle>
        <IonButtons slot="start">
          <IonButton aria-label="取消 AI 配置" @click="handleCancel">
            取消
          </IonButton>
        </IonButtons>
        <IonButtons v-if="canDismiss" slot="end">
          <IonButton aria-label="关闭 AI 配置" @click="emit('close')">
            <IonIcon :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <AiChatSettingsCard
        :api-key="apiKey"
        :base-url="baseUrl"
        :context-window-hint="contextWindowHint"
        :context-window-tokens="contextWindowTokens"
        :model="model"
        :tokenizer-hint="tokenizerHint"
        @update:api-key="emit('update:apiKey', $event)"
        @update:base-url="emit('update:baseUrl', $event)"
        @update:context-window-tokens="emit('update:contextWindowTokens', $event)"
        @update:model="emit('update:model', $event)"
        @save="emit('save')"
        @reset="emit('reset')"
      />
    </IonContent>
  </IonModal>
</template>
