import type { UIMessage } from 'ai'
import type { OpenAiCompatibleChatSettings } from './openai-compatible-chat-transport'
import { Chat } from '@ai-sdk/vue'
import { computed, reactive, ref, watch } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'
import { OpenAiCompatibleChatTransport } from './openai-compatible-chat-transport'

const AI_CHAT_CONVERSATION_STORAGE_KEY = 'ai-chat-conversation'
const AI_CHAT_SETTINGS_STORAGE_KEY = 'ai-chat-settings'
const DEFAULT_MODEL = 'gpt-4.1-mini'

const settingsState = reactive<OpenAiCompatibleChatSettings>({
  apiKey: '',
  baseUrl: '',
  model: DEFAULT_MODEL,
})
const hasHydratedConversation = ref(false)
const hasHydrated = ref(false)
const showSettings = ref(false)

const chat = new Chat<UIMessage>({
  transport: new OpenAiCompatibleChatTransport({
    resolveSettings: () => settingsState,
  }),
})

export interface AiChatViewMessage {
  id: string
  role: 'assistant' | 'user'
  text: string
}

export type AiChatSessionPhase = 'error' | 'ready' | 'responding' | 'thinking' | 'unconfigured'

function getStorageKey() {
  return createScopedStorageKey(AI_CHAT_SETTINGS_STORAGE_KEY)
}

function getConversationStorageKey() {
  return createScopedStorageKey(AI_CHAT_CONVERSATION_STORAGE_KEY)
}

function getEnvDefaults(): OpenAiCompatibleChatSettings {
  return {
    baseUrl: import.meta.env.VITE_AI_CHAT_BASE_URL?.trim() || '',
    apiKey: import.meta.env.VITE_AI_CHAT_API_KEY?.trim() || '',
    model: import.meta.env.VITE_AI_CHAT_MODEL?.trim() || DEFAULT_MODEL,
  }
}

function normalizeSettings(settings: Partial<OpenAiCompatibleChatSettings>): OpenAiCompatibleChatSettings {
  return {
    apiKey: settings.apiKey?.trim() || '',
    baseUrl: settings.baseUrl?.trim() || '',
    model: settings.model?.trim() || DEFAULT_MODEL,
  }
}

function hydrateSettings() {
  if (hasHydrated.value) {
    return
  }

  const envDefaults = getEnvDefaults()
  Object.assign(settingsState, envDefaults)

  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(getStorageKey())
    if (stored) {
      try {
        Object.assign(settingsState, normalizeSettings(JSON.parse(stored)))
      }
      catch {
        localStorage.removeItem(getStorageKey())
      }
    }
  }

  hasHydrated.value = true
}

function persistSettings() {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(getStorageKey(), JSON.stringify(settingsState))
}

function toPersistedMessages(messages: UIMessage[]) {
  return messages
    .filter((message): message is UIMessage & { role: AiChatViewMessage['role'] } => {
      return message.role === 'user' || message.role === 'assistant'
    })
    .map(message => ({
      id: message.id,
      role: message.role,
      text: getMessageText(message.parts),
    }))
}

function hydrateConversation() {
  if (hasHydratedConversation.value || typeof localStorage === 'undefined') {
    hasHydratedConversation.value = true
    return
  }

  const stored = localStorage.getItem(getConversationStorageKey())
  if (!stored) {
    hasHydratedConversation.value = true
    return
  }

  try {
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(getConversationStorageKey())
      hasHydratedConversation.value = true
      return
    }

    chat.messages = parsed
      .filter((message): message is AiChatViewMessage => {
        return !!message
          && typeof message.id === 'string'
          && (message.role === 'user' || message.role === 'assistant')
          && typeof message.text === 'string'
      })
      .map(message => ({
        id: message.id,
        role: message.role,
        parts: [{
          type: 'text' as const,
          text: message.text,
          state: 'done' as const,
        }],
      }))
  }
  catch {
    localStorage.removeItem(getConversationStorageKey())
  }

  hasHydratedConversation.value = true
}

