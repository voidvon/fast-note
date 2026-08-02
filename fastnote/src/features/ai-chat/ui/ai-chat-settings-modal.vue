<script setup lang="ts">
import type { F7ModalElement } from '@/shared/ui/f7'
import { ref } from 'vue'
import {
  F7Button,
  F7Buttons,
  F7Content,
  F7Header,
  F7Icon,
  F7Modal,
  F7Title,
  F7Toolbar,
} from '@/shared/ui/f7'
import { closeOutline } from '@/shared/ui/icons'
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
  const modal = modalRef.value?.$el as F7ModalElement | undefined
  await modal?.dismiss?.(undefined, 'cancel')
  emit('cancel')
}

function handleDidDismiss() {
  emit('close')
}
</script>

<template>
  <F7Modal
    ref="modalRef"
    :is-open="isOpen"
    :can-dismiss="canDismiss ? true : canDismissByCancelRole"
    @did-dismiss="handleDidDismiss"
  >
    <F7Header>
      <F7Toolbar>
        <F7Title>配置直连模型</F7Title>
        <F7Buttons position="start">
          <F7Button aria-label="取消 AI 配置" @click="handleCancel">
            取消
          </F7Button>
        </F7Buttons>
        <F7Buttons v-if="canDismiss" position="end">
          <F7Button aria-label="关闭 AI 配置" @click="emit('close')">
            <F7Icon :icon="closeOutline" />
          </F7Button>
        </F7Buttons>
      </F7Toolbar>
    </F7Header>

    <F7Content class="app-padding">
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
    </F7Content>
  </F7Modal>
</template>
