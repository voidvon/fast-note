import type { UIMessage } from 'ai'
import type { AiAgentTask } from './agent-task'
import type { OpenAiCompatibleChatSettings } from './openai-compatible-chat-transport'
import type { AiChatRequestContext } from './request-context'
import type { AiNoteToolCall, AiToolResult } from '@/shared/types'
import type { ChatMessageBlock, ChatMessageCard, ChatMessageCardAction, ChatMessageCardItem } from '@/shared/ui/chat-message'
import { Chat } from '@ai-sdk/vue'
import { nanoid } from 'nanoid'
import { computed, reactive, ref, watch } from 'vue'
import { useAiChatSession } from '@/processes/ai-chat-session'
import { formatNotePreviewDate, formatNotePreviewLine } from '@/shared/lib/date'
import { createScopedStorageKey } from '@/shared/lib/user-scope'
import { isAiChatAgentEnabled } from './agent-feature-flag'
import {
  createAgentTask,
  getAgentTaskConfirmationModeLabel,
  getAgentTaskRiskLabel,
  normalizeAgentTask,
  restoreAgentTaskAfterReload,
  updateAgentTask,
} from './agent-task'
import {
  extractVisibleAiAssistantText,
  mergeAssistantAnswer,
  parseAiAssistantToolEnvelope,
  summarizeExecutionResults,
  summarizePreviewResults,
} from './assistant-envelope'
import {
  applyAgentMutationPolicy,
  getHighestConfirmationMode,
  getHighestMutationRiskLevel,
} from './mutation-policy'
import {
  DEFAULT_SYSTEM_PROMPT,
  OpenAiCompatibleChatTransport,
  requestOpenAiCompatibleCompletion,
} from './openai-compatible-chat-transport'
import {
  estimateContextBudgetAsync,
  estimateContextBudget,
  formatContextWindowTokens,
  resolveEffectiveContextWindow,
} from './memory/context-budget'
import { describeContextTokenizer } from './memory/context-tokenizer'
import {
  buildDetailedToolResultsPrompt,
} from './memory/context-compression'
import {
  applyConversationSummaryToWorkingMemory,
  applyConversationSummaryToWorkingMemoryAsync,
  createLlmContextSummarizer,
  deterministicContextSummarizer,
} from './memory/context-summary'
import {
  AI_CHAT_REQUEST_CONTEXT_BODY_KEY,
  buildAiChatContextSystemPrompt,
  normalizeAiChatRequestContext,
  omitAiChatRequestContextRoutePath,
} from './request-context'
import {
  createRouteTargetSnapshot,
  isRouteTargetSnapshotMatched,
  readCurrentRouteTargetSnapshot,
} from './route-target-snapshot'
import { createToolResultCards } from './tool-result-cards'
import {
  AI_CHAT_WORKING_MEMORY_BODY_KEY,
  buildAiWorkingMemorySystemPrompt,
  createAiWorkingMemoryFromTask,
  normalizeAiWorkingMemory,
  type AiWorkingMemory,
} from './working-memory'

const AI_CHAT_CONVERSATION_STORAGE_KEY = 'ai-chat-conversation'
const AI_CHAT_AGENT_TASK_STORAGE_KEY = 'ai-chat-agent-task'
const AI_CHAT_WORKING_MEMORY_STORAGE_KEY = 'ai-chat-working-memory'
const AI_CHAT_SETTINGS_STORAGE_KEY = 'ai-chat-settings'
const DEFAULT_MODEL = 'gpt-4.1-mini'

type OpenAiCompatibleChatSettingsInput = Partial<Omit<OpenAiCompatibleChatSettings, 'contextWindowTokens'>> & {
  contextWindowTokens?: number | string
}

function normalizeContextWindowTokens(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }

  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  if (!normalized) {
    return undefined
  }

  const parsed = Number.parseInt(normalized, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }

  return parsed
}

const settingsState = reactive<OpenAiCompatibleChatSettings>({
  apiKey: '',
  baseUrl: '',
  contextWindowTokens: undefined,
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
const messageBlocks = ref<Record<string, ChatMessageBlock[]>>({})
const currentTask = ref<AiAgentTask | null>(null)
const currentWorkingMemory = ref<AiWorkingMemory | null>(null)
const executedMutationFingerprints = ref<string[]>([])
const mutationFingerprintTaskId = ref('')
const MAX_TOOL_LOOP_DEPTH = 3
const agentFeatureEnabled = isAiChatAgentEnabled()
const STREAM_STALL_THRESHOLD_MS = 800
const STREAM_ACTIVITY_TICK_MS = 200
const CONTEXT_SUMMARY_STATE_TRIGGER_FRESHNESS_MS = 60 * 1000
const CONTEXT_SUMMARY_STATE_TRIGGER_MIN_MESSAGES = 12
const streamActivity = reactive({
  firstAssistantMessageId: '',
  firstChunkAt: 0,
  lastChunkAt: 0,
  requestBaselineAssistantMessageId: '',
  requestBaselineAssistantText: '',
  requestStartedAt: 0,
  responseStartedAt: 0,
})
const streamActivityNow = ref(Date.now())
const followUpCompletionRequestCount = ref(0)
let streamActivityTimer: ReturnType<typeof setInterval> | null = null
const CONTEXT_SUMMARIZER_SYSTEM_PROMPT = [
  '你是 fastnote 内部使用的上下文摘要器。',
  '你的职责是把已压缩的会话历史进一步缩短成稳定、可续跑的中文摘要。',
  '只保留任务目标、关键约束、当前进展、关键错误、待确认事项。',
  '不要编造不存在的对象 ID、路径、工具结果或用户意图。',
  '必须按“约束 / 进展 / 阻塞 / 待处理”四个区块输出，没有内容写“无”。',
  '不要使用 Markdown 代码块，不要返回 JSON。',
].join('\n')

export interface AiChatViewMessage {
  blocks: ChatMessageBlock[]
  id: string
  role: 'assistant' | 'user'
  text: string
}

export interface AiChatProgressState {
  description: string
  label: string
}

interface PersistedAiChatMessage extends AiChatViewMessage {
  cards?: ChatMessageCard[]
}

type StreamActivityPhase = 'connecting' | 'idle' | 'responding' | 'stalled' | 'thinking' | 'waiting_first_chunk'

export type AiChatSessionPhase = 'connecting' | 'error' | 'ready' | 'responding' | 'stalled' | 'thinking' | 'unconfigured' | 'waiting_first_chunk'

function getStorageKey() {
  return createScopedStorageKey(AI_CHAT_SETTINGS_STORAGE_KEY)
}

function getConversationStorageKey() {
  return createScopedStorageKey(AI_CHAT_CONVERSATION_STORAGE_KEY)
}

function getAgentTaskStorageKey() {
  return createScopedStorageKey(AI_CHAT_AGENT_TASK_STORAGE_KEY)
}

function getWorkingMemoryStorageKey() {
  return createScopedStorageKey(AI_CHAT_WORKING_MEMORY_STORAGE_KEY)
}

function readLatestAssistantRawMessage() {
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index]
    if (message.role === 'assistant') {
      return {
        blocks: messageBlocks.value[message.id] || [],
        id: message.id,
        role: 'assistant' as const,
        text: getMessageText(message.parts),
      }
    }
  }

  return null
}

function isStreamingStatus(status: typeof chat.status) {
  return status === 'submitted' || status === 'streaming'
}

function resetStreamActivity() {
  streamActivity.firstAssistantMessageId = ''
  streamActivity.firstChunkAt = 0
  streamActivity.lastChunkAt = 0
  streamActivity.requestBaselineAssistantMessageId = ''
  streamActivity.requestBaselineAssistantText = ''
  streamActivity.requestStartedAt = 0
  streamActivity.responseStartedAt = 0
}

