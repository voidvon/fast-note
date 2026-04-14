<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { refreshOutline, settingsOutline, sparklesOutline, stopCircleOutline } from 'ionicons/icons'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useAiChat } from '../model/use-ai-chat'
import AiChatMessageMarkdown from './ai-chat-message-markdown.vue'

const emit = defineEmits<{
  prefill: [value: string]
}>()

const {
  chat,
  clearConversation,
  hasConfiguredProvider,
  isBusy,
  openSettings,
  saveSettings,
  settings,
  showSettings,
} = useAiChat()

const threadRef = ref<HTMLDivElement>()
const settingsForm = reactive({
  apiKey: settings.apiKey,
  baseUrl: settings.baseUrl,
  model: settings.model,
})
const starterPrompts = [
  '帮我整理今天的会议纪要',
  '给我一个本周待办清单模板',
  '把这段想法改写成更清晰的笔记',
]

const visibleMessages = computed(() => {
  return chat.messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      id: message.id,
      role: message.role,
      text: getMessageText(message.parts),
    }))
})

const scrollTrackToken = computed(() => {
  return visibleMessages.value
    .map(message => `${message.id}:${message.text}`)
    .join('\n')
})

const latestAssistantMessage = computed(() => {
  for (let index = visibleMessages.value.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages.value[index]
    if (message.role === 'assistant') {
      return message
    }
  }

  return null
})

const streamingAssistantMessageId = computed(() => {
  if (!isBusy.value) {
    return null
  }

  for (let index = visibleMessages.value.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages.value[index]
    if (message.role === 'assistant') {
      return message.id
    }
  }

  return null
})

const isAssistantThinking = computed(() => {
  if (!isBusy.value) {
    return false
  }

  return !latestAssistantMessage.value?.text.trim()
})

watch(() => [scrollTrackToken.value, chat.status], async () => {
  await nextTick()
  if (!threadRef.value) {
    return
  }

  if (typeof threadRef.value.scrollTo === 'function') {
    threadRef.value.scrollTo({
      top: threadRef.value.scrollHeight,
      behavior: 'smooth',
    })
    return
  }

  threadRef.value.scrollTop = threadRef.value.scrollHeight
}, { deep: true })

watch(() => [settings.apiKey, settings.baseUrl, settings.model], () => {
  settingsForm.apiKey = settings.apiKey
  settingsForm.baseUrl = settings.baseUrl
  settingsForm.model = settings.model
})

function getMessageText(parts: typeof chat.messages[number]['parts']) {
  return parts
    .filter(part => part.type === 'text' || part.type === 'reasoning')
    .map(part => part.text)
    .join('')
}

function handleSaveSettings() {
  saveSettings({
    apiKey: settingsForm.apiKey,
    baseUrl: settingsForm.baseUrl,
    model: settingsForm.model,
  })
}

async function handleRegenerate() {
  if (!visibleMessages.value.length) {
    return
  }

  await chat.regenerate()
}
</script>

