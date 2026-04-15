<script setup lang="ts">
import type { AlertButton } from '@ionic/vue'
import { IonAlert } from '@ionic/vue'
import { computed } from 'vue'

const props = defineProps<{
  canRetry: boolean
  message: string
}>()

const emit = defineEmits<{
  close: []
  retry: []
}>()

const buttons = computed<AlertButton[]>(() => {
  const actionButtons: AlertButton[] = [
    {
      text: '关闭',
      role: 'cancel',
    },
  ]

  if (props.canRetry) {
    actionButtons.push({
      text: '重试',
      handler: () => {
        emit('retry')
      },
    })
  }

  return actionButtons
})

function handleDidDismiss() {
  emit('close')
}
</script>

<template>
  <IonAlert
    :is-open="!!message"
    header="AI 请求失败"
    :message="message"
    :buttons="buttons"
    @did-dismiss="handleDidDismiss"
  />
</template>