function markRequestStarted() {
  const latestMessage = readLatestAssistantRawMessage()
  streamActivity.firstAssistantMessageId = ''
  streamActivity.firstChunkAt = 0
  streamActivity.lastChunkAt = 0
  streamActivity.requestBaselineAssistantMessageId = latestMessage?.id || ''
  streamActivity.requestBaselineAssistantText = latestMessage?.text || ''
  streamActivity.requestStartedAt = Date.now()
  streamActivity.responseStartedAt = 0
  streamActivityNow.value = Date.now()
}

function startStreamActivityTimer() {
  if (streamActivityTimer) {
    return
  }

  streamActivityNow.value = Date.now()
  streamActivityTimer = setInterval(() => {
    streamActivityNow.value = Date.now()
  }, STREAM_ACTIVITY_TICK_MS)
}

function stopStreamActivityTimer() {
  if (!streamActivityTimer) {
    return
  }

  clearInterval(streamActivityTimer)
  streamActivityTimer = null
}

function getEnvDefaults(): OpenAiCompatibleChatSettings {
  return {
    baseUrl: import.meta.env.VITE_AI_CHAT_BASE_URL?.trim() || '',
    apiKey: import.meta.env.VITE_AI_CHAT_API_KEY?.trim() || '',
    contextWindowTokens: normalizeContextWindowTokens(import.meta.env.VITE_AI_CHAT_CONTEXT_WINDOW_TOKENS),
    model: import.meta.env.VITE_AI_CHAT_MODEL?.trim() || DEFAULT_MODEL,
  }
}

function normalizeSettings(settings: OpenAiCompatibleChatSettingsInput): OpenAiCompatibleChatSettings {
  return {
    apiKey: settings.apiKey?.trim() || '',
    baseUrl: settings.baseUrl?.trim() || '',
    contextWindowTokens: normalizeContextWindowTokens(settings.contextWindowTokens),
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
      blocks: messageBlocks.value[message.id] || [],
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

function normalizeLegacyNoteCardMeta(
  action: ChatMessageCardAction | undefined,
  meta: string | undefined,
  description: string | undefined,
) {
  if (action?.type !== 'open-note') {
    return { description, meta }
  }

  const legacyUpdatedMatch = meta?.match(/更新于\s+(.+)$/)
  if (!legacyUpdatedMatch) {
    return {
      description: undefined,
      meta: [meta, description]
        .filter(Boolean)
        .join('\u00A0\u00A0'),
    }
  }

  return {
    description: undefined,
    meta: [formatNotePreviewDate(legacyUpdatedMatch[1]?.trim()), description]
      .filter(Boolean)
      .join('\u00A0\u00A0'),
  }
}

function normalizeCardItem(value: unknown): ChatMessageCardItem | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined
  const action = normalizeCardAction(value.action)
  const description = typeof value.description === 'string' ? value.description : undefined
  const meta = typeof value.meta === 'string' ? value.meta : undefined
  const normalizedSecondary = normalizeLegacyNoteCardMeta(action, meta, description)

  return {
    action,
    description: normalizedSecondary.description,
    id: value.id,
    meta: normalizedSecondary.meta,
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

function normalizeBlock(value: unknown): ChatMessageBlock | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.type !== 'string') {
    return null
  }

  if (value.type === 'text' && typeof value.text === 'string') {
    return {
      id: value.id,
      text: value.text,
      type: 'text',
    }
  }

  if (value.type === 'cards' && Array.isArray(value.cards)) {
    const normalizedCards = value.cards
      .map(card => normalizeCard(card))
      .filter((card): card is ChatMessageCard => !!card)

    if (!normalizedCards.length) {
      return null
    }

    return {
      cards: normalizedCards,
      id: value.id,
      type: 'cards',
    }
  }

  return null
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
    messageBlocks.value = persistedMessages.reduce<Record<string, ChatMessageBlock[]>>((blocks, message) => {
      if (Array.isArray(message.blocks)) {
        const normalizedBlocks = message.blocks
          .map(block => normalizeBlock(block))
          .filter((block): block is ChatMessageBlock => !!block)

        if (normalizedBlocks.length) {
          blocks[message.id] = normalizedBlocks
        }
        return blocks
      }

      if (!Array.isArray(message.cards) || !message.cards.length) {
        return blocks
      }

      const normalizedCards = message.cards
        .map(card => normalizeCard(card))
        .filter((card): card is ChatMessageCard => !!card)

      if (!normalizedCards.length) {
        return blocks
      }

      const legacyBlocks: ChatMessageBlock[] = []
      if (message.text.trim()) {
        legacyBlocks.push({
          id: nanoid(),
          text: message.text.trim(),
          type: 'text',
        })
      }

      legacyBlocks.push({
        cards: normalizedCards,
        id: nanoid(),
        type: 'cards',
      })

      blocks[message.id] = legacyBlocks
      return blocks
    }, {})
  }
  catch {
    localStorage.removeItem(getConversationStorageKey())
  }

  hasHydratedConversation.value = true
}

function hydrateAgentTask() {
  if (!agentFeatureEnabled) {
    setCurrentTask(null)
    return
  }

  if (!hasHydratedConversation.value || typeof localStorage === 'undefined') {
    return
  }

  const stored = localStorage.getItem(getAgentTaskStorageKey())
  if (!stored) {
    setCurrentTask(null)
    return
  }

  try {
    const restoredTask = normalizeAgentTask(JSON.parse(stored))
    setCurrentTask(restoredTask ? restoreAgentTaskAfterReload(restoredTask) : null)
    if (!currentTask.value) {
      localStorage.removeItem(getAgentTaskStorageKey())
    }
  }
  catch {
    setCurrentTask(null)
    localStorage.removeItem(getAgentTaskStorageKey())
  }
}

function hydrateWorkingMemory() {
  if (!agentFeatureEnabled) {
    setCurrentWorkingMemory(null)
    return
  }

  if (!hasHydratedConversation.value || typeof localStorage === 'undefined') {
    return
  }

  const stored = localStorage.getItem(getWorkingMemoryStorageKey())
  if (!stored) {
    setCurrentWorkingMemory(null)
    return
  }

  try {
    const restoredMemory = normalizeAiWorkingMemory(JSON.parse(stored))
    if (!restoredMemory || restoredMemory.taskId !== currentTask.value?.id) {
      setCurrentWorkingMemory(null)
      localStorage.removeItem(getWorkingMemoryStorageKey())
      return
    }

    setCurrentWorkingMemory(restoredMemory)
  }
  catch {
    setCurrentWorkingMemory(null)
    localStorage.removeItem(getWorkingMemoryStorageKey())
  }
}

function persistAgentTask() {
  if (!agentFeatureEnabled) {
    return
  }

  if (typeof localStorage === 'undefined') {
    return
  }

  if (!currentTask.value) {
    localStorage.removeItem(getAgentTaskStorageKey())
    return
  }

  localStorage.setItem(getAgentTaskStorageKey(), JSON.stringify(currentTask.value))
}