function persistConversation() {
  if (typeof localStorage === 'undefined') {
    return
  }

  const messages = toPersistedMessages(chat.messages)
  if (!messages.length) {
    localStorage.removeItem(getConversationStorageKey())
    return
  }

  localStorage.setItem(getConversationStorageKey(), JSON.stringify(messages))
}

function saveSettings(nextSettings: Partial<OpenAiCompatibleChatSettings>) {
  hydrateSettings()
  Object.assign(settingsState, normalizeSettings({
    ...settingsState,
    ...nextSettings,
  }))
  persistSettings()
  showSettings.value = false
}

function resetSettings() {
  const envDefaults = getEnvDefaults()
  Object.assign(settingsState, envDefaults)

  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(getStorageKey())
  }
}

function clearConversation() {
  chat.messages = []
  chat.clearError()
  persistConversation()
}

function getMessageText(parts: UIMessage['parts']) {
  return parts
    .filter(part => part.type === 'text' || part.type === 'reasoning')
    .map(part => part.text)
    .join('')
}

const hasConfiguredProvider = computed(() => {
  hydrateSettings()
  return !!settingsState.baseUrl && !!settingsState.apiKey && !!settingsState.model
})

const isBusy = computed(() => chat.status === 'submitted' || chat.status === 'streaming')
const visibleMessages = computed<AiChatViewMessage[]>(() => {
  return chat.messages
    .filter((message): message is UIMessage & { role: AiChatViewMessage['role'] } => {
      return message.role === 'user' || message.role === 'assistant'
    })
    .map(message => ({
      id: message.id,
      role: message.role,
      text: getMessageText(message.parts),
    }))
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

  return latestAssistantMessage.value?.id || null
})
const isAssistantThinking = computed(() => {
  if (!isBusy.value) {
    return false
  }

  return !latestAssistantMessage.value?.text.trim()
})
const hasVisibleMessages = computed(() => visibleMessages.value.length > 0)
const canRegenerate = computed(() => hasVisibleMessages.value && !isBusy.value)
const providerLabel = computed(() => settingsState.model.trim() || '未配置模型')
const sessionPhase = computed<AiChatSessionPhase>(() => {
  if (!hasConfiguredProvider.value) {
    return 'unconfigured'
  }

  if (chat.error) {
    return 'error'
  }

  if (isAssistantThinking.value) {
    return 'thinking'
  }

  if (isBusy.value) {
    return 'responding'
  }

  return 'ready'
})
const sessionLabel = computed(() => {
  switch (sessionPhase.value) {
    case 'unconfigured':
      return '待配置'
    case 'error':
      return '请求异常'
    case 'thinking':
      return '思考中'
    case 'responding':
      return '生成中'
    case 'ready':
    default:
      return '已就绪'
  }
})
const statusText = computed(() => {
  switch (sessionPhase.value) {
    case 'unconfigured':
      return '先完成 Base URL、API Key 与模型配置。'
    case 'error':
      return '请求失败，可修改配置后重试。'
    case 'thinking':
      return 'AI 已收到消息，正在思考。'
    case 'responding':
      return 'AI 正在流式生成回复。'
    case 'ready':
    default:
      return hasVisibleMessages.value ? '当前对话可继续追问。' : '等待你的第一条消息。'
  }
})

async function sendMessage(text: string) {
  hydrateSettings()
  hydrateConversation()

  const content = text.trim()
  if (!content) {
    return false
  }

  if (!hasConfiguredProvider.value) {
    showSettings.value = true
    return false
  }

  chat.clearError()
  void chat.sendMessage({ text: content }).catch(() => {})
  return true
}

export function useAiChat() {
  hydrateSettings()
  hydrateConversation()

  return {
    chat,
    clearConversation,
    canRegenerate,
    hasConfiguredProvider,
    hasVisibleMessages,
    isBusy,
    isAssistantThinking,
    latestAssistantMessage,
    openSettings: () => {
      showSettings.value = true
    },
    providerLabel,
    resetSettings,
    saveSettings,
    sendMessage,
    sessionLabel,
    sessionPhase,
    settings: settingsState,
    showSettings,
    statusText,
    streamingAssistantMessageId,
    visibleMessages,
  }
}

watch(() => chat.messages, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  persistConversation()
}, { deep: true })
