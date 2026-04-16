import type { UIMessage } from 'ai'
import type { OpenAiCompatibleChatSettings } from './openai-compatible-chat-transport'
import type { AiChatRequestContext } from './request-context'
import type { ChatMessageCard, ChatMessageCardAction, ChatMessageCardItem } from '@/shared/ui/chat-message'
import { Chat } from '@ai-sdk/vue'
import { nanoid } from 'nanoid'
import { computed, reactive, ref, watch } from 'vue'
import { useAiChatSession } from '@/processes/ai-chat-session'
import { createScopedStorageKey } from '@/shared/lib/user-scope'
import {
  mergeAssistantAnswer,
  parseAiAssistantToolEnvelope,
  summarizeExecutionResults,
  summarizePreviewResults,
} from './assistant-envelope'
import { OpenAiCompatibleChatTransport } from './openai-compatible-chat-transport'
import { AI_CHAT_REQUEST_CONTEXT_BODY_KEY } from './request-context'
import { createToolResultCards } from './tool-result-cards'

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
const aiChatSession = useAiChatSession()
const handledAssistantEnvelopeIds = new Set<string>()
const lastRequestContext = ref<AiChatRequestContext | null>(null)
const messageCards = ref<Record<string, ChatMessageCard[]>>({})

export interface AiChatViewMessage {
  cards: ChatMessageCard[]
  id: string
  role: 'assistant' | 'user'
  text: string
}

interface PersistedAiChatMessage extends AiChatViewMessage {}

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
      cards: messageCards.value[message.id] || [],
      id: message.id,
      role: message.role,
      text: getMessageText(message.parts),
    }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeCardAction(value: unknown): ChatMessageCardAction | undefined {
  if (!isRecord(value) || typeof value.type !== 'string') {
    return undefined
  }

  if (value.type === 'open-note' && typeof value.noteId === 'string') {
    return {
      type: 'open-note',
      noteId: value.noteId,
      parentId: typeof value.parentId === 'string' ? value.parentId : undefined,
      isDeleted: value.isDeleted === true,
    }
  }

  if (value.type === 'open-folder' && typeof value.folderId === 'string') {
    return {
      type: 'open-folder',
      folderId: value.folderId,
      parentId: typeof value.parentId === 'string' ? value.parentId : undefined,
    }
  }

  return undefined
}

function normalizeCardItem(value: unknown): ChatMessageCardItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined

  return {
    action: normalizeCardAction(value.action),
    description: typeof value.description === 'string' ? value.description : undefined,
    id: value.id,
    meta: typeof value.meta === 'string' ? value.meta : undefined,
    tags: tags?.length ? tags : undefined,
    title: value.title,
  }
}

function normalizeCard(value: unknown): ChatMessageCard | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  const items = Array.isArray(value.items)
    ? value.items
        .map(item => normalizeCardItem(item))
        .filter((item): item is ChatMessageCardItem => !!item)
    : undefined

  const status = value.status === 'error' || value.status === 'info' || value.status === 'success' || value.status === 'warning'
    ? value.status
    : undefined

  return {
    description: typeof value.description === 'string' ? value.description : undefined,
    footer: typeof value.footer === 'string' ? value.footer : undefined,
    id: value.id,
    items: items?.length ? items : undefined,
    status,
    title: value.title,
  }
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

    const persistedMessages = parsed
      .filter((message): message is PersistedAiChatMessage => {
        return !!message
          && typeof message.id === 'string'
          && (message.role === 'user' || message.role === 'assistant')
          && typeof message.text === 'string'
      })
    chat.messages = persistedMessages
      .map(message => ({
        id: message.id,
        role: message.role,
        parts: [{
          type: 'text' as const,
          text: message.text,
          state: 'done' as const,
        }],
      }))
    messageCards.value = persistedMessages.reduce<Record<string, ChatMessageCard[]>>((cards, message) => {
      if (!Array.isArray(message.cards)) {
        return cards
      }

      const normalizedCards = message.cards
        .map(card => normalizeCard(card))
        .filter((card): card is ChatMessageCard => !!card)

      if (!normalizedCards.length) {
        return cards
      }

      cards[message.id] = normalizedCards
      return cards
    }, {})
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
  aiChatSession.cancelPendingExecution()
  aiChatSession.lastResults.value = []
  handledAssistantEnvelopeIds.clear()
  lastRequestContext.value = null
  messageCards.value = {}
  persistConversation()
}