function persistWorkingMemory() {
  if (!agentFeatureEnabled || typeof localStorage === 'undefined') {
    return
  }

  if (!currentWorkingMemory.value || currentWorkingMemory.value.taskId !== currentTask.value?.id) {
    localStorage.removeItem(getWorkingMemoryStorageKey())
    return
  }

  localStorage.setItem(getWorkingMemoryStorageKey(), JSON.stringify(currentWorkingMemory.value))
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

function saveSettings(nextSettings: OpenAiCompatibleChatSettingsInput) {
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

function isLikelyAgentTaskRequest(text: string) {
  const normalized = text.trim()
  if (!normalized) {
    return false
  }

  if (/https?:\/\/\S+\/[nf]\//i.test(normalized) || /(?:^|\s)\/[nf]\//i.test(normalized)) {
    return true
  }

  return /读取|打开|搜索|查找|改写|重写|润色|总结|提炼|移动|删除|重命名|新建|创建|锁定|覆盖/.test(normalized)
}

function getLatestUserMessageText() {
  for (let index = chat.messages.length - 1; index >= 0; index -= 1) {
    const message = chat.messages[index]
    if (message.role !== 'user') {
      continue
    }

    const text = getMessageText(message.parts).trim()
    if (text) {
      return text
    }
  }

  return ''
}

function setCurrentWorkingMemory(nextMemory: AiWorkingMemory | null) {
  if (!agentFeatureEnabled) {
    currentWorkingMemory.value = null
    return
  }

  currentWorkingMemory.value = normalizeAiWorkingMemory(nextMemory)
}

function isFreshTimestamp(value: string | undefined, freshnessMs: number, now = Date.now()) {
  if (!value) {
    return false
  }

  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) {
    return false
  }

  return now - timestamp <= freshnessMs
}

function shouldForceConversationSummary(messages: UIMessage[], memory: AiWorkingMemory | null | undefined) {
  const taskStatus = currentTask.value?.status
  if (taskStatus !== 'waiting_confirmation'
    && taskStatus !== 'interrupted'
    && taskStatus !== 'completed'
    && taskStatus !== 'failed') {
    return false
  }

  if (messages.length < CONTEXT_SUMMARY_STATE_TRIGGER_MIN_MESSAGES) {
    return false
  }

  return !memory?.historySummary
    || !isFreshTimestamp(memory.lastCompressionAt, CONTEXT_SUMMARY_STATE_TRIGGER_FRESHNESS_MS)
}

function shouldPrepareConversationSummary(input: {
  context?: AiChatRequestContext | null
  memory: AiWorkingMemory
  pendingMessages?: UIMessage[]
}) {
  const messages = input.pendingMessages?.length
    ? chat.messages.concat(input.pendingMessages)
    : chat.messages
  const contextPrompt = buildAiChatContextSystemPrompt(input.context === undefined ? lastRequestContext.value : input.context)
  const memoryPrompt = buildAiWorkingMemorySystemPrompt(input.memory)
  const budget = estimateContextBudget({
    contextSystemPrompt: contextPrompt,
    contextWindowTokens: settingsState.contextWindowTokens,
    messages,
    model: settingsState.model,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    workingMemory: input.memory,
    workingMemorySystemPrompt: memoryPrompt,
  })

  return {
    budget,
    shouldSummarize: budget.shouldSummarize || shouldForceConversationSummary(messages, input.memory),
  }
}

async function shouldPrepareConversationSummaryAsync(input: {
  context?: AiChatRequestContext | null
  memory: AiWorkingMemory
  pendingMessages?: UIMessage[]
}) {
  const messages = input.pendingMessages?.length
    ? chat.messages.concat(input.pendingMessages)
    : chat.messages
  const contextPrompt = buildAiChatContextSystemPrompt(input.context === undefined ? lastRequestContext.value : input.context)
  const memoryPrompt = buildAiWorkingMemorySystemPrompt(input.memory)
  const budget = await estimateContextBudgetAsync({
    contextSystemPrompt: contextPrompt,
    contextWindowTokens: settingsState.contextWindowTokens,
    messages,
    model: settingsState.model,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    workingMemory: input.memory,
    workingMemorySystemPrompt: memoryPrompt,
  })

  return {
    budget,
    shouldSummarize: budget.shouldSummarize || shouldForceConversationSummary(messages, input.memory),
  }
}

function updateWorkingMemory(input: {
  context?: AiChatRequestContext | null
  lastCompressionReason?: string
  latestToolResultSummary?: string
  pendingMessages?: UIMessage[]
}) {
  if (!agentFeatureEnabled) {
    setCurrentWorkingMemory(null)
    return null
  }

  const baseMemory = createAiWorkingMemoryFromTask(currentTask.value, {
    context: input.context === undefined ? lastRequestContext.value : input.context,
    previous: currentWorkingMemory.value,
    scope: getWorkingMemoryStorageKey(),
    latestToolResultSummary: input.latestToolResultSummary,
    lastCompressionReason: input.lastCompressionReason,
  })
  if (!baseMemory) {
    setCurrentWorkingMemory(null)
    return null
  }

  const messages = input.pendingMessages?.length
    ? chat.messages.concat(input.pendingMessages)
    : chat.messages
  const decision = shouldPrepareConversationSummary({
    context: input.context,
    memory: baseMemory,
    pendingMessages: input.pendingMessages,
  })
  if (!decision.shouldSummarize) {
    setCurrentWorkingMemory(baseMemory)
    return baseMemory
  }

  const nextMemory = applyConversationSummaryToWorkingMemory(
    baseMemory,
    messages,
    {
      lastCompressionReason: input.lastCompressionReason || 'history_summary',
    },
  )
  setCurrentWorkingMemory(nextMemory)
  return nextMemory
}

async function prepareWorkingMemoryForRequest(input: {
  context?: AiChatRequestContext | null
  lastCompressionReason?: string
  latestToolResultSummary?: string
  pendingMessages?: UIMessage[]
}) {
  if (!agentFeatureEnabled) {
    setCurrentWorkingMemory(null)
    return null
  }

  try {
    const baseMemory = createAiWorkingMemoryFromTask(currentTask.value, {
      context: input.context === undefined ? lastRequestContext.value : input.context,
      previous: currentWorkingMemory.value,
      scope: getWorkingMemoryStorageKey(),
      latestToolResultSummary: input.latestToolResultSummary,
      lastCompressionReason: input.lastCompressionReason,
    })

    if (!baseMemory) {
      setCurrentWorkingMemory(null)
      return null
    }

    const messages = input.pendingMessages?.length
      ? chat.messages.concat(input.pendingMessages)
      : chat.messages
    const decision = await shouldPrepareConversationSummaryAsync({
      context: input.context,
      memory: baseMemory,
      pendingMessages: input.pendingMessages,
    })
    if (!decision.shouldSummarize) {
      setCurrentWorkingMemory(baseMemory)
      return baseMemory
    }

    const llmSummarizer = createLlmContextSummarizer({
      async complete({ prompt }) {
        return await requestOpenAiCompatibleCompletion({
          messages: [{
            id: nanoid(),
            role: 'user',
            parts: [{
              type: 'text',
              text: prompt,
              state: 'done',
            }],
          }],
          settings: settingsState,
          systemPrompt: CONTEXT_SUMMARIZER_SYSTEM_PROMPT,
        })
      },
    })

    const nextMemory = await applyConversationSummaryToWorkingMemoryAsync(
      baseMemory,
      messages,
      {
        fallbackSummarizer: deterministicContextSummarizer,
        lastCompressionReason: input.lastCompressionReason || 'history_summary',
        summarizer: llmSummarizer,
      },
    )

    setCurrentWorkingMemory(nextMemory)
    return nextMemory
  }
  catch {
    return updateWorkingMemory(input)
  }
}

function setCurrentTask(nextTask: AiAgentTask | null) {
  if (!agentFeatureEnabled) {
    currentTask.value = null
    currentWorkingMemory.value = null
    mutationFingerprintTaskId.value = ''
    executedMutationFingerprints.value = []
    return
  }

  const nextTaskId = nextTask?.id || ''
  if (mutationFingerprintTaskId.value !== nextTaskId) {
    mutationFingerprintTaskId.value = nextTaskId
    executedMutationFingerprints.value = []
  }

  currentTask.value = nextTask
}

function ensureCurrentTask(fallbackInput = '') {
  if (currentTask.value) {
    return currentTask.value
  }

  const task = createAgentTask(fallbackInput || getLatestUserMessageText() || 'AI 任务')
  setCurrentTask(task)
  return task
}

function updateCurrentTask(
  updater: (task: AiAgentTask) => AiAgentTask | null,
) {
  if (!currentTask.value) {
    return null
  }

  const nextTask = updater(currentTask.value)
  setCurrentTask(nextTask)
  return nextTask
}

function createTaskExecutionContextSnapshot(context: AiChatRequestContext | null | undefined) {
  return omitAiChatRequestContextRoutePath(context)
}

function resolveTaskExecutionContext(task: AiAgentTask | null | undefined, fallbackContext?: AiChatRequestContext | null) {
  return task?.taskContextSnapshot
    || createTaskExecutionContextSnapshot(fallbackContext)
    || null
}

function startAgentTaskIfNeeded(input: string, requestContext?: AiChatRequestContext | null) {
  if (!isLikelyAgentTaskRequest(input)) {
    setCurrentTask(null)
    return null
  }

  const task = createAgentTask(input, createTaskExecutionContextSnapshot(requestContext))
  setCurrentTask(task)
  return task
}

function resumeCurrentTask() {
  if (!currentTask.value) {
    return null
  }

  const currentInput = currentTask.value.input
  const resumedTask = updateAgentTask(currentTask.value, {
    appendStep: {
      kind: 'task',
      title: '已手动继续任务',
      detail: currentInput,
    },
    requiresRelocation: false,
    restoredFromReload: false,
    status: 'identifying',
    terminationReason: 'running',
  })

  setCurrentTask(resumedTask)
  return resumedTask
}

function markTaskCompleted(answerText: string) {
  updateCurrentTask((task) => {
    if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
      return task
    }

    return updateAgentTask(task, {
      appendStep: {
        kind: 'answer',
        title: '已生成最终答复',
        detail: answerText.trim(),
      },
      lastResponseText: answerText.trim(),
      status: 'completed',
      terminationReason: 'answered',
    })
  })
}

