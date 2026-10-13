<script setup lang="ts">
import { Comark } from '@comark/vue'

defineProps<{
  markdown: string
  streaming?: boolean
}>()
</script>

<template>
  <div class="stream-markdown">
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
        <div class="stream-markdown__fallback">
          {{ markdown }}
        </div>
      </template>
    </Suspense>
  </div>
</template>

<style lang="scss">
.stream-markdown {
  min-width: 0;

  .comark-stream {
    min-width: 0;
  }

  &__fallback {
    white-space: pre-wrap;
    word-break: break-word;
  }
}
</style>