function setMessageCards(messageId: string, cards?: ChatMessageCard[]) {
  const nextCards = cards?.length ? cards : []
  if (!nextCards.length) {
    const { [messageId]: _removed, ...rest } = messageCards.value
    messageCards.value = rest
    return
  }

  messageCards.value = {
    ...messageCards.value,
    [messageId]: nextCards,
  }
}

function replaceMessageText(messageId: string, text: string, cards?: ChatMessageCard[]) {
  chat.messages = chat.messages.map((message) => {
    if (message.id !== messageId) {
      return message
    }

    return {
      ...message,
      parts: [{
        type: 'text' as const,
        text,
        state: 'done' as const,
      }],
    }
  })
  setMessageCards(messageId, cards)
}

function appendAssistantMessage(text: string, cards?: ChatMessageCard[]) {
  const content = text.trim()
  if (!content) {
    return
  }

  const messageId = nanoid()
  chat.messages = chat.messages.concat({
    id: messageId,
    role: 'assistant',
    parts: [{
      type: 'text' as const,
      text: content,
      state: 'done' as const,
    }],
  })
  setMessageCards(messageId, cards)
}

async function processLatestAssistantEnvelope() {
  const message = latestAssistantMessage.value
  if (!message || handledAssistantEnvelopeIds.has(message.id)) {
    return
  }

  const envelope = parseAiAssistantToolEnvelope(message.text)
  if (!envelope) {
    handledAssistantEnvelopeIds.add(message.id)
    return
  }

  handledAssistantEnvelopeIds.add(message.id)
  const results = await aiChatSession.submitToolCalls(envelope.toolCalls)
  const summary = aiChatSession.hasPendingConfirmation.value
    ? summarizePreviewResults(results)
    : summarizeExecutionResults(results)
  const cards = createToolResultCards(results)

  replaceMessageText(message.id, mergeAssistantAnswer(envelope.answer, summary), cards)
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
      cards: messageCards.value[message.id] || [],
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

function createChatRequestBody(context?: AiChatRequestContext | null) {
  const normalizedContext = context || null
  lastRequestContext.value = normalizedContext

  if (!normalizedContext) {
    return undefined
  }

  return {
    [AI_CHAT_REQUEST_CONTEXT_BODY_KEY]: normalizedContext,
  }
}

async function sendMessage(text: string, options: {
  requestContext?: AiChatRequestContext | null
} = {}) {
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
  const requestBody = createChatRequestBody(options.requestContext)
  void chat.sendMessage({ text: content }, requestBody ? {
    body: requestBody,
  } : undefined)
    .then(() => processLatestAssistantEnvelope())
    .catch(() => {})
  return true
}

async function regenerate() {
  if (!canRegenerate.value) {
    return false
  }

  chat.clearError()
  const requestBody = createChatRequestBody(lastRequestContext.value)
  await chat.regenerate(requestBody ? {
    body: requestBody,
  } : undefined)
  await processLatestAssistantEnvelope()
  return true
}

async function confirmPendingExecution() {
  const results = await aiChatSession.confirmPendingExecution()
  if (results.length) {
    appendAssistantMessage(summarizeExecutionResults(results), createToolResultCards(results))
  }
  return results
}

function cancelPendingExecution() {
  if (!aiChatSession.hasPendingConfirmation.value) {
    return
  }

  aiChatSession.cancelPendingExecution()
  aiChatSession.lastResults.value = []
  appendAssistantMessage('已取消本次待确认操作。')
}

export function useAiChat() {
  hydrateSettings()
  hydrateConversation()

  return {
    chat,
    clearConversation,
    canRegenerate,
    cancelPendingExecution,
    hasConfiguredProvider,
    hasPendingConfirmation: aiChatSession.hasPendingConfirmation,
    hasVisibleMessages,
    isBusy,
    isAssistantThinking,
    lastToolResults: aiChatSession.lastResults,
    latestAssistantMessage,
    openSettings: () => {
      showSettings.value = true
    },
    providerLabel,
    confirmPendingExecution,
    regenerate,
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

watch(() => messageCards.value, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  persistConversation()
}, { deep: true })