function markTaskFailed(title: string, detail: string, terminationReason: AiAgentTask['terminationReason']) {
  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'failure',
      title,
      detail,
      status: 'failed',
    },
    lastError: detail.trim(),
    status: 'failed',
    terminationReason,
  }))
}

function markTaskInterrupted(title: string, detail: string, terminationReason: AiAgentTask['terminationReason']) {
  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'interrupted',
      title,
      detail,
    },
    status: 'interrupted',
    terminationReason,
  }))
}

function isMutationTool(tool: AiNoteToolCall['tool']) {
  return tool === 'create_note'
    || tool === 'update_note'
    || tool === 'move_note'
    || tool === 'delete_note'
    || tool === 'set_note_lock'
}

function sortFingerprintValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sortFingerprintValue(item))
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortFingerprintValue(nested)]),
    )
  }

  return value
}

function normalizeToolCallForFingerprint(call: AiNoteToolCall) {
  if (call.tool !== 'update_note') {
    return {
      payload: sortFingerprintValue(call.payload),
      tool: call.tool,
    }
  }

  const { expectedUpdated, ...payload } = call.payload
  void expectedUpdated

  return {
    payload: sortFingerprintValue(payload),
    tool: call.tool,
  }
}

function getToolCallFingerprint(call: AiNoteToolCall) {
  return JSON.stringify(normalizeToolCallForFingerprint(call))
}

function getDuplicateMutationCalls(calls: AiNoteToolCall[]) {
  const executedFingerprints = new Set(executedMutationFingerprints.value)

  return calls.filter((call) => {
    if (!isMutationTool(call.tool)) {
      return false
    }

    return executedFingerprints.has(getToolCallFingerprint(call))
  })
}

function rememberExecutedMutationCalls(calls: AiNoteToolCall[]) {
  const mutationCalls = calls.filter(call => isMutationTool(call.tool))
  if (!mutationCalls.length) {
    return
  }

  const nextFingerprints = new Set(executedMutationFingerprints.value)
  for (const call of mutationCalls) {
    nextFingerprints.add(getToolCallFingerprint(call))
  }

  executedMutationFingerprints.value = [...nextFingerprints]
}

function buildDuplicateMutationGuardText(calls: AiNoteToolCall[]) {
  const mutationCalls = calls.filter(call => isMutationTool(call.tool))
  if (!mutationCalls.length) {
    return ''
  }

  const duplicateMutationCalls = getDuplicateMutationCalls(calls)
  if (!duplicateMutationCalls.length || duplicateMutationCalls.length !== mutationCalls.length) {
    return ''
  }

  const toolNames = [...new Set(duplicateMutationCalls.map(call => call.tool))].join('、')
  return `检测到模型再次请求执行相同的本地写操作（${toolNames}）。为避免对同一内容反复修改，已拦截这次重复执行，当前结果保持不变。`
}

function clearConversation() {
  chat.messages = []
  chat.clearError()
  aiChatSession.cancelPendingExecution()
  aiChatSession.lastResults.value = []
  followUpCompletionRequestCount.value = 0
  handledAssistantEnvelopeIds.clear()
  lastRequestContext.value = null
  messageBlocks.value = {}
  setCurrentTask(null)
  resetStreamActivity()
  persistConversation()
  persistAgentTask()
  persistWorkingMemory()
}

function normalizeRewriteSuggestion(content: string) {
  const normalized = content.trim()
  if (!normalized) {
    return ''
  }

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(normalized, 'text/html')
    return document.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || ''
  }

  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildRewriteFallbackText(summary: string, answer = '') {
  const suggestion = normalizeRewriteSuggestion(currentTask.value?.lastRewriteSuggestion || '')
  if (!suggestion) {
    return mergeAssistantAnswer(answer, summary)
  }

  return [
    answer.trim() || '写回失败，已保留本次改写结果：',
    '',
    suggestion,
    '',
    summary,
  ].filter(Boolean).join('\n')
}

function applyMutationPolicies(calls: AiNoteToolCall[], taskInput: string, requestContext: AiChatRequestContext | null) {
  const policies = calls.map(call => applyAgentMutationPolicy(call, taskInput, requestContext))
  const riskLevel = getHighestMutationRiskLevel(policies.map(policy => policy.riskLevel))
  const confirmationMode = getHighestConfirmationMode(policies.map(policy => policy.confirmationMode))
  const rewriteSuggestion = policies
    .map(policy => policy.rewriteSuggestion)
    .find(Boolean) || ''

  return {
    confirmationMode,
    riskLevel,
    rewriteSuggestion,
    reasons: policies
      .map(policy => policy.reason)
      .filter(Boolean),
    toolCalls: policies.map(policy => policy.call),
  }
}

function appendMessageText(existingText: string, nextText: string) {
  const normalizedExisting = existingText.trim()
  const normalizedNext = nextText.trim()

  if (!normalizedExisting) {
    return normalizedNext
  }

  if (!normalizedNext || normalizedExisting === normalizedNext || normalizedExisting.endsWith(normalizedNext)) {
    return normalizedExisting
  }

  if (normalizedNext.startsWith(`${normalizedExisting}\n\n`)) {
    return normalizedNext
  }

  return `${normalizedExisting}\n\n${normalizedNext}`
}

function buildTextBlock(text: string): ChatMessageBlock {
  return {
    id: nanoid(),
    text,
    type: 'text',
  }
}

function buildCardsBlock(cards: ChatMessageCard[]): ChatMessageBlock {
  return {
    cards,
    id: nanoid(),
    type: 'cards',
  }
}

function setMessageBlocks(messageId: string, blocks: ChatMessageBlock[]) {
  if (!blocks.length) {
    const { [messageId]: _removed, ...rest } = messageBlocks.value
    messageBlocks.value = rest
    return
  }

  messageBlocks.value = {
    ...messageBlocks.value,
    [messageId]: blocks,
  }
}

