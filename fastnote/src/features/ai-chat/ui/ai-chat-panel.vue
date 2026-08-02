<script setup lang="ts">
import type { ChatMessageCardAction } from '@/shared/ui/chat-message'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import ChatMessage from '@/shared/ui/chat-message'
import { F7Button, F7Buttons, F7List, F7Note } from '@/shared/ui/f7'
import { AI_CHAT_STARTER_PROMPTS } from '../model/starter-prompts'
import { useAiChat } from '../model/use-ai-chat'
import AiChatEmptyState from './ai-chat-empty-state.vue'
import AiChatErrorBanner from './ai-chat-error-banner.vue'
import AiChatSettingsModal from './ai-chat-settings-modal.vue'
import AiChatToolbar from './ai-chat-toolbar.vue'

const emit = defineEmits<{
  action: [payload: ChatMessageCardAction]
  cancelConfiguration: []
  prefill: [value: string]
  resumeTask: []
}>()

const {
  canRegenerate,
  cancelPendingExecution,
  chat,
  clearConversation,
  confirmPendingExecution,
  canResumeInterruptedTask,
  contextRemainingPercent,
  conversationProgress,
  contextWindowHint,
  hasConfiguredProvider,
  hasPendingConfirmation,
  hasVisibleMessages,
  lastToolResults,
  openSettings,
  providerLabel,
  progressAssistantMessageId,
  regenerate,
  resetSettings,
  saveSettings,
  settings,
  showSettings,
  streamingAssistantMessageId,
  tokenizerHint,
  visibleMessages,
} = useAiChat()

const threadRef = ref<HTMLDivElement>()
const shouldAutoScroll = ref(true)
const lastUserMessageId = ref<string | null>(null)
const shouldShowSettings = computed(() => showSettings.value || !hasConfiguredProvider.value)
const settingsForm = reactive({
  apiKey: settings.apiKey,
  baseUrl: settings.baseUrl,
  contextWindowTokens: settings.contextWindowTokens ? String(settings.contextWindowTokens) : '',
  model: settings.model,
})
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 32
const INITIAL_AUTO_SCROLL_RETRY_FRAMES = 4

let autoScrollFrameId: number | null = null
let autoScrollTimeoutId: ReturnType<typeof setTimeout> | null = null
let threadResizeObserver: ResizeObserver | null = null
let messageListResizeObserver: ResizeObserver | null = null

const scrollTrackToken = computed(() => {
  return visibleMessages.value
    .map((message) => {
      const blockToken = message.blocks
        .map(block => block.type === 'text' ? `text:${block.text}` : `cards:${block.cards.map(card => card.id).join(',')}`)
        .join('|')
      return `${message.id}:${message.text}:${blockToken}`
    })
    .join('\n')
})
const latestVisibleMessage = computed(() => {
  return visibleMessages.value.at(-1) || null
})
const progressInlineMessageId = computed(() => progressAssistantMessageId.value || '')
const canResumeTask = computed(() => canResumeInterruptedTask.value)
const showConfirmationBlock = computed(() => hasPendingConfirmation.value)
const confirmationPreviewLines = computed(() => {
  return lastToolResults.value
    .map(result => result.preview)
    .filter((preview): preview is NonNullable<typeof lastToolResults.value[number]['preview']> => !!preview)
    .map(preview => `${preview.title}：${preview.summary}`)
})

function isNearBottom(element: HTMLElement) {
  const remainingDistance = element.scrollHeight - element.clientHeight - element.scrollTop
  return remainingDistance <= AUTO_SCROLL_BOTTOM_THRESHOLD_PX
}

function syncAutoScrollState() {
  const thread = threadRef.value
  if (!thread) {
    return
  }

  shouldAutoScroll.value = isNearBottom(thread)
}

function scrollThreadToBottom() {
  const thread = threadRef.value
  if (!thread) {
    return
  }

  thread.scrollTop = thread.scrollHeight
}

function clearScheduledAutoScroll() {
  if (autoScrollFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(autoScrollFrameId)
    autoScrollFrameId = null
  }

  if (autoScrollTimeoutId !== null) {
    clearTimeout(autoScrollTimeoutId)
    autoScrollTimeoutId = null
  }
}

function disconnectResizeObservers() {
  threadResizeObserver?.disconnect()
  messageListResizeObserver?.disconnect()
  threadResizeObserver = null
  messageListResizeObserver = null
}

