import type { AiAgentTask } from './agent-task'
import type { AiChatRequestContext, AiChatResolvedTarget } from './request-context'

export const AI_CHAT_WORKING_MEMORY_BODY_KEY = '_fastnoteWorkingMemory'
const MAX_DETAIL_LENGTH = 120
const MAX_SUMMARY_LENGTH = 1200
const MAX_HISTORY_ITEMS_PER_SECTION = 4
const MAX_HISTORY_ITEM_LENGTH = 240
const HISTORY_SUMMARY_SECTION_ORDER = ['constraints', 'progress', 'blockers', 'pending'] as const

type AiHistorySummarySectionKey = typeof HISTORY_SUMMARY_SECTION_ORDER[number]

export type AiCompressionStatus =
  | 'idle'
  | 'hygiene_only'
  | 'summarized'
  | 'partial_failed'

export interface AiStructuredHistorySummary {
  blockers: string[]
  constraints: string[]
  pending: string[]
  progress: string[]
}

export interface AiWorkingMemory {
  version: 1
  taskId: string
  scope: string
  status: AiCompressionStatus
  taskSummary: string
  historySummary?: AiStructuredHistorySummary
  activeTargetSummary?: string
  latestToolResultSummary?: string
  pendingMutationSummary?: string
  recentErrorSummary?: string
  focusTopic?: string
  lastCompressionReason?: string
  lastCompressionAt: string
  sourceMessageIds: string[]
}

interface MergeConversationSummaryInput {
  lastCompressionReason?: string
  sourceMessageIds: string[]
  historySummary?: AiStructuredHistorySummary
  summaryText?: string
}