function getRenderedTextFromBlocks(blocks: ChatMessageBlock[]) {
  return blocks.reduce((result, block) => {
    if (block.type !== 'text') {
      return result
    }

    return appendMessageText(result, block.text)
  }, '')
}

function getRenderedAssistantText(messageId: string | null | undefined, fallbackText = '') {
  if (!messageId) {
    return fallbackText.trim()
  }

  const blocks = messageBlocks.value[messageId]
  if (!blocks?.length) {
    return fallbackText.trim()
  }

  return getRenderedTextFromBlocks(blocks)
}

function ensureAssistantMessageBlocks(messageId: string, initialText = '') {
  const existingBlocks = messageBlocks.value[messageId]
  if (existingBlocks?.length) {
    return existingBlocks
  }

  const nextBlocks = initialText.trim() ? [buildTextBlock(initialText.trim())] : []
  setMessageBlocks(messageId, nextBlocks)
  return nextBlocks
}

function appendTextBlockToAssistantMessage(messageId: string | null | undefined, text: string) {
  const content = text.trim()
  if (!content) {
    return ''
  }

  if (!messageId) {
    appendAssistantMessage(content)
    return content
  }

  const targetMessage = chat.messages.find(message => message.id === messageId && message.role === 'assistant')
  if (!targetMessage) {
    appendAssistantMessage(content)
    return content
  }

  const blocks = [...ensureAssistantMessageBlocks(messageId, getVisibleAssistantText(messageId, getMessageText(targetMessage.parts)))]
  const lastBlock = blocks.at(-1)

  if (lastBlock?.type === 'text') {
    lastBlock.text = appendMessageText(lastBlock.text, content)
  }
  else {
    blocks.push(buildTextBlock(content))
  }

  setMessageBlocks(messageId, blocks)
  return getRenderedTextFromBlocks(blocks)
}

function appendCardsBlockToAssistantMessage(messageId: string | null | undefined, cards?: ChatMessageCard[]) {
  const nextCards = mergeCards(cards)
  if (!nextCards.length) {
    return []
  }

  if (!messageId) {
    appendAssistantMessage('', nextCards)
    return [buildCardsBlock(nextCards)]
  }

  const targetMessage = chat.messages.find(message => message.id === messageId && message.role === 'assistant')
  if (!targetMessage) {
    appendAssistantMessage('', nextCards)
    return [buildCardsBlock(nextCards)]
  }

  const blocks = [...ensureAssistantMessageBlocks(messageId, getVisibleAssistantText(messageId, getMessageText(targetMessage.parts)))]
  const lastBlock = blocks.at(-1)
  if (lastBlock?.type === 'cards') {
    lastBlock.cards = mergeCards(lastBlock.cards, nextCards)
  }
  else {
    blocks.push(buildCardsBlock(nextCards))
  }

  setMessageBlocks(messageId, blocks)
  return blocks
}

function appendAssistantMessage(text: string, cards?: ChatMessageCard[]) {
  const content = text.trim()
  const nextCards = mergeCards(cards)
  if (!content && !nextCards.length) {
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

  const blocks: ChatMessageBlock[] = []
  if (content) {
    blocks.push(buildTextBlock(content))
  }
  if (nextCards.length) {
    blocks.push(buildCardsBlock(nextCards))
  }
  setMessageBlocks(messageId, blocks)
}

function mergeCards(...groups: Array<ChatMessageCard[] | undefined>) {
  const merged = groups.flatMap(group => group || [])
  if (!merged.length) {
    return []
  }

  const seenIds = new Set<string>()
  return merged.filter((card) => {
    if (seenIds.has(card.id)) {
      return false
    }

    seenIds.add(card.id)
    return true
  })
}

function createTextMessage(role: 'assistant' | 'system' | 'user', text: string): UIMessage {
  return {
    id: nanoid(),
    role,
    parts: [{
      type: 'text' as const,
      text,
      state: 'done' as const,
    }],
  }
}

function createHiddenSystemMessage(text: string): UIMessage {
  return createTextMessage('system', text)
}

function buildToolLoopPrompt(
  resultsSummary: string,
  results: AiToolResult[],
  requestContext?: AiChatRequestContext | null,
  options: {
    finalAnswerOnly?: boolean
  } = {},
) {
  const contextPrompt = buildAiChatContextSystemPrompt(requestContext || null)
  return [
    '以下是你刚才请求的本地工具执行结果，请继续完成用户上一条请求。',
    options.finalAnswerOnly
      ? '相关本地写操作已经执行完成。你现在只能输出自然语言最终答复，不要返回 JSON，不要再次请求任何工具，也不要再次要求用户确认。'
      : '如果当前信息已足够，请直接输出自然语言最终答复，不要再解释 JSON 格式。',
    options.finalAnswerOnly
      ? '如果需要提及执行结果，请基于下方工具结果直接总结给用户，不要重复描述将要执行的动作。'
      : '如果用户要的是主题筛选、汇总或总结，而当前结果只有搜索列表、不足以支撑可靠结论，请继续调用 get_note_detail 读取相关备忘录正文，不要停在“已帮你筛出结果”。',
    options.finalAnswerOnly
      ? ''
      : '如果仍需进一步读取或执行其他本地工具，请继续只返回合法 JSON 工具请求。',
    contextPrompt ? `附加上下文：\n${contextPrompt}` : '',
    `工具执行摘要：\n${resultsSummary}`,
    `工具详细返回：\n${buildDetailedToolResultsPrompt(results)}`,
  ].filter(Boolean).join('\n\n')
}

async function continueAssistantAfterToolResults(
  resultsSummary: string,
  results: AiToolResult[],
  options: {
    finalAnswerOnly?: boolean
  } = {},
) {
  hydrateSettings()
  const followUpSystemMessage = createHiddenSystemMessage(buildToolLoopPrompt(resultsSummary, results, lastRequestContext.value, options))
  const preparedWorkingMemory = updateWorkingMemory({
    context: lastRequestContext.value,
    lastCompressionReason: 'tool_results',
    latestToolResultSummary: resultsSummary,
    pendingMessages: [followUpSystemMessage],
  })

  const followUpMessages = chat.messages.concat(followUpSystemMessage)

  followUpCompletionRequestCount.value += 1

  try {
    return await requestOpenAiCompatibleCompletion({
      body: createChatRequestBody(lastRequestContext.value, preparedWorkingMemory),
      messages: followUpMessages,
      settings: settingsState,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    })
  }
  finally {
    followUpCompletionRequestCount.value = Math.max(0, followUpCompletionRequestCount.value - 1)
  }
}

function shouldFinalizeAfterToolResults(calls: AiNoteToolCall[]) {
  return calls.some(call => isMutationTool(call.tool))
}

function extractSafeFollowUpText(rawText: string, summary: string) {
  const envelope = parseAiAssistantToolEnvelope(rawText)
  if (!envelope) {
    return rawText.trim()
  }

  return summary
}

async function resolveAssistantToolLoop(
  rawText: string,
  depth = 0,
  messageId?: string | null,
  appendEnvelopeAnswer = false,
): Promise<{ cards: ChatMessageCard[], text: string }> {
  const envelope = parseAiAssistantToolEnvelope(rawText)
  if (!envelope) {
    const text = rawText.trim()
    appendTextBlockToAssistantMessage(messageId, text)
    return {
      cards: [],
      text: getRenderedAssistantText(messageId, text),
    }
  }

  if (appendEnvelopeAnswer && envelope.answer?.trim()) {
    appendTextBlockToAssistantMessage(messageId, envelope.answer)
  }

  const mutationPolicies = applyMutationPolicies(
    envelope.toolCalls,
    currentTask.value?.input || getLatestUserMessageText(),
    lastRequestContext.value,
  )
  const duplicateMutationText = buildDuplicateMutationGuardText(mutationPolicies.toolCalls)
  if (duplicateMutationText) {
    updateCurrentTask(task => updateAgentTask(task, {
      appendStep: {
        kind: 'interrupted',
        title: '已拦截重复本地修改请求',
        detail: duplicateMutationText,
      },
      terminationReason: 'running',
    }))
    appendTextBlockToAssistantMessage(messageId, duplicateMutationText)
    return {
      cards: [],
      text: getRenderedAssistantText(messageId, duplicateMutationText),
    }
  }

  const mutationMeta = [
    getAgentTaskRiskLabel(mutationPolicies.riskLevel),
    getAgentTaskConfirmationModeLabel(mutationPolicies.confirmationMode),
    ...mutationPolicies.reasons,
  ].filter(Boolean).join('｜')

  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'tool_call',
      title: '模型请求执行本地工具',
      detail: [mutationPolicies.toolCalls.map(call => call.tool).join('、'), mutationMeta].filter(Boolean).join('｜'),
    },
    confirmationMode: mutationPolicies.confirmationMode,
    lastRewriteSuggestion: mutationPolicies.rewriteSuggestion || task.lastRewriteSuggestion,
    riskLevel: mutationPolicies.riskLevel,
    status: 'executing',
    terminationReason: 'running',
  }))

  const results = await aiChatSession.submitToolCalls(mutationPolicies.toolCalls)
  const cards = createToolResultCards(results)
  const summary = aiChatSession.hasPendingConfirmation.value
    ? summarizePreviewResults(results)
    : summarizeExecutionResults(results)

  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'tool_result',
      title: aiChatSession.hasPendingConfirmation.value ? '已生成执行预览' : '本地工具执行完成',
      detail: summary,
      status: results.every(result => result.ok) ? 'completed' : 'failed',
    },
    lastError: results.every(result => result.ok) ? task.lastError : summary,
    status: results.every(result => result.ok) ? 'executing' : 'failed',
    terminationReason: results.every(result => result.ok) ? 'running' : 'tool_failed',
  }))

  if (!results.every(result => result.ok)) {
    const fallbackText = buildRewriteFallbackText(summary)
    appendCardsBlockToAssistantMessage(messageId, cards)
    appendTextBlockToAssistantMessage(messageId, fallbackText)
    return {
      cards,
      text: getRenderedAssistantText(messageId, fallbackText),
    }
  }

  appendCardsBlockToAssistantMessage(messageId, cards)
  if (!aiChatSession.hasPendingConfirmation.value) {
    rememberExecutedMutationCalls(mutationPolicies.toolCalls)
  }

  if (aiChatSession.hasPendingConfirmation.value || depth >= MAX_TOOL_LOOP_DEPTH) {
    if (aiChatSession.hasPendingConfirmation.value) {
      updateCurrentTask(task => updateAgentTask(task, {
        appendStep: {
          kind: 'confirmation',
          title: '等待你确认执行',
          detail: summary,
        },
        status: 'waiting_confirmation',
        terminationReason: 'waiting_confirmation',
      }))
    }
    else {
      markTaskInterrupted('已达到最大续跑深度', summary, 'max_depth')
    }

    appendTextBlockToAssistantMessage(messageId, summary)
    return {
      cards,
      text: getRenderedAssistantText(messageId, summary),
    }
  }

  const finalizeAfterMutation = shouldFinalizeAfterToolResults(mutationPolicies.toolCalls)

  try {
    const followUpText = await continueAssistantAfterToolResults(summary, results, {
      finalAnswerOnly: finalizeAfterMutation,
    })

    if (finalizeAfterMutation) {
      const safeFollowUpText = extractSafeFollowUpText(followUpText, summary)
      appendTextBlockToAssistantMessage(messageId, safeFollowUpText)
      return {
        cards,
        text: getRenderedAssistantText(messageId, safeFollowUpText),
      }
    }

    const nested = await resolveAssistantToolLoop(followUpText, depth + 1, messageId, true)
    return {
      cards: mergeCards(cards, nested.cards),
      text: getRenderedAssistantText(messageId, nested.text),
    }
  }
  catch {
    markTaskFailed('工具续跑失败', summary, 'request_failed')
    appendTextBlockToAssistantMessage(messageId, summary)
    return {
      cards,
      text: getRenderedAssistantText(messageId, summary),
    }
  }
}