function scheduleScrollToBottom(retryFrames = 0) {
  clearScheduledAutoScroll()

  const run = async (remainingFrames: number) => {
    await nextTick()

    const thread = threadRef.value
    if (!thread || !shouldAutoScroll.value) {
      return
    }

    scrollThreadToBottom()

    if (remainingFrames <= 0) {
      return
    }

    if (typeof requestAnimationFrame === 'function') {
      autoScrollFrameId = requestAnimationFrame(() => {
        autoScrollFrameId = null
        void run(remainingFrames - 1)
      })
      return
    }

    autoScrollTimeoutId = setTimeout(() => {
      autoScrollTimeoutId = null
      void run(remainingFrames - 1)
    }, 16)
  }

  void run(retryFrames)
}

function syncResizeObservers() {
  disconnectResizeObservers()

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  const thread = threadRef.value
  if (!thread) {
    return
  }

  const handleResize = () => {
    if (!shouldAutoScroll.value) {
      return
    }

    scheduleScrollToBottom()
  }

  threadResizeObserver = new ResizeObserver(handleResize)
  threadResizeObserver.observe(thread)

  const messageList = thread.querySelector('.ai-chat-panel__message-list')
  if (!messageList) {
    return
  }

  messageListResizeObserver = new ResizeObserver(handleResize)
  messageListResizeObserver.observe(messageList)
}

onMounted(async () => {
  syncResizeObservers()

  if (!hasVisibleMessages.value) {
    return
  }

  shouldAutoScroll.value = true
  scheduleScrollToBottom(INITIAL_AUTO_SCROLL_RETRY_FRAMES)
})

onUnmounted(() => {
  clearScheduledAutoScroll()
  disconnectResizeObservers()
})

watch(() => [scrollTrackToken.value, chat.status], async () => {
  await nextTick()

  const thread = threadRef.value
  if (!thread || !shouldAutoScroll.value) {
    return
  }

  syncResizeObservers()
  scheduleScrollToBottom()
}, { deep: true })

watch(hasVisibleMessages, (nextHasVisibleMessages) => {
  if (!nextHasVisibleMessages) {
    shouldAutoScroll.value = true
    lastUserMessageId.value = null
    syncResizeObservers()
    clearScheduledAutoScroll()
    return
  }

  syncResizeObservers()
  scheduleScrollToBottom(INITIAL_AUTO_SCROLL_RETRY_FRAMES)
})

watch(latestVisibleMessage, async (message) => {
  if (!message || message.role !== 'user' || message.id === lastUserMessageId.value) {
    return
  }

  lastUserMessageId.value = message.id
  shouldAutoScroll.value = true

  scheduleScrollToBottom()
})

watch(() => [settings.apiKey, settings.baseUrl, settings.contextWindowTokens, settings.model], () => {
  settingsForm.apiKey = settings.apiKey
  settingsForm.baseUrl = settings.baseUrl
  settingsForm.contextWindowTokens = settings.contextWindowTokens ? String(settings.contextWindowTokens) : ''
  settingsForm.model = settings.model
})

function handleSaveSettings() {
  saveSettings({
    apiKey: settingsForm.apiKey,
    baseUrl: settingsForm.baseUrl,
    contextWindowTokens: settingsForm.contextWindowTokens,
    model: settingsForm.model,
  })
}

async function handleRegenerate() {
  await regenerate()
}

function handleResetSettings() {
  resetSettings()
  settingsForm.apiKey = settings.apiKey
  settingsForm.baseUrl = settings.baseUrl
  settingsForm.contextWindowTokens = settings.contextWindowTokens ? String(settings.contextWindowTokens) : ''
  settingsForm.model = settings.model
}

function handleCloseSettings() {
  if (!hasConfiguredProvider.value) {
    return
  }

  showSettings.value = false
}

function handleCancelSettings() {
  emit('cancelConfiguration')
}

async function handleConfirmPendingExecution() {
  await confirmPendingExecution()
}

function handleMessageAction(action: ChatMessageCardAction) {
  emit('action', action)
}
</script>