interface CreateAiWorkingMemoryOptions {
  context?: AiChatRequestContext | null
  previous?: AiWorkingMemory | null
  scope: string
  latestToolResultSummary?: string
  lastCompressionReason?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function truncateText(value: string | undefined, maxLength: number) {
  const text = value?.trim() || ''
  if (!text) {
    return ''
  }

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function createEmptyAiStructuredHistorySummary(): AiStructuredHistorySummary {
  return {
    blockers: [],
    constraints: [],
    pending: [],
    progress: [],
  }
}

function normalizeHistorySummarySection(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => truncateText(item, MAX_HISTORY_ITEM_LENGTH))
    .filter(Boolean)
    .slice(0, MAX_HISTORY_ITEMS_PER_SECTION)
}

export function hasAiStructuredHistorySummary(summary: AiStructuredHistorySummary | null | undefined) {
  if (!summary) {
    return false
  }

  return HISTORY_SUMMARY_SECTION_ORDER.some(section => summary[section].length > 0)
}

export function normalizeAiStructuredHistorySummary(value: unknown): AiStructuredHistorySummary | undefined {
  if (typeof value === 'string') {
    const text = truncateText(value, MAX_SUMMARY_LENGTH)
    if (!text) {
      return undefined
    }

    return {
      ...createEmptyAiStructuredHistorySummary(),
      progress: [text],
    }
  }

  if (!isRecord(value)) {
    return undefined
  }

  const summary: AiStructuredHistorySummary = {
    blockers: normalizeHistorySummarySection(value.blockers),
    constraints: normalizeHistorySummarySection(value.constraints),
    pending: normalizeHistorySummarySection(value.pending),
    progress: normalizeHistorySummarySection(value.progress),
  }

  return hasAiStructuredHistorySummary(summary) ? summary : undefined
}

export function formatAiStructuredHistorySummary(summary: AiStructuredHistorySummary | null | undefined) {
  const normalizedSummary = normalizeAiStructuredHistorySummary(summary)
  if (!normalizedSummary) {
    return ''
  }

  const lines = ['已压缩的历史消息摘要：']
  const sectionLabels: Record<AiHistorySummarySectionKey, string> = {
    blockers: '阻塞',
    constraints: '约束',
    pending: '待处理',
    progress: '进展',
  }

  for (const section of HISTORY_SUMMARY_SECTION_ORDER) {
    if (!normalizedSummary[section].length) {
      continue
    }

    lines.push(`${sectionLabels[section]}：`)
    lines.push(...normalizedSummary[section].map(item => `- ${item}`))
  }

  return truncateText(lines.join('\n'), MAX_SUMMARY_LENGTH)
}

function resolveInputHistorySummary(input: MergeConversationSummaryInput) {
  return normalizeAiStructuredHistorySummary(input.historySummary || input.summaryText)
}

function isCompressionStatus(value: unknown): value is AiCompressionStatus {
  return value === 'idle'
    || value === 'hygiene_only'
    || value === 'summarized'
    || value === 'partial_failed'
}

function getResolvedTargetSummary(target: AiChatResolvedTarget | null | undefined) {
  if (target?.note?.id) {
    return `目标备忘录：${target.note.title} [${target.note.id}]${target.note.summary ? `｜${target.note.summary}` : ''}`
  }

  if (target?.folder?.id) {
    return `目标目录：${target.folder.title} [${target.folder.id}]`
  }

  return ''
}

function getContextTargetSummary(context: AiChatRequestContext | null | undefined) {
  const resolvedTargetSummary = getResolvedTargetSummary(context?.resolvedTarget)
  if (resolvedTargetSummary) {
    return resolvedTargetSummary
  }

  if (context?.activeNote?.id) {
    return `当前备忘录：${context.activeNote.title} [${context.activeNote.id}]${context.activeNote.summary ? `｜${context.activeNote.summary}` : ''}`
  }

  if (context?.activeFolder?.id) {
    return `当前目录：${context.activeFolder.title} [${context.activeFolder.id}]`
  }

  return ''
}

function summarizeTask(task: AiAgentTask) {
  const step = task.steps[task.steps.length - 1]
  const stepSummary = step
    ? `${step.title}${step.detail ? `：${truncateText(step.detail, MAX_DETAIL_LENGTH)}` : ''}`
    : ''
  const responseSummary = truncateText(task.lastResponseText || '', MAX_DETAIL_LENGTH)
  const parts = [
    `任务：${truncateText(task.input, MAX_SUMMARY_LENGTH)}`,
    stepSummary ? `最近进展：${stepSummary}` : '',
    responseSummary ? `最近答复：${responseSummary}` : '',
  ].filter(Boolean)

  return parts.join('\n')
}

function resolvePendingMutationSummary(task: AiAgentTask, previous: AiWorkingMemory | null | undefined) {
  if (task.status !== 'waiting_confirmation') {
    return ''
  }

  return truncateText(task.lastRewriteSuggestion || task.lastResponseText || task.steps[task.steps.length - 1]?.detail || previous?.pendingMutationSummary || '', MAX_SUMMARY_LENGTH)
}

export function normalizeAiWorkingMemory(value: unknown): AiWorkingMemory | null {
  if (!isRecord(value) || typeof value.taskId !== 'string' || typeof value.taskSummary !== 'string') {
    return null
  }

  const sourceMessageIds = Array.isArray(value.sourceMessageIds)
    ? value.sourceMessageIds.filter((item): item is string => typeof item === 'string')
    : []

  return {
    version: 1,
    taskId: value.taskId,
    scope: typeof value.scope === 'string' ? value.scope : '',
    status: isCompressionStatus(value.status) ? value.status : 'idle',
    taskSummary: truncateText(value.taskSummary, MAX_SUMMARY_LENGTH) || '',
    historySummary: normalizeAiStructuredHistorySummary(value.historySummary),
    activeTargetSummary: truncateText(typeof value.activeTargetSummary === 'string' ? value.activeTargetSummary : '', MAX_SUMMARY_LENGTH) || undefined,
    latestToolResultSummary: truncateText(typeof value.latestToolResultSummary === 'string' ? value.latestToolResultSummary : '', MAX_SUMMARY_LENGTH) || undefined,
    pendingMutationSummary: truncateText(typeof value.pendingMutationSummary === 'string' ? value.pendingMutationSummary : '', MAX_SUMMARY_LENGTH) || undefined,
    recentErrorSummary: truncateText(typeof value.recentErrorSummary === 'string' ? value.recentErrorSummary : '', MAX_SUMMARY_LENGTH) || undefined,
    focusTopic: truncateText(typeof value.focusTopic === 'string' ? value.focusTopic : '', MAX_DETAIL_LENGTH) || undefined,
    lastCompressionReason: truncateText(typeof value.lastCompressionReason === 'string' ? value.lastCompressionReason : '', MAX_DETAIL_LENGTH) || undefined,
    lastCompressionAt: typeof value.lastCompressionAt === 'string' ? value.lastCompressionAt : new Date().toISOString(),
    sourceMessageIds,
  }
}

export function extractAiWorkingMemory(body: unknown) {
  if (!isRecord(body)) {
    return {
      requestBody: {},
      workingMemory: null,
    }
  }

  const requestBody: Record<string, unknown> = { ...body }
  const workingMemory = normalizeAiWorkingMemory(requestBody[AI_CHAT_WORKING_MEMORY_BODY_KEY])
  delete requestBody[AI_CHAT_WORKING_MEMORY_BODY_KEY]

  return {
    requestBody,
    workingMemory,
  }
}

export function buildAiWorkingMemorySystemPrompt(memory: AiWorkingMemory | null | undefined) {
  const normalizedMemory = normalizeAiWorkingMemory(memory)
  if (!normalizedMemory) {
    return ''
  }

  const lines = [
    '以下是 fastnote 前端维护的任务工作记忆，用于帮助你在长任务中延续目标与近期结果。',
    `- 当前任务摘要：${normalizedMemory.taskSummary}`,
  ]

  if (normalizedMemory.historySummary) {
    lines.push(`- 历史消息摘要：\n${formatAiStructuredHistorySummary(normalizedMemory.historySummary)}`)
  }

  if (normalizedMemory.activeTargetSummary) {
    lines.push(`- 当前目标摘要：${normalizedMemory.activeTargetSummary}`)
  }

  if (normalizedMemory.latestToolResultSummary) {
    lines.push(`- 最近工具结果摘要：${normalizedMemory.latestToolResultSummary}`)
  }

  if (normalizedMemory.pendingMutationSummary) {
    lines.push(`- 待确认写回摘要：${normalizedMemory.pendingMutationSummary}`)
  }

  if (normalizedMemory.recentErrorSummary) {
    lines.push(`- 最近错误摘要：${normalizedMemory.recentErrorSummary}`)
  }

  if (normalizedMemory.focusTopic) {
    lines.push(`- 当前焦点主题：${normalizedMemory.focusTopic}`)
  }

  return lines.join('\n')
}

export function createAiWorkingMemoryFromTask(task: AiAgentTask | null | undefined, options: CreateAiWorkingMemoryOptions): AiWorkingMemory | null {
  if (!task) {
    return null
  }

  const previous = normalizeAiWorkingMemory(options.previous)
  const taskSummary = summarizeTask(task)
  if (!taskSummary) {
    return null
  }

  return {
    version: 1,
    taskId: task.id,
    scope: options.scope,
    status: previous?.status || 'idle',
    taskSummary,
    historySummary: previous?.historySummary,
    activeTargetSummary: getContextTargetSummary(options.context) || previous?.activeTargetSummary,
    latestToolResultSummary: truncateText(options.latestToolResultSummary || previous?.latestToolResultSummary || '', MAX_SUMMARY_LENGTH) || undefined,
    pendingMutationSummary: resolvePendingMutationSummary(task, previous),
    recentErrorSummary: truncateText(task.lastError || previous?.recentErrorSummary || '', MAX_SUMMARY_LENGTH) || undefined,
    focusTopic: previous?.focusTopic,
    lastCompressionReason: truncateText(options.lastCompressionReason || previous?.lastCompressionReason || 'task_sync', MAX_DETAIL_LENGTH) || undefined,
    lastCompressionAt: new Date(task.updatedAt || Date.now()).toISOString(),
    sourceMessageIds: previous?.sourceMessageIds || [],
  }
}

export function mergeConversationSummaryIntoWorkingMemory(memory: AiWorkingMemory | null | undefined, input: MergeConversationSummaryInput) {
  const normalizedMemory = normalizeAiWorkingMemory(memory)
  const historySummary = resolveInputHistorySummary(input)
  if (!normalizedMemory || !historySummary || !input.sourceMessageIds.length) {
    return normalizedMemory
  }

  return {
    ...normalizedMemory,
    status: 'summarized' as const,
    historySummary,
    lastCompressionAt: new Date().toISOString(),
    lastCompressionReason: truncateText(input.lastCompressionReason || normalizedMemory.lastCompressionReason || 'history_summary', MAX_DETAIL_LENGTH) || undefined,
    sourceMessageIds: input.sourceMessageIds,
  }
}

export function markAiWorkingMemoryPartialFailed(
  memory: AiWorkingMemory | null | undefined,
  failureReason: string,
): AiWorkingMemory | null {
  const normalizedMemory = normalizeAiWorkingMemory(memory)
  if (!normalizedMemory) {
    return null
  }

  return {
    ...normalizedMemory,
    status: 'partial_failed',
    lastCompressionAt: new Date().toISOString(),
    lastCompressionReason: truncateText(failureReason, MAX_DETAIL_LENGTH) || 'history_summary_failed',
    recentErrorSummary: truncateText(failureReason, MAX_SUMMARY_LENGTH) || normalizedMemory.recentErrorSummary,
    sourceMessageIds: [],
  }
}