async function resolveAssistantMessageWithoutAgent(rawText: string): Promise<{ cards: ChatMessageCard[], text: string }> {
  const envelope = parseAiAssistantToolEnvelope(rawText)
  if (!envelope) {
    return {
      cards: [],
      text: rawText.trim(),
    }
  }

  const mutationPolicies = applyMutationPolicies(
    envelope.toolCalls,
    getLatestUserMessageText(),
    lastRequestContext.value,
  )
  const results = await aiChatSession.submitToolCalls(mutationPolicies.toolCalls)
  const cards = createToolResultCards(results)
  const summary = aiChatSession.hasPendingConfirmation.value
    ? summarizePreviewResults(results)
    : summarizeExecutionResults(results)

  if (!results.every(result => result.ok)) {
    return {
      cards,
      text: buildRewriteFallbackText(summary),
    }
  }

  return {
    cards,
    text: summary,
  }
}

async function processLatestAssistantEnvelope() {
  const message = readLatestAssistantRawMessage()
  if (!message || handledAssistantEnvelopeIds.has(message.id)) {
    return
  }

  const envelope = parseAiAssistantToolEnvelope(message.text)
  if (!envelope) {
    handledAssistantEnvelopeIds.add(message.id)
    if (currentTask.value && (currentTask.value.status === 'identifying' || currentTask.value.status === 'executing')) {
      markTaskCompleted(message.text)
    }
    return
  }

  handledAssistantEnvelopeIds.add(message.id)

  if (!agentFeatureEnabled) {
    const resolved = await resolveAssistantMessageWithoutAgent(message.text)
    appendCardsBlockToAssistantMessage(message.id, resolved.cards)
    appendTextBlockToAssistantMessage(message.id, resolved.text)
    return
  }

  ensureCurrentTask()
  const resolved = await resolveAssistantToolLoop(message.text, 0, message.id)
  if (currentTask.value && (currentTask.value.status === 'identifying' || currentTask.value.status === 'executing')) {
    markTaskCompleted(resolved.text)
  }
}

function getMessageText(parts: UIMessage['parts']) {
  return parts
    .filter(part => part.type === 'text' || part.type === 'reasoning')
    .map(part => part.text)
    .join('')
}

function getVisibleAssistantText(messageId: string, rawText: string) {
  const customBlocks = messageBlocks.value[messageId]
  if (customBlocks?.length) {
    return getRenderedTextFromBlocks(customBlocks)
  }

  return extractVisibleAiAssistantText(rawText)
}

function getVisibleMessageBlocks(message: UIMessage & { role: AiChatViewMessage['role'] }) {
  const customBlocks = messageBlocks.value[message.id]
  if (customBlocks?.length) {
    return customBlocks
  }

  const rawText = getMessageText(message.parts)
  const visibleText = message.role === 'assistant' ? getVisibleAssistantText(message.id, rawText) : rawText
  if (!visibleText.trim()) {
    return []
  }

  return [{
    id: `${message.id}:text`,
    text: visibleText,
    type: 'text' as const,
  }]
}

const hasConfiguredProvider = computed(() => {
  hydrateSettings()
  return !!settingsState.baseUrl && !!settingsState.apiKey && !!settingsState.model
})