<template>
  <div class="ai-chat-panel">
    <AiChatToolbar
      class="ai-chat-panel__toolbar"
      :can-clear="hasVisibleMessages"
      :context-remaining-percent="contextRemainingPercent"
      :provider-label="providerLabel"
      @clear="clearConversation"
      @open-settings="openSettings"
    />

    <AiChatSettingsModal
      v-model:api-key="settingsForm.apiKey"
      v-model:base-url="settingsForm.baseUrl"
      v-model:context-window-tokens="settingsForm.contextWindowTokens"
      v-model:model="settingsForm.model"
      :context-window-hint="contextWindowHint"
      :is-open="shouldShowSettings"
      :can-dismiss="hasConfiguredProvider"
      :tokenizer-hint="tokenizerHint"
      @cancel="handleCancelSettings"
      @close="handleCloseSettings"
      @save="handleSaveSettings"
      @reset="handleResetSettings"
    />

    <div ref="threadRef" class="ai-chat-panel__thread" @scroll.passive="syncAutoScrollState">
      <template v-if="hasVisibleMessages">
        <F7List lines="none" class="ai-chat-panel__message-list">
          <ChatMessage
            v-for="message in visibleMessages"
            :key="message.id"
            :blocks="message.blocks"
            :role="message.role"
            :content="message.text"
            :status-label="message.id === progressInlineMessageId ? conversationProgress?.label : ''"
            :status-description="message.id === progressInlineMessageId ? conversationProgress?.description : ''"
            :status-loading="message.id === progressInlineMessageId && !!conversationProgress"
            :streaming="streamingAssistantMessageId === message.id"
            @action="handleMessageAction"
          />
          <ChatMessage
            v-if="conversationProgress && !progressInlineMessageId"
            role="assistant"
            pending
            :pending-label="conversationProgress.label"
            :pending-description="conversationProgress.description"
          />
        </F7List>
      </template>

      <AiChatEmptyState
        v-else
        :configured="hasConfiguredProvider"
        :prompts="AI_CHAT_STARTER_PROMPTS"
        @prefill="emit('prefill', $event)"
      />
    </div>

    <div
      v-if="canResumeTask || showConfirmationBlock"
      class="ai-chat-panel__status-stack"
    >
      <F7Buttons v-if="canResumeTask" class="ai-chat-panel__task-actions">
        <F7Button size="small" @click="emit('resumeTask')">
          继续任务
        </F7Button>
      </F7Buttons>

      <div v-if="showConfirmationBlock" class="ai-chat-panel__confirmation">
        <F7Note class="ai-chat-panel__confirmation-label">
          待确认操作
        </F7Note>
        <ul class="ai-chat-panel__confirmation-list">
          <li v-for="line in confirmationPreviewLines" :key="line">
            {{ line }}
          </li>
        </ul>
        <F7Buttons class="ai-chat-panel__confirmation-actions">
          <F7Button size="small" @click="handleConfirmPendingExecution">
            确认执行
          </F7Button>
          <F7Button size="small" fill="clear" @click="cancelPendingExecution">
            取消
          </F7Button>
        </F7Buttons>
      </div>
    </div>

    <AiChatErrorBanner
      v-if="chat.error"
      :message="chat.error.message"
      :can-retry="canRegenerate"
      @close="chat.clearError()"
      @retry="handleRegenerate"
    />
  </div>
</template>

<style lang="scss">
.ai-chat-panel {
  position: relative;
  display: flex;
  flex: 1;
  height: 100%;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  gap: 0;
  overflow: hidden;
  --ai-chat-toolbar-height: calc(max(20px, env(safe-area-inset-top)) + 52px);

  &__toolbar {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 3;
    box-sizing: border-box;
    height: var(--ai-chat-toolbar-height);
    padding: max(20px, env(safe-area-inset-top)) 16px 10px;
    border-bottom: 1px solid var(--c-global-search-control-border);
    background: var(--c-global-search-control-background);
    -webkit-backdrop-filter: blur(18px) saturate(160%) contrast(104%);
    backdrop-filter: blur(18px) saturate(160%) contrast(104%);
  }

  &__thread {
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: auto;
    padding: calc(var(--ai-chat-toolbar-height) + 16px) 20px calc(var(--global-search-panel-bottom-inset) + 16px) 16px;
    box-sizing: border-box;
  }

  &__message-list {
    display: flex;
    width: 100%;
    min-height: min-content;
    flex-direction: column;
    gap: 12px;
    padding: 0;
    background: transparent;
  }

  &__status-stack {
    position: absolute;
    right: 16px;
    bottom: calc(var(--global-search-panel-bottom-inset) + 12px);
    left: 16px;
    z-index: 4;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: min(42vh, 360px);
    overflow-y: auto;
  }

  &__task-actions {
    gap: 8px;
    margin: 0;
  }

  &__confirmation {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px;
    border: 1px solid rgba(125, 211, 252, 0.18);
    border-radius: 16px;
    background: rgba(125, 211, 252, 0.06);
  }

  &__confirmation-label {
    margin: 0;
    color: #bae6fd;
    font-size: 12px;
  }

  &__confirmation-list {
    margin: 0;
    padding-left: 18px;
    color: #e4e4e7;
    font-size: 13px;
    line-height: 1.6;
  }

  &__confirmation-actions {
    gap: 8px;
  }
}
</style>
