import type { UIMessage } from 'ai'
import type { OpenAiCompatibleChatSettings } from './openai-compatible-chat-transport'
import type { AiChatRequestContext } from './request-context'
import type { AiAgentTask } from './agent-task'
import type { ChatMessageCard, ChatMessageCardAction, ChatMessageCardItem } from '@/shared/ui/chat-message'
import type { AiNoteToolCall, AiToolResult } from '@/shared/types'
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
import {
  createAgentTask,
  getAgentTaskConfirmationModeLabel,
  getAgentTaskRiskLabel,
  getAgentTaskStatusLabel,
  normalizeAgentTask,
  restoreAgentTaskAfterReload,
  updateAgentTask,
} from './agent-task'
import {
  applyAgentMutationPolicy,
  getHighestConfirmationMode,
  getHighestMutationRiskLevel,
} from './mutation-policy'
import {
  createRouteTargetSnapshot,
  isRouteTargetSnapshotMatched,
  readCurrentRouteTargetSnapshot,
} from './route-target-snapshot'
import {
  DEFAULT_SYSTEM_PROMPT,
  OpenAiCompatibleChatTransport,
  requestOpenAiCompatibleCompletion,
} from './openai-compatible-chat-transport'
import { isAiChatAgentEnabled } from './agent-feature-flag'
import { AI_CHAT_REQUEST_CONTEXT_BODY_KEY, buildAiChatContextSystemPrompt } from './request-context'
import { createToolResultCards } from './tool-result-cards'

const AI_CHAT_CONVERSATION_STORAGE_KEY = 'ai-chat-conversation'
const AI_CHAT_AGENT_TASK_STORAGE_KEY = 'ai-chat-agent-task'
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
const currentTask = ref<AiAgentTask | null>(null)
const MAX_TOOL_LOOP_DEPTH = 3
const agentFeatureEnabled = isAiChatAgentEnabled()

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