const isBusy = computed(() => isStreamingStatus(chat.status))
const visibleMessages = computed<AiChatViewMessage[]>(() => {
  return chat.messages
    .filter((message): message is UIMessage & { role: AiChatViewMessage['role'] } => {
      return message.role === 'user' || message.role === 'assistant'
    })
    .map((message) => {
      const rawText = getMessageText(message.parts)
      const blocks = getVisibleMessageBlocks(message)
      return {
        blocks,
        id: message.id,
        role: message.role,
        text: message.role === 'assistant' ? getVisibleAssistantText(message.id, rawText) : rawText,
      }
    })
    .filter((message) => {
      if (message.role !== 'assistant') {
        return true
      }

      return !!message.text.trim() || message.blocks.length > 0
    })
})
const latestAssistantRawMessage = computed(() => readLatestAssistantRawMessage())
const latestAssistantMessage = computed(() => {
  const message = latestAssistantRawMessage.value
  if (!message) {
    return null
  }

  return {
    ...message,
    text: getVisibleAssistantText(message.id, message.text),
  }
})
const hasVisibleStreamingAssistantMessage = computed(() => {
  if (!isBusy.value) {
    return false
  }

  if (!streamActivity.firstAssistantMessageId || !latestAssistantMessage.value?.text.trim()) {
    return false
  }

  return latestAssistantMessage.value.id === streamActivity.firstAssistantMessageId
})
const streamingAssistantMessageId = computed(() => {
  if (!isBusy.value) {
    return null
  }

  return latestAssistantRawMessage.value?.id || null
})
const streamActivityPhase = computed<StreamActivityPhase>(() => {
  if (followUpCompletionRequestCount.value > 0) {
    return 'thinking'
  }

  if (!isBusy.value) {
    return 'idle'
  }

  if (chat.status === 'submitted') {
    return 'connecting'
  }

  if (!streamActivity.firstAssistantMessageId) {
    return 'waiting_first_chunk'
  }

  if (!latestAssistantMessage.value?.text.trim()) {
    return 'thinking'
  }

  if (streamActivity.lastChunkAt && streamActivityNow.value - streamActivity.lastChunkAt > STREAM_STALL_THRESHOLD_MS) {
    return 'stalled'
  }

  return 'responding'
})
const hasVisibleMessages = computed(() => visibleMessages.value.length > 0)
const canRegenerate = computed(() => hasVisibleMessages.value && !isBusy.value)
const providerLabel = computed(() => settingsState.model.trim() || '未配置模型')
const contextWindowHint = computed(() => {
  const resolved = resolveEffectiveContextWindow(settingsState.model, settingsState.contextWindowTokens)
  const tokenLabel = formatContextWindowTokens(resolved.contextWindowTokens)

  switch (resolved.source) {
    case 'configured':
      return `当前按手动配置使用 ${tokenLabel} tokens`
    case 'profile':
      return `当前按模型档案推断为 ${tokenLabel} tokens (${resolved.label})`
    case 'suffix_hint':
      return `当前按模型名后缀推断为 ${tokenLabel} tokens`
    default:
      return `当前使用默认回退值 ${tokenLabel} tokens`
  }
})
const tokenizerHint = computed(() => {
  const resolved = describeContextTokenizer(settingsState.model)
  const implementationLabel = resolved.implementation === 'tiktoken' ? '真实 tokenizer' : 'heuristic tokenizer'
  switch (resolved.source) {
    case 'profile':
      return `当前按模型档案使用 ${implementationLabel}：${resolved.label}`
    case 'custom':
      return `当前使用自定义 tokenizer：${resolved.label}`
    default:
      return `当前使用默认 ${implementationLabel}：${resolved.label}`
  }
})
const contextRemainingPercent = computed(() => {
  const memoryPrompt = buildAiWorkingMemorySystemPrompt(currentWorkingMemory.value)
  const estimate = estimateContextBudget({
    contextSystemPrompt: buildAiChatContextSystemPrompt(lastRequestContext.value),
    contextWindowTokens: settingsState.contextWindowTokens,
    messages: chat.messages,
    model: settingsState.model,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    workingMemory: currentWorkingMemory.value,
    workingMemorySystemPrompt: memoryPrompt,
  })
  const remainingRatio = estimate.dynamicBudgetTokens > 0
    ? Math.max(0, Math.min(1, estimate.remainingInputTokens / estimate.dynamicBudgetTokens))
    : 0
  return Math.round(remainingRatio * 100)
})
const sessionPhase = computed<AiChatSessionPhase>(() => {
  if (!hasConfiguredProvider.value) {
    return 'unconfigured'
  }

  if (chat.error) {
    return 'error'
  }

  switch (streamActivityPhase.value) {
    case 'connecting':
      return 'connecting'
    case 'waiting_first_chunk':
      return 'waiting_first_chunk'
    case 'thinking':
      return 'thinking'
    case 'stalled':
      return 'stalled'
    case 'responding':
      return 'responding'
    case 'idle':
    default:
      break
  }

  return 'ready'
})
const conversationProgress = computed<AiChatProgressState | null>(() => {
  if (hasVisibleStreamingAssistantMessage.value) {
    return null
  }

  switch (sessionPhase.value) {
    case 'connecting':
      return {
        label: '正在连接 AI...',
        description: '',
      }
    case 'waiting_first_chunk':
      return {
        label: '连接成功，等待 AI 开始响应...',
        description: '',
      }
    case 'thinking':
      return {
        label: 'AI 思考中',
        description: '',
      }
    case 'responding':
      return {
        label: 'AI 正在生成回复',
        description: '',
      }
    case 'stalled':
      return {
        label: '响应变慢，仍在继续...',
        description: '',
      }
    default:
      break
  }
  return null
})

function createChatRequestBody(context?: AiChatRequestContext | null, workingMemoryOverride?: AiWorkingMemory | null) {
  const normalizedContext = normalizeAiChatRequestContext(context)
  lastRequestContext.value = normalizedContext
  const workingMemory = workingMemoryOverride === undefined
    ? (currentWorkingMemory.value || updateWorkingMemory({
        context: normalizedContext,
        lastCompressionReason: 'request_prepare',
      }))
    : workingMemoryOverride

  if (!normalizedContext && !workingMemory) {
    return undefined
  }

  return {
    [AI_CHAT_REQUEST_CONTEXT_BODY_KEY]: normalizedContext,
    [AI_CHAT_WORKING_MEMORY_BODY_KEY]: workingMemory,
  }
}