<template>
  <div class="ai-chat-panel">
    <div class="ai-chat-panel__toolbar">
      <div class="ai-chat-panel__mode-badge">
        <IonIcon :icon="sparklesOutline" />
        <span>{{ settings.model || '未配置模型' }}</span>
      </div>

      <div class="ai-chat-panel__actions">
        <button
          type="button"
          class="ai-chat-panel__action-button"
          aria-label="配置 AI"
          @click="openSettings"
        >
          <IonIcon :icon="settingsOutline" />
        </button>
        <button
          type="button"
          class="ai-chat-panel__action-button"
          :disabled="!visibleMessages.length"
          aria-label="新建对话"
          @click="clearConversation"
        >
          <IonIcon :icon="refreshOutline" />
        </button>
        <button
          v-if="isBusy"
          type="button"
          class="ai-chat-panel__action-button"
          aria-label="停止生成"
          @click="chat.stop()"
        >
          <IonIcon :icon="stopCircleOutline" />
        </button>
      </div>
    </div>

    <div v-if="showSettings || !hasConfiguredProvider" class="ai-chat-panel__settings-card">
      <p class="ai-chat-panel__settings-title">
        配置直连模型
      </p>
      <p class="ai-chat-panel__settings-hint">
        当前是浏览器直连模式，API Key 会保存在本地浏览器，请只在受信任环境中使用。
      </p>

      <label class="ai-chat-panel__settings-field">
        <span>Base URL</span>
        <input
          v-model="settingsForm.baseUrl"
          type="url"
          inputmode="url"
          placeholder="https://api.openai.com/v1"
        >
      </label>

      <label class="ai-chat-panel__settings-field">
        <span>Model</span>
        <input
          v-model="settingsForm.model"
          type="text"
          placeholder="gpt-4.1-mini"
        >
      </label>

      <label class="ai-chat-panel__settings-field">
        <span>API Key</span>
        <input
          v-model="settingsForm.apiKey"
          type="password"
          placeholder="sk-..."
        >
      </label>

      <button
        type="button"
        class="ai-chat-panel__save-button"
        @click="handleSaveSettings"
      >
        保存配置
      </button>
    </div>

    <div ref="threadRef" class="ai-chat-panel__thread">
      <template v-if="visibleMessages.length">
        <article
          v-for="message in visibleMessages"
          :key="message.id"
          class="ai-chat-panel__message"
          :class="[
            message.role === 'user'
              ? 'ai-chat-panel__message--user'
              : 'ai-chat-panel__message--assistant',
          ]"
        >
          <p class="ai-chat-panel__message-role">
            {{ message.role === 'user' ? '你' : 'AI' }}
          </p>
          <div
            class="ai-chat-panel__bubble"
            :class="{ 'ai-chat-panel__bubble--markdown': message.role === 'assistant' }"
          >
            <AiChatMessageMarkdown
              v-if="message.role === 'assistant'"
              :markdown="message.text"
              :streaming="streamingAssistantMessageId === message.id"
            />
            <template v-else>
              {{ message.text }}
            </template>
          </div>
        </article>

        <article
          v-if="isAssistantThinking"
          class="ai-chat-panel__message ai-chat-panel__message--assistant"
        >
          <p class="ai-chat-panel__message-role">
            AI
          </p>
          <div class="ai-chat-panel__bubble ai-chat-panel__bubble--thinking">
            <span class="ai-chat-panel__thinking-label">思考中</span>
            <span class="ai-chat-panel__thinking-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        </article>

        <div v-if="isBusy" class="ai-chat-panel__status">
          {{ isAssistantThinking ? 'AI 正在思考...' : 'AI 正在生成回复...' }}
        </div>
      </template>

      <div v-else class="ai-chat-panel__empty">
        <p class="ai-chat-panel__empty-title">
          已切换到 AI 对话
        </p>
        <p class="ai-chat-panel__empty-text">
          输入消息后会在这里以流式方式返回回答。
        </p>

        <div class="ai-chat-panel__suggestions">
          <button
            v-for="prompt in starterPrompts"
            :key="prompt"
            type="button"
            class="ai-chat-panel__suggestion-chip"
            @click="emit('prefill', prompt)"
          >
            {{ prompt }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="chat.error" class="ai-chat-panel__error">
      <span>{{ chat.error.message }}</span>
      <button type="button" class="ai-chat-panel__error-button" @click="chat.clearError()">
        关闭
      </button>
      <button
        type="button"
        class="ai-chat-panel__error-button"
        :disabled="!visibleMessages.length || isBusy"
        @click="handleRegenerate"
      >
        重试
      </button>
    </div>
  </div>
</template>

<style lang="scss">
.ai-chat-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 16px;
  gap: 16px;

  &__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5f7;
    font-size: 13px;
  }

  &__mode-badge ion-icon {
    font-size: 14px;
    color: #7dd3fc;
  }

  &__actions {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  &__action-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5f7;
  }

  &__action-button:disabled {
    opacity: 0.45;
  }

  &__settings-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  &__settings-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #f5f5f7;
  }

  &__settings-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: #a1a1aa;
  }

  &__settings-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12px;
    color: #d4d4d8;
  }

  &__settings-field input {
    width: 100%;
    border: 0;
    border-radius: 12px;
    padding: 10px 12px;
    background: rgba(12, 12, 14, 0.44);
    color: #f5f5f7;
    outline: none;
  }

  &__save-button {
    border: 0;
    border-radius: 12px;
    padding: 11px 14px;
    background: linear-gradient(135deg, #38bdf8, #22c55e);
    color: #04111f;
    font-size: 14px;
    font-weight: 600;
  }

  &__thread {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    overflow-y: auto;
    padding-right: 4px;
  }

  &__message {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__message--user {
    align-items: flex-end;
  }

  &__message-role {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: #8e8e93;
  }

  &__bubble {
    max-width: min(680px, 86%);
    padding: 12px 14px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5f7;
    font-size: 14px;
    line-height: 1.65;
    white-space: pre-wrap;
    word-break: break-word;
  }

  &__message--user &__bubble {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.28), rgba(56, 189, 248, 0.24));
  }

  &__bubble--markdown {
    white-space: normal;
  }

  &__bubble--markdown :deep(*) {
    min-width: 0;
  }

  &__bubble--markdown :deep(p) {
    margin: 0;
  }

  &__bubble--markdown :deep(p + p),
  &__bubble--markdown :deep(p + ul),
  &__bubble--markdown :deep(p + ol),
  &__bubble--markdown :deep(p + pre),
  &__bubble--markdown :deep(p + blockquote),
  &__bubble--markdown :deep(ul + p),
  &__bubble--markdown :deep(ol + p),
  &__bubble--markdown :deep(pre + p),
  &__bubble--markdown :deep(blockquote + p),
  &__bubble--markdown :deep(ul + ul),
  &__bubble--markdown :deep(ol + ol),
  &__bubble--markdown :deep(pre + pre),
  &__bubble--markdown :deep(blockquote + blockquote) {
    margin-top: 0.75em;
  }

  &__bubble--markdown :deep(ul),
  &__bubble--markdown :deep(ol) {
    margin: 0;
    padding-left: 1.25em;
  }

  &__bubble--markdown :deep(li + li) {
    margin-top: 0.3em;
  }

  &__bubble--markdown :deep(a) {
    color: #7dd3fc;
  }

  &__bubble--markdown :deep(strong) {
    font-weight: 700;
  }

  &__bubble--markdown :deep(em) {
    font-style: italic;
  }

  &__bubble--markdown :deep(code) {
    padding: 0.15em 0.4em;
    border-radius: 8px;
    background: rgba(12, 12, 14, 0.5);
    font-size: 0.92em;
  }

  &__bubble--markdown :deep(pre) {
    overflow-x: auto;
    margin: 0;
    padding: 12px;
    border-radius: 14px;
    background: rgba(12, 12, 14, 0.56);
  }

  &__bubble--markdown :deep(pre code) {
    padding: 0;
    background: transparent;
  }

  &__bubble--markdown :deep(blockquote) {
    margin: 0;
    padding-left: 12px;
    border-left: 3px solid rgba(125, 211, 252, 0.45);
    color: #d4d4d8;
  }

  &__bubble--markdown :deep(table) {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }

  &__bubble--markdown :deep(th),
  &__bubble--markdown :deep(td) {
    padding: 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: left;
    vertical-align: top;
  }

  &__bubble--markdown :deep(hr) {
    border: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin: 12px 0;
  }

  &__bubble--thinking {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #d4d4d8;
  }

  &__thinking-label {
    font-weight: 500;
  }

  &__thinking-dots {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  &__thinking-dots i {
    display: block;
    width: 6px;
    height: 6px;
    border-radius: 999px;
    background: rgba(125, 211, 252, 0.88);
    animation: ai-chat-thinking-dot 1.2s ease-in-out infinite;
  }

  &__thinking-dots i:nth-child(2) {
    animation-delay: 0.18s;
  }

  &__thinking-dots i:nth-child(3) {
    animation-delay: 0.36s;
  }

  &__status {
    font-size: 12px;
    color: #8e8e93;
    padding: 2px 2px 0;
  }

  &__empty {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    min-height: 220px;
    color: #d4d4d8;
  }

  &__empty-title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: #f5f5f7;
  }

  &__empty-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: #a1a1aa;
  }

  &__suggestions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 8px;
  }

  &__suggestion-chip {
    border: 0;
    border-radius: 999px;
    padding: 9px 12px;
    background: rgba(255, 255, 255, 0.08);
    color: #f5f5f7;
    font-size: 13px;
  }

  &__error {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(239, 68, 68, 0.16);
    color: #fecaca;
    font-size: 13px;
  }

  &__error-button {
    border: 0;
    border-radius: 999px;
    padding: 6px 10px;
    background: rgba(255, 255, 255, 0.12);
    color: inherit;
    font-size: 12px;
  }
}

@keyframes ai-chat-thinking-dot {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.9);
  }
  40% {
    opacity: 1;
    transform: translateY(-1px) scale(1);
  }
}
</style>