function getAgentTaskStorageKey() {
  return createScopedStorageKey(AI_CHAT_AGENT_TASK_STORAGE_KEY)
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

function hydrateAgentTask() {
  if (!agentFeatureEnabled) {
    currentTask.value = null
    return
  }

  if (!hasHydratedConversation.value || typeof localStorage === 'undefined') {
    return
  }

  const stored = localStorage.getItem(getAgentTaskStorageKey())
  if (!stored) {
    currentTask.value = null
    return
  }

  try {
    const restoredTask = normalizeAgentTask(JSON.parse(stored))
    currentTask.value = restoredTask ? restoreAgentTaskAfterReload(restoredTask, readCurrentRouteTargetSnapshot()) : null
    if (!currentTask.value) {
      localStorage.removeItem(getAgentTaskStorageKey())
    }
  }
  catch {
    currentTask.value = null
    localStorage.removeItem(getAgentTaskStorageKey())
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

function isLikelyAgentTaskRequest(text: string) {
  const normalized = text.trim()
  if (!normalized) {
    return false
  }

  if (/https?:\/\/\S+\/[nf]\//i.test(normalized) || /(?:^|\s)\/[nf]\//i.test(normalized)) {
    return true
  }

  return /(读取|打开|搜索|查找|改写|重写|润色|总结|提炼|移动|删除|重命名|新建|创建|锁定|覆盖)/.test(normalized)
}

function getLatestUserMessageText() {
  for (let index = visibleMessages.value.length - 1; index >= 0; index -= 1) {
    const message = visibleMessages.value[index]
    if (message.role === 'user' && message.text.trim()) {
      return message.text.trim()
    }
  }

  return ''
}

function setCurrentTask(nextTask: AiAgentTask | null) {
  if (!agentFeatureEnabled) {
    currentTask.value = null
    return
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

function startAgentTaskIfNeeded(input: string) {
  if (!isLikelyAgentTaskRequest(input)) {
    setCurrentTask(null)
    return null
  }

  const task = createAgentTask(input)
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

function clearConversation() {
  chat.messages = []
  chat.clearError()
  aiChatSession.cancelPendingExecution()
  aiChatSession.lastResults.value = []
  handledAssistantEnvelopeIds.clear()
  lastRequestContext.value = null
  messageCards.value = {}
  currentTask.value = null
  persistConversation()
  persistAgentTask()
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

function createHiddenSystemMessage(text: string): UIMessage {
  return {
    id: nanoid(),
    role: 'system',
    parts: [{
      type: 'text' as const,
      text,
      state: 'done' as const,
    }],
  }
}

function formatToolResultData(result: AiToolResult) {
  if (!result.data) {
    return ''
  }

  if (Array.isArray(result.data)) {
    return result.data.length
      ? `返回数据：\n${JSON.stringify(result.data, null, 2)}`
      : '返回数据：空列表'
  }

  if (typeof result.data === 'object' && result.data !== null && 'note' in result.data) {
    const notePayload = result.data as {
      note?: Record<string, unknown>
      source?: string
    }
    const note = notePayload.note
    if (!note || typeof note !== 'object') {
      return ''
    }

    return [
      '返回数据：',
      `noteId: ${typeof note.id === 'string' ? note.id : ''}`,
      `title: ${typeof note.title === 'string' ? note.title : ''}`,
      `summary: ${typeof note.summary === 'string' ? note.summary : ''}`,
      `updated: ${typeof note.updated === 'string' ? note.updated : ''}`,
      `readSource: ${typeof notePayload.source === 'string' ? notePayload.source : ''}`,
      `contentHtml:\n${typeof note.content === 'string' ? note.content : ''}`,
    ].join('\n')
  }

  return `返回数据：\n${JSON.stringify(result.data, null, 2)}`
}

function buildDetailedToolResultsPrompt(results: AiToolResult[]) {
  return results.map((result, index) => {
    const lines = [
      `工具结果 ${index + 1}:`,
      `ok: ${result.ok}`,
      `code: ${result.code}`,
      `summary: ${result.preview?.summary || result.message || ''}`,
    ]

    const dataBlock = formatToolResultData(result)
    if (dataBlock) {
      lines.push(dataBlock)
    }

    return lines.join('\n')
  }).join('\n\n')
}

function buildToolLoopPrompt(resultsSummary: string, results: AiToolResult[], requestContext?: AiChatRequestContext | null) {
  const contextPrompt = buildAiChatContextSystemPrompt(requestContext || null)
  return [
    '以下是你刚才请求的本地工具执行结果，请继续完成用户上一条请求。',
    '如果当前信息已足够，请直接输出自然语言最终答复，不要再解释 JSON 格式。',
    '如果仍需进一步读取或执行其他本地工具，请继续只返回合法 JSON 工具请求。',
    contextPrompt ? `附加上下文：\n${contextPrompt}` : '',
    `工具执行摘要：\n${resultsSummary}`,
    `工具详细返回：\n${buildDetailedToolResultsPrompt(results)}`,
  ].filter(Boolean).join('\n\n')
}

async function continueAssistantAfterToolResults(resultsSummary: string, results: AiToolResult[]) {
  hydrateSettings()

  const followUpMessages = chat.messages.concat(
    createHiddenSystemMessage(buildToolLoopPrompt(resultsSummary, results, lastRequestContext.value)),
  )

  return await requestOpenAiCompatibleCompletion({
    messages: followUpMessages,
    settings: settingsState,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  })
}

async function resolveAssistantToolLoop(rawText: string, depth = 0): Promise<{ cards: ChatMessageCard[], text: string }> {
  const envelope = parseAiAssistantToolEnvelope(rawText)
  if (!envelope) {
    return {
      cards: [],
      text: rawText.trim(),
    }
  }

  const mutationPolicies = applyMutationPolicies(
    envelope.toolCalls,
    currentTask.value?.input || getLatestUserMessageText(),
    lastRequestContext.value,
  )
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
    return {
      cards,
      text: buildRewriteFallbackText(summary, envelope.answer),
    }
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

    return {
      cards,
      text: mergeAssistantAnswer(envelope.answer, summary),
    }
  }

  try {
    const followUpText = await continueAssistantAfterToolResults(summary, results)
    const nested = await resolveAssistantToolLoop(followUpText, depth + 1)
    return {
      cards: mergeCards(cards, nested.cards),
      text: nested.text.trim() || mergeAssistantAnswer(envelope.answer, summary),
    }
  }
  catch {
    markTaskFailed('工具续跑失败', summary, 'request_failed')
    return {
      cards,
      text: mergeAssistantAnswer(envelope.answer, summary),
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
      text: buildRewriteFallbackText(summary, envelope.answer),
    }
  }

  return {
    cards,
    text: mergeAssistantAnswer(envelope.answer, summary),
  }
}

async function processLatestAssistantEnvelope() {
  const message = latestAssistantMessage.value
  if (!message || handledAssistantEnvelopeIds.has(message.id)) {
    return
  }

  const envelope = parseAiAssistantToolEnvelope(message.text)
  console.info('[AI envelope] latest assistant raw text', message.text)

  if (!envelope) {
    console.info('[AI envelope] no valid tool envelope parsed')
    handledAssistantEnvelopeIds.add(message.id)
    if (currentTask.value && (currentTask.value.status === 'identifying' || currentTask.value.status === 'executing')) {
      markTaskCompleted(message.text)
    }
    return
  }

  console.info('[AI envelope] parsed tool calls', envelope.toolCalls)

  handledAssistantEnvelopeIds.add(message.id)

  if (!agentFeatureEnabled) {
    const resolved = await resolveAssistantMessageWithoutAgent(message.text)
    replaceMessageText(message.id, resolved.text, resolved.cards)
    return
  }

  ensureCurrentTask()
  const resolved = await resolveAssistantToolLoop(message.text)
  replaceMessageText(message.id, resolved.text, resolved.cards)
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
  if (agentFeatureEnabled) {
    if (options.reuseCurrentTask) {
      resumeCurrentTask()
    }
    else {
      startAgentTaskIfNeeded(content)
    }

    updateCurrentTask(task => updateAgentTask(task, {
      routeTargetSnapshot: createRouteTargetSnapshot(options.requestContext || null),
    }))
  }

  const requestBody = createChatRequestBody(options.requestContext)
  void chat.sendMessage({ text: content }, requestBody ? {
    body: requestBody,
  } : undefined)
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

  if (!isRouteTargetSnapshotMatched(currentTask.value.routeTargetSnapshot, readCurrentRouteTargetSnapshot())) {
    updateCurrentTask(task => updateAgentTask(task, {
      appendStep: {
        kind: 'interrupted',
        title: '当前页面对象已变化',
        detail: '请先回到原页面对象，再继续当前任务。',
      },
      requiresRelocation: true,
      terminationReason: 'restored',
    }))
    return false
  }

  return await sendMessage(currentTask.value.input, {
    requestContext: options.requestContext,
    reuseCurrentTask: true,
  })
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
  if (!results.length) {
    return results
  }

  const summary = summarizeExecutionResults(results)
  const cards = createToolResultCards(results)

  if (!agentFeatureEnabled) {
    appendAssistantMessage(results.every(result => result.ok) ? summary : buildRewriteFallbackText(summary), cards)
    return results
  }

  if (!results.every(result => result.ok)) {
    const fallbackText = buildRewriteFallbackText(summary)
    appendAssistantMessage(fallbackText, cards)
    updateCurrentTask(task => updateAgentTask(task, {
      appendStep: {
        kind: 'tool_result',
        title: '已确认并执行本地工具',
        detail: summary,
        status: 'failed',
      },
      lastError: summary,
      lastResponseText: fallbackText,
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

  try {
    const followUpText = await continueAssistantAfterToolResults(summary, results)
    const resolved = await resolveAssistantToolLoop(followUpText, 1)
    const finalText = resolved.text.trim() || summary
    appendAssistantMessage(finalText, mergeCards(cards, resolved.cards))
    markTaskCompleted(finalText)
  }
  catch {
    appendAssistantMessage(summary, cards)
    updateCurrentTask(task => updateAgentTask(task, {
      lastResponseText: summary,
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
  appendAssistantMessage('已取消本次待确认操作。')
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

export function useAiChat() {
  hydrateSettings()
  hydrateConversation()
  hydrateAgentTask()

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
    canResumeInterruptedTask: computed(() => {
      if (!agentFeatureEnabled) {
        return false
      }

      if (!currentTask.value || currentTask.value.status !== 'interrupted' || isBusy.value) {
        return false
      }

      return isRouteTargetSnapshotMatched(currentTask.value.routeTargetSnapshot, readCurrentRouteTargetSnapshot())
    }),
    currentTask,
    isAgentEnabled: agentFeatureEnabled,
    currentTaskConfirmationModeLabel: computed(() => currentTask.value ? getAgentTaskConfirmationModeLabel(currentTask.value.confirmationMode) : ''),
    currentTaskRiskLabel: computed(() => currentTask.value ? getAgentTaskRiskLabel(currentTask.value.riskLevel) : ''),
    currentTaskStatusLabel: computed(() => currentTask.value ? getAgentTaskStatusLabel(currentTask.value.status) : ''),
    lastToolResults: aiChatSession.lastResults,
    latestAssistantMessage,
    openSettings: () => {
      showSettings.value = true
    },
    providerLabel,
    confirmPendingExecution,
    regenerate,
    resetSettings,
    resumeInterruptedTask,
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

watch(() => currentTask.value, () => {
  if (!hasHydratedConversation.value) {
    return
  }

  persistAgentTask()
}, { deep: true })
