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
import AiChatSettingsCard from './ai-chat-settings-card.vue'

defineProps<{
  apiKey: string
  baseUrl: string
  canDismiss: boolean
  contextWindowHint?: string
  contextWindowTokens?: number | string
  isOpen: boolean
  model: string
  supportsNativeTools?: boolean
  tokenizerHint?: string
}>()

const emit = defineEmits<{
  'close': []
  'reset': []
  'save': []
  'update:apiKey': [value: string]
  'update:baseUrl': [value: string]
  'update:contextWindowTokens': [value: string]
  'update:model': [value: string]
  'update:supportsNativeTools': [value: boolean]
}>()

function handleDidDismiss() {
  emit('close')
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :can-dismiss="canDismiss"
    @did-dismiss="handleDidDismiss"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>配置直连模型</IonTitle>
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
        :supports-native-tools="supportsNativeTools"
        :tokenizer-hint="tokenizerHint"
        @update:api-key="emit('update:apiKey', $event)"
        @update:base-url="emit('update:baseUrl', $event)"
        @update:context-window-tokens="emit('update:contextWindowTokens', $event)"
        @update:model="emit('update:model', $event)"
        @update:supports-native-tools="emit('update:supportsNativeTools', $event)"
        @save="emit('save')"
        @reset="emit('reset')"
      />
    </IonContent>
  </IonModal>
</template>
