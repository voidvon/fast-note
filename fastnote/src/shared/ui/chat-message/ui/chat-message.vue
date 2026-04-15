<script setup lang="ts">
import { IonButton, IonIcon, IonItem, IonNote, IonSpinner } from '@ionic/vue'
import { checkmarkOutline, copyOutline } from 'ionicons/icons'
import { computed, onBeforeUnmount, ref } from 'vue'
import { copyText } from '@/shared/lib/clipboard'
import StreamMarkdown from '@/shared/ui/stream-markdown'

const props = withDefaults(defineProps<{
  content?: string
  label?: string
  pending?: boolean
  pendingLabel?: string
  role: 'assistant' | 'user'
  streaming?: boolean
}>(), {
  content: '',
  label: undefined,
  pending: false,
  pendingLabel: '思考中',
  streaming: false,
})

const resolvedLabel = computed(() => {
  if (props.label) {
    return props.label
  }

  return props.role === 'user' ? '你' : 'AI'
})

const canCopy = computed(() => !props.pending && !!props.content.trim())
const hasCopied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null

onBeforeUnmount(() => {
  if (copiedTimer) {
    clearTimeout(copiedTimer)
    copiedTimer = null
  }
})

async function handleCopy() {
  if (!canCopy.value) {
    return
  }

  await copyText(props.content)
  hasCopied.value = true

  if (copiedTimer) {
    clearTimeout(copiedTimer)
  }

  copiedTimer = setTimeout(() => {
    hasCopied.value = false
    copiedTimer = null
  }, 1600)
}
</script>

<template>
  <IonItem
    lines="none"
    class="chat-message"
    :class="[
      role === 'user' ? 'chat-message--user' : 'chat-message--assistant',
      { 'chat-message--pending': pending },
    ]"
  >
    <div class="chat-message__container">
      <IonNote class="chat-message__role">
        {{ resolvedLabel }}
      </IonNote>

      <div class="chat-message__bubble">
        <div v-if="pending" class="chat-message__pending-state">
          <IonSpinner name="crescent" class="chat-message__spinner" />
          <span>{{ pendingLabel }}</span>
        </div>
        <StreamMarkdown
          v-else-if="role === 'assistant'"
          :markdown="content"
          :streaming="streaming"
        />
        <div v-else class="chat-message__plain">
          {{ content }}
        </div>
      </div>

      <div v-if="canCopy" class="chat-message__actions">
        <IonButton
          fill="clear"
          size="small"
          class="chat-message__copy-button"
          :aria-label="hasCopied ? '已复制消息' : '复制消息'"
          @click="handleCopy"
        >
          <IonIcon :icon="hasCopied ? checkmarkOutline : copyOutline" />
          <span>{{ hasCopied ? '已复制' : '复制' }}</span>
        </IonButton>
      </div>
    </div>
  </IonItem>
</template>

<style scoped lang="scss">
.chat-message {
  --background: transparent;
  --border-width: 0;
  --inner-border-width: 0;
  --inner-padding-end: 0;
  --inner-padding-start: 0;
  --padding-start: 0;
  --padding-end: 0;
  --min-height: auto;
  align-items: flex-start;
}

.chat-message__container {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
}

.chat-message--user .chat-message__container {
  align-items: flex-end;
}

.chat-message__role {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.04em;
  color: #8e8e93;
}

.chat-message__bubble {
  max-width: min(680px, 86%);
  padding: 12px 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.08);
  color: #f5f5f7;
  font-size: 14px;
  line-height: 1.65;
  word-break: break-word;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.chat-message--assistant .chat-message__bubble {
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.05)), rgba(255, 255, 255, 0.04);
}

.chat-message--user .chat-message__bubble {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(56, 189, 248, 0.24));
}

.chat-message__plain {
  white-space: pre-wrap;
}

.chat-message__actions {
  display: flex;
}

.chat-message--user .chat-message__actions {
  justify-content: flex-end;
}

.chat-message__copy-button {
  --color: #8e8e93;
  --padding-start: 6px;
  --padding-end: 6px;
  margin: 0;
  min-height: 24px;
  font-size: 12px;
  text-transform: none;
}

.chat-message__copy-button span {
  margin-left: 4px;
}

.chat-message__pending-state {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #d4d4d8;
}

.chat-message__spinner {
  width: 16px;
  height: 16px;
  color: #7dd3fc;
}

.chat-message__bubble :deep(*) {
  min-width: 0;
}

.chat-message__bubble :deep(p) {
  margin: 0;
}

.chat-message__bubble :deep(p + p),
.chat-message__bubble :deep(p + ul),
.chat-message__bubble :deep(p + ol),
.chat-message__bubble :deep(p + pre),
.chat-message__bubble :deep(p + blockquote),
.chat-message__bubble :deep(ul + p),
.chat-message__bubble :deep(ol + p),
.chat-message__bubble :deep(pre + p),
.chat-message__bubble :deep(blockquote + p),
.chat-message__bubble :deep(ul + ul),
.chat-message__bubble :deep(ol + ol),
.chat-message__bubble :deep(pre + pre),
.chat-message__bubble :deep(blockquote + blockquote),
.chat-message__bubble :deep(table + p),
.chat-message__bubble :deep(p + table) {
  margin-top: 0.75em;
}

.chat-message__bubble :deep(ul),
.chat-message__bubble :deep(ol) {
  margin: 0;
  padding-left: 1.25em;
}

.chat-message__bubble :deep(li + li) {
  margin-top: 0.3em;
}

.chat-message__bubble :deep(a) {
  color: #7dd3fc;
}

.chat-message__bubble :deep(strong) {
  font-weight: 700;
}

.chat-message__bubble :deep(em) {
  font-style: italic;
}

.chat-message__bubble :deep(code) {
  padding: 0.15em 0.4em;
  border-radius: 8px;
  background: rgba(12, 12, 14, 0.5);
  font-size: 0.92em;
}

.chat-message__bubble :deep(pre) {
  overflow-x: auto;
  margin: 0;
  padding: 12px;
  border-radius: 14px;
  background: rgba(12, 12, 14, 0.56);
}

.chat-message__bubble :deep(pre code) {
  padding: 0;
  background: transparent;
}

.chat-message__bubble :deep(blockquote) {
  margin: 0;
  padding-left: 12px;
  border-left: 3px solid rgba(125, 211, 252, 0.35);
  color: #d4d4d8;
}

.chat-message__bubble :deep(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.chat-message__bubble :deep(th),
.chat-message__bubble :deep(td) {
  padding: 8px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  text-align: left;
}

.chat-message__bubble :deep(th) {
  color: #f5f5f7;
  background: rgba(255, 255, 255, 0.06);
}
</style>
