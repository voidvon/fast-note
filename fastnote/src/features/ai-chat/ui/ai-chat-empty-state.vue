<script setup lang="ts">
import { IonButton } from '@ionic/vue'

const props = defineProps<{
  configured: boolean
  prompts: readonly string[]
}>()

const emit = defineEmits<{
  prefill: [value: string]
}>()
</script>

<template>
  <div class="ai-chat-empty-state">
    <p class="ai-chat-empty-state__title">
      {{ props.configured ? '已切换到 AI 对话' : 'AI 对话待配置' }}
    </p>
    <p class="ai-chat-empty-state__text">
      {{ props.configured ? '输入消息后会在这里以流式方式返回回答。' : '完成配置后，这里会以流式方式展示 AI 回复。' }}
    </p>

    <div v-if="props.configured" class="ai-chat-empty-state__suggestions">
      <IonButton
        v-for="prompt in prompts"
        :key="prompt"
        fill="outline"
        size="small"
        class="ai-chat-empty-state__suggestion-button"
        @click="emit('prefill', prompt)"
      >
        {{ prompt }}
      </IonButton>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-chat-empty-state {
  display: flex;
  width: 100%;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
}

.ai-chat-empty-state__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #f5f5f7;
}

.ai-chat-empty-state__text {
  margin: 0;
  max-width: 36rem;
  line-height: 1.6;
  color: #a1a1aa;
}

.ai-chat-empty-state__suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.ai-chat-empty-state__suggestion-button {
  --border-color: rgba(125, 211, 252, 0.26);
  --color: #d4d4d8;
  --background: rgba(255, 255, 255, 0.03);
  --background-hover: rgba(125, 211, 252, 0.08);
  --border-radius: 999px;
  margin: 0;
  text-transform: none;
}
</style>
