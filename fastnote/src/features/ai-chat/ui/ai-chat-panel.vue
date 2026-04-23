<script setup lang="ts">
import type { ChatMessageCardAction } from '@/shared/ui/chat-message'
import { IonButton, IonButtons, IonList, IonNote } from '@ionic/vue'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import ChatMessage from '@/shared/ui/chat-message'
import { AI_CHAT_STARTER_PROMPTS } from '../model/starter-prompts'
import { useAiChat } from '../model/use-ai-chat'
import AiChatEmptyState from './ai-chat-empty-state.vue'
import AiChatErrorBanner from './ai-chat-error-banner.vue'
import AiChatSettingsModal from './ai-chat-settings-modal.vue'
import AiChatToolbar from './ai-chat-toolbar.vue'

const emit = defineEmits<{
  action: [payload: ChatMessageCardAction]
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
const latestVisibleAssistantMessageId = computed(() => {
  for (let index = visibleMessages.value.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages.value[index]
    if (message.role === 'assistant') {
      return message.id
    }
  }

  return ''
})
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
      @close="handleCloseSettings"
      @save="handleSaveSettings"
      @reset="handleResetSettings"
    />

    <div ref="threadRef" class="ai-chat-panel__thread" @scroll.passive="syncAutoScrollState">
      <template v-if="hasVisibleMessages">
        <IonList lines="none" class="ai-chat-panel__message-list">
          <ChatMessage
            v-for="message in visibleMessages"
            :key="message.id"
            :blocks="message.blocks"
            :role="message.role"
            :content="message.text"
            :status-label="message.id === latestVisibleAssistantMessageId ? conversationProgress?.label : ''"
            :status-description="message.id === latestVisibleAssistantMessageId ? conversationProgress?.description : ''"
            :status-loading="message.id === latestVisibleAssistantMessageId && !!conversationProgress"
            :streaming="streamingAssistantMessageId === message.id"
            @action="handleMessageAction"
          />
          <ChatMessage
            v-if="conversationProgress && !latestVisibleAssistantMessageId"
            role="assistant"
            pending
            :pending-label="conversationProgress.label"
            :pending-description="conversationProgress.description"
          />
        </IonList>
      </template>

      <AiChatEmptyState
        v-else
        :configured="hasConfiguredProvider"
        :prompts="AI_CHAT_STARTER_PROMPTS"
        @prefill="emit('prefill', $event)"
      />
    </div>

    <IonButtons v-if="canResumeTask" class="ai-chat-panel__task-actions">
      <IonButton size="small" @click="emit('resumeTask')">
        继续任务
      </IonButton>
    </IonButtons>

    <div v-if="showConfirmationBlock" class="ai-chat-panel__confirmation">
      <IonNote class="ai-chat-panel__confirmation-label">
        待确认操作
      </IonNote>
      <ul class="ai-chat-panel__confirmation-list">
        <li v-for="line in confirmationPreviewLines" :key="line">
          {{ line }}
        </li>
      </ul>
      <IonButtons class="ai-chat-panel__confirmation-actions">
        <IonButton size="small" @click="handleConfirmPendingExecution">
          确认执行
        </IonButton>
        <IonButton size="small" fill="clear" @click="cancelPendingExecution">
          取消
        </IonButton>
      </IonButtons>
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
  display: flex;
  flex: 1;
  height: 100%;
  flex-direction: column;
  min-height: 0;
  padding: 16px;
  gap: 16px;
  overflow: hidden;

  &__thread {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    touch-action: auto;
    padding-right: 4px;
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

  &__task-actions {
    gap: 8px;
    margin-top: 8px;
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