async function sendMessage(text: string, options: {
  reuseCurrentTask?: boolean
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
  const requestContext = options.reuseCurrentTask
    ? resolveTaskExecutionContext(currentTask.value, options.requestContext)
    : createTaskExecutionContextSnapshot(options.requestContext)

  if (agentFeatureEnabled) {
    if (options.reuseCurrentTask) {
      resumeCurrentTask()
    }
    else {
      startAgentTaskIfNeeded(content, requestContext)
      updateCurrentTask(task => updateAgentTask(task, {
        routeTargetSnapshot: createRouteTargetSnapshot(options.requestContext || null),
        taskContextSnapshot: requestContext,
      }))
    }
  }

  const preparedWorkingMemory = updateWorkingMemory({
    context: requestContext,
    lastCompressionReason: 'request_prepare',
    pendingMessages: [createTextMessage('user', content)],
  })
  const requestBody = createChatRequestBody(requestContext, preparedWorkingMemory)
  void chat.sendMessage(
    { text: content },
    requestBody
      ? {
          body: requestBody,
        }
      : undefined,
  )
    .then(() => processLatestAssistantEnvelope())
    .catch((error) => {
      if (agentFeatureEnabled && currentTask.value?.status === 'identifying') {
        markTaskFailed('请求发送失败', error instanceof Error ? error.message : 'AI 请求失败', 'request_failed')
      }
    })
  return true
}

async function resumeInterruptedTask(options: {
  requestContext?: AiChatRequestContext | null
} = {}) {
  if (!agentFeatureEnabled) {
    return false
  }

  if (!currentTask.value || currentTask.value.status !== 'interrupted') {
    return false
  }

  if (currentTask.value.requiresRelocation) {
    return false
  }

  return await sendMessage(currentTask.value.input, {
    requestContext: resolveTaskExecutionContext(currentTask.value, options.requestContext),
    reuseCurrentTask: true,
  })
}

async function regenerate() {
  if (!canRegenerate.value) {
    return false
  }

  chat.clearError()
  const preparedWorkingMemory = updateWorkingMemory({
    context: lastRequestContext.value,
    lastCompressionReason: 'regenerate_prepare',
  })
  const requestBody = createChatRequestBody(lastRequestContext.value, preparedWorkingMemory)
  await chat.regenerate(
    requestBody
      ? {
          body: requestBody,
        }
      : undefined,
  )
  await processLatestAssistantEnvelope()
  return true
}

async function confirmPendingExecution() {
  const confirmedCalls = aiChatSession.pendingExecution?.value?.calls || []
  const results = await aiChatSession.confirmPendingExecution()
  if (!results.length) {
    return results
  }

  const summary = summarizeExecutionResults(results)
  const cards = createToolResultCards(results)
  const continuationMessageId = readLatestAssistantRawMessage()?.id || null

  if (!agentFeatureEnabled) {
    appendCardsBlockToAssistantMessage(continuationMessageId, cards)
    appendTextBlockToAssistantMessage(
      continuationMessageId,
      results.every(result => result.ok) ? summary : buildRewriteFallbackText(summary),
    )
    return results
  }

  if (!results.every(result => result.ok)) {
    const fallbackText = buildRewriteFallbackText(summary)
    appendCardsBlockToAssistantMessage(continuationMessageId, cards)
    const combinedText = appendTextBlockToAssistantMessage(continuationMessageId, fallbackText)
    updateCurrentTask(task => updateAgentTask(task, {
      appendStep: {
        kind: 'tool_result',
        title: '已确认并执行本地工具',
        detail: summary,
        status: 'failed',
      },
      lastError: summary,
      lastResponseText: combinedText,
      status: 'failed',
      terminationReason: 'tool_failed',
    }))
    return results
  }

  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'tool_result',
      title: '已确认并执行本地工具',
      detail: summary,
      status: 'completed',
    },
    lastError: '',
    status: 'executing',
    terminationReason: 'running',
  }))
  rememberExecutedMutationCalls(confirmedCalls)

  appendCardsBlockToAssistantMessage(continuationMessageId, cards)

  const finalizeAfterMutation = shouldFinalizeAfterToolResults(confirmedCalls)

  try {
    const followUpText = await continueAssistantAfterToolResults(summary, results, {
      finalAnswerOnly: finalizeAfterMutation,
    })

    if (finalizeAfterMutation) {
      const safeFollowUpText = extractSafeFollowUpText(followUpText, summary)
      const combinedText = appendTextBlockToAssistantMessage(continuationMessageId, safeFollowUpText)
      if (currentTask.value && (currentTask.value.status === 'identifying' || currentTask.value.status === 'executing')) {
        markTaskCompleted(combinedText)
      }
      return results
    }

    const resolved = await resolveAssistantToolLoop(followUpText, 1, continuationMessageId, true)
    if (currentTask.value && (currentTask.value.status === 'identifying' || currentTask.value.status === 'executing')) {
      markTaskCompleted(resolved.text)
    }
  }
  catch {
    const combinedText = appendTextBlockToAssistantMessage(continuationMessageId, summary)
    updateCurrentTask(task => updateAgentTask(task, {
      lastResponseText: combinedText,
      status: 'completed',
      terminationReason: 'answered',
    }))
  }

  return results
}

function cancelPendingExecution() {
  if (!aiChatSession.hasPendingConfirmation.value) {
    return
  }

  aiChatSession.cancelPendingExecution()
  aiChatSession.lastResults.value = []
  appendTextBlockToAssistantMessage(readLatestAssistantRawMessage()?.id || null, '已取消本次待确认操作。')
  updateCurrentTask(task => updateAgentTask(task, {
    appendStep: {
      kind: 'failure',
      title: '已取消待确认操作',
      detail: '你取消了本次待确认任务。',
    },
    status: 'cancelled',
    terminationReason: 'cancelled',
  }))
}

watch(() => chat.status, (nextStatus, previousStatus) => {
  if (nextStatus === 'submitted' && previousStatus !== 'submitted') {
    markRequestStarted()
    return
  }

  if (nextStatus === 'streaming') {
    if (!streamActivity.requestStartedAt) {
      markRequestStarted()
    }

    if (!streamActivity.responseStartedAt) {
      streamActivity.responseStartedAt = Date.now()
    }

    return
  }

  if (!isStreamingStatus(nextStatus)) {
    resetStreamActivity()
    streamActivityNow.value = Date.now()
  }
})

watch(
  () => latestAssistantRawMessage.value
    ? `${latestAssistantRawMessage.value.id}\n${latestAssistantRawMessage.value.text}`
    : '',
  (snapshot) => {
    if (!isBusy.value || !snapshot) {
      return
    }

    const message = latestAssistantRawMessage.value
    if (!message) {
      return
    }

    const isCurrentRequestMessage = message.id !== streamActivity.requestBaselineAssistantMessageId
      || message.text !== streamActivity.requestBaselineAssistantText

    if (!isCurrentRequestMessage) {
      return
    }

    if (!streamActivity.firstAssistantMessageId) {
      streamActivity.firstAssistantMessageId = message.id
    }

    if (!message.text) {
      return
    }

    const now = Date.now()
    if (!streamActivity.firstChunkAt) {
      streamActivity.firstChunkAt = now
    }
    streamActivity.lastChunkAt = now
    streamActivityNow.value = now
  },
)

watch(isBusy, (busy) => {
  if (busy) {
    startStreamActivityTimer()
    return
  }

  stopStreamActivityTimer()
  streamActivityNow.value = Date.now()
}, { immediate: true })

export function useAiChat() {
  hydrateSettings()
  hydrateConversation()
  hydrateAgentTask()
  hydrateWorkingMemory()

  return {
    chat,
    clearConversation,
    canRegenerate,
    cancelPendingExecution,
    contextRemainingPercent,
    contextWindowHint,
    tokenizerHint,
    hasConfiguredProvider,
    hasPendingConfirmation: aiChatSession.hasPendingConfirmation,
    hasVisibleMessages,
    isBusy,
    canResumeInterruptedTask: computed(() => {
      if (!agentFeatureEnabled) {
        return false
      }

      if (!currentTask.value || currentTask.value.status !== 'interrupted' || isBusy.value) {
        return false
      }

      return currentTask.value.requiresRelocation !== true
    }),
    hasTaskRouteMismatch: computed(() => {
      if (!agentFeatureEnabled || !currentTask.value?.routeTargetSnapshot) {
        return false
      }

      return !isRouteTargetSnapshotMatched(currentTask.value.routeTargetSnapshot, readCurrentRouteTargetSnapshot())
    }),
    currentTask,
    currentWorkingMemory,
    isAgentEnabled: agentFeatureEnabled,
    lastToolResults: aiChatSession.lastResults,
    latestAssistantMessage,
    openSettings: () => {
      showSettings.value = true
    },
    providerLabel,
    confirmPendingExecution,
    conversationProgress,
    regenerate,
    resetSettings,
    resumeInterruptedTask,
    saveSettings,
    sendMessage,
    sessionPhase,
    settings: settingsState,
    showSettings,
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

watch(() => messageBlocks.value, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  persistConversation()
}, { deep: true })

watch(() => currentTask.value, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  updateWorkingMemory({
    context: lastRequestContext.value,
    lastCompressionReason: 'task_sync',
  })
  persistAgentTask()
}, { deep: true })

watch(() => currentWorkingMemory.value, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  persistWorkingMemory()
}, { deep: true })
