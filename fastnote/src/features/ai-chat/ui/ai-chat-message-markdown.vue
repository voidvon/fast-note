<script setup lang="ts">
import { Comark } from '@comark/vue'

defineProps<{
  markdown: string
  streaming?: boolean
}>()
</script>

<template>
  <div class="ai-chat-message-markdown">
    <Suspense>
      <template #default>
        <Comark
          :markdown="markdown"
          :streaming="streaming"
          :caret="false"
          :options="{
            autoClose: true,
            autoUnwrap: true,
            html: false,
          }"
        />
      </template>

      <template #fallback>
        <div class="ai-chat-message-markdown__fallback">
          {{ markdown }}
        </div>
      </template>
    </Suspense>
  </div>
</template>

<style scoped lang="scss">
.ai-chat-message-markdown {
  min-width: 0;
}

.ai-chat-message-markdown :deep(.comark-stream) {
  min-width: 0;
}

.ai-chat-message-markdown__fallback {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
