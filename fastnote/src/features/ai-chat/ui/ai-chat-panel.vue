<script setup lang="ts">
import { IonList } from '@ionic/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import ChatMessage from '@/shared/ui/chat-message'
import { AI_CHAT_STARTER_PROMPTS } from '../model/starter-prompts'
import { useAiChat } from '../model/use-ai-chat'
import AiChatEmptyState from './ai-chat-empty-state.vue'
import AiChatErrorBanner from './ai-chat-error-banner.vue'
import AiChatSettingsModal from './ai-chat-settings-modal.vue'
import AiChatToolbar from './ai-chat-toolbar.vue'

const emit = defineEmits<{
  prefill: [value: string]
}>()

const {
  canRegenerate,
  chat,
  clearConversation,
  hasConfiguredProvider,
  hasVisibleMessages,
  isAssistantThinking,
  isBusy,
  openSettings,
  providerLabel,
  resetSettings,
  saveSettings,
  sessionLabel,
  sessionPhase,
  settings,
  showSettings,
  statusText,
  streamingAssistantMessageId,
  visibleMessages,
} = useAiChat()

const threadRef = ref<HTMLDivElement>()
const shouldAutoScroll = ref(true)
const lastUserMessageId = ref<string | null>(null)
const shouldShowSettings = computed(() => showSettings.value || !hasConfiguredProvider.value)
const settingsForm = reactive({
  apiKey: settings.apiKey,
  baseUrl: settings.baseUrl,
  model: settings.model,
})
const AUTO_SCROLL_BOTTOM_THRESHOLD_PX = 32

const scrollTrackToken = computed(() => {
  return visibleMessages.value
    .map(message => `${message.id}:${message.text}`)
    .join('\n')
})
const latestVisibleMessage = computed(() => {
  return visibleMessages.value.at(-1) || null
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

watch(() => [scrollTrackToken.value, chat.status], async () => {
  await nextTick()

  const thread = threadRef.value
  if (!thread || !shouldAutoScroll.value) {
    return
  }

  scrollThreadToBottom()
}, { deep: true })

watch(hasVisibleMessages, (nextHasVisibleMessages) => {
  if (!nextHasVisibleMessages) {
    shouldAutoScroll.value = true
    lastUserMessageId.value = null
  }
})

watch(latestVisibleMessage, async (message) => {
  if (!message || message.role !== 'user' || message.id === lastUserMessageId.value) {
    return
  }

  lastUserMessageId.value = message.id
  shouldAutoScroll.value = true

  await nextTick()
  scrollThreadToBottom()
})

watch(() => [settings.apiKey, settings.baseUrl, settings.model], () => {
  settingsForm.apiKey = settings.apiKey
  settingsForm.baseUrl = settings.baseUrl
  settingsForm.model = settings.model
})

function handleSaveSettings() {
  saveSettings({
    apiKey: settingsForm.apiKey,
    baseUrl: settingsForm.baseUrl,
    model: settingsForm.model,
  })
}

async function handleRegenerate() {
  if (!canRegenerate.value) {
    return
  }

  await chat.regenerate()
}

function handleResetSettings() {
  resetSettings()
  settingsForm.apiKey = settings.apiKey
  settingsForm.baseUrl = settings.baseUrl
  settingsForm.model = settings.model
}

function handleCloseSettings() {
  if (!hasConfiguredProvider.value) {
    return
  }

  showSettings.value = false
}
</script>

<template>
  <div class="ai-chat-panel">
    <AiChatToolbar
      :can-clear="hasVisibleMessages"
      :is-busy="isBusy"
      :provider-label="providerLabel"
      :session-label="sessionLabel"
      :session-phase="sessionPhase"
      :status-text="statusText"
      @clear="clearConversation"
      @open-settings="openSettings"
      @stop="chat.stop()"
    />

    <AiChatSettingsModal
      v-model:api-key="settingsForm.apiKey"
      v-model:base-url="settingsForm.baseUrl"
      v-model:model="settingsForm.model"
      :is-open="shouldShowSettings"
      :can-dismiss="hasConfiguredProvider"
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
            :role="message.role"
            :content="message.text"
            :streaming="streamingAssistantMessageId === message.id"
          />
          <ChatMessage
            v-if="isAssistantThinking"
            role="assistant"
            pending
            pending-label="思考中"
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
}
</style>
