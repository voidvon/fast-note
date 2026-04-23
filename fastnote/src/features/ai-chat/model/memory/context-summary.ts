import type { UIMessage } from 'ai'
import type { AiConversationSummaryResult } from './context-compression'
import type { AiStructuredHistorySummary, AiWorkingMemory } from '../working-memory'
import {
  formatAiStructuredHistorySummary,
  mergeConversationSummaryIntoWorkingMemory,
  markAiWorkingMemoryPartialFailed,
  normalizeAiStructuredHistorySummary,
} from '../working-memory'
import { summarizeConversationMessages } from './context-compression'

export interface AiContextSummaryInput {
  lastCompressionReason?: string
  messages: UIMessage[]
  previousMemory?: AiWorkingMemory | null
}

export interface AiContextSummarizer {
  name: string
  summarize: (input: AiContextSummaryInput) => AiConversationSummaryResult | null
}

export interface AiAsyncContextSummarizer {
  name: string
  summarize: (input: AiContextSummaryInput) => Promise<AiConversationSummaryResult | null>
}

interface ApplyConversationSummaryOptions {
  lastCompressionReason?: string
  summarizer?: AiContextSummarizer
}

interface ApplyConversationSummaryAsyncOptions {
  cacheTtlMs?: number
  fallbackSummarizer?: AiContextSummarizer
  lastCompressionReason?: string
  now?: () => number
  summarizer: AiAsyncContextSummarizer
  workingMemoryFreshnessMs?: number
}

interface AsyncSummaryCacheEntry {
  createdAt: number
  summary: AiConversationSummaryResult
}

const DEFAULT_ASYNC_SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000
const DEFAULT_WORKING_MEMORY_FRESHNESS_MS = 60 * 1000

const asyncSummaryCache = new Map<string, AsyncSummaryCacheEntry>()
const asyncSummaryInFlight = new Map<string, Promise<AiConversationSummaryResult | null>>()
const LLM_SUMMARY_SECTION_ALIASES = {
  blockers: ['阻塞', '问题', '风险', 'blockers', 'issues'],
  constraints: ['约束', '限制', '前提', 'constraints'],
  pending: ['待处理', '待确认', '后续', 'next', 'pending'],
  progress: ['进展', '现状', 'progress', 'status'],
} as const

export function resetContextSummaryCaches() {
  asyncSummaryCache.clear()
  asyncSummaryInFlight.clear()
}

export const deterministicContextSummarizer: AiContextSummarizer = {
  name: 'deterministic',
  summarize(input) {
    return summarizeConversationMessages(input.messages)
  },
}

export const deterministicAsyncContextSummarizer: AiAsyncContextSummarizer = {
  name: 'deterministic',
  async summarize(input) {
    return deterministicContextSummarizer.summarize(input)
  },
}

function buildSummaryCacheKey(input: AiContextSummaryInput, summarizerName: string, sourceMessageIds: string[]) {
  return [
    summarizerName,
    input.previousMemory?.taskId || '',
    sourceMessageIds.join(','),
  ].join('::')
}

function resolveTimestamp(value: string | undefined) {
  if (!value) {
    return null
  }

  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

function isFreshTimestamp(value: string | undefined, freshnessMs: number, now: number) {
  const timestamp = resolveTimestamp(value)
  if (timestamp === null) {
    return false
  }

  return now - timestamp <= freshnessMs
}

function normalizeSummaryText(text: string) {
  return text
    .trim()
    .replace(/^```(?:markdown|md|text)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function createEmptyStructuredHistorySummary(): AiStructuredHistorySummary {
  return {
    blockers: [],
    constraints: [],
    pending: [],
    progress: [],
  }
}

function resolveSummarySectionKey(line: string): keyof typeof LLM_SUMMARY_SECTION_ALIASES | null {
  const normalizedLine = line.trim().replace(/[:：]$/, '').toLowerCase()
  for (const [section, aliases] of Object.entries(LLM_SUMMARY_SECTION_ALIASES) as Array<[keyof typeof LLM_SUMMARY_SECTION_ALIASES, readonly string[]]>) {
    if (aliases.some(alias => alias.toLowerCase() === normalizedLine)) {
      return section
    }
  }

  return null
}

function parseStructuredSummaryText(text: string) {
  const normalizedText = normalizeSummaryText(text)
  if (!normalizedText) {
    return undefined
  }

  const summary = createEmptyStructuredHistorySummary()
  let currentSection: keyof typeof LLM_SUMMARY_SECTION_ALIASES | null = null

  for (const rawLine of normalizedText.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const section = resolveSummarySectionKey(line)
    if (section) {
      currentSection = section
      continue
    }

    const content = line
      .replace(/^[-*•]\s*/, '')
      .replace(/^\d+[.)、]\s*/, '')
      .trim()
    if (!content || content === '无') {
      continue
    }

    if (currentSection) {
      summary[currentSection].push(content)
      continue
    }

    summary.progress.push(content)
  }

  return normalizeAiStructuredHistorySummary(summary)
    || normalizeAiStructuredHistorySummary(normalizedText)
}

export function createLlmContextSummarizer(options: {
  complete: (input: { prompt: string }) => Promise<string>
  name?: string
}): AiAsyncContextSummarizer {
  return {
    name: options.name || 'llm',
    async summarize(input) {
      const baseSummary = summarizeConversationMessages(input.messages)
      if (!baseSummary) {
        return null
      }

      const prompt = [
        '请把下面的会话历史摘要进一步压缩成更短、更稳定、可续跑的中文摘要。',
        '要求：',
        '1. 保留任务目标、仍有效的约束、当前进展、关键错误、待确认事项。',
        '2. 不要编造 noteId、folderId、文件路径或执行结果。',
        '3. 不要输出 JSON，不要输出 Markdown 代码块。',
        '4. 必须严格按下面结构输出，没有内容就写“无”。',
        '约束：\n- ...\n\n进展：\n- ...\n\n阻塞：\n- ...\n\n待处理：\n- ...',
        input.previousMemory?.taskSummary ? `当前任务摘要：\n${input.previousMemory.taskSummary}` : '',
        input.previousMemory?.historySummary ? `已有历史摘要：\n${formatAiStructuredHistorySummary(input.previousMemory.historySummary)}` : '',
        `待压缩历史摘要：\n${baseSummary.summaryText}`,
        '直接输出压缩后的结构化摘要正文。',
      ].filter(Boolean).join('\n\n')

      const result = parseStructuredSummaryText(await options.complete({ prompt }))
      if (!result) {
        throw new Error('empty_summary')
      }

      return {
        historySummary: result,
        sourceMessageIds: baseSummary.sourceMessageIds,
        summaryText: formatAiStructuredHistorySummary(result),
      }
    },
  }
}

export function applyConversationSummaryToWorkingMemory(
  memory: AiWorkingMemory | null | undefined,
  messages: UIMessage[],
  options: ApplyConversationSummaryOptions = {},
) {
  const summarizer = options.summarizer || deterministicContextSummarizer

  try {
    const summary = summarizer.summarize({
      lastCompressionReason: options.lastCompressionReason,
      messages,
      previousMemory: memory || null,
    })
    if (!summary) {
      return memory || null
    }

    return mergeConversationSummaryIntoWorkingMemory(memory, {
      historySummary: summary.historySummary,
      lastCompressionReason: options.lastCompressionReason || 'history_summary',
      sourceMessageIds: summary.sourceMessageIds,
    })
  }
  catch (error) {
    const detail = error instanceof Error ? error.message : '历史消息压缩失败'
    const failureReason = `${summarizer.name}:${detail}`
    return markAiWorkingMemoryPartialFailed(memory, failureReason)
  }
}

export async function applyConversationSummaryToWorkingMemoryAsync(
  memory: AiWorkingMemory | null | undefined,
  messages: UIMessage[],
  options: ApplyConversationSummaryAsyncOptions,
) {
  const fallbackSummarizer = options.fallbackSummarizer || deterministicContextSummarizer
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_ASYNC_SUMMARY_CACHE_TTL_MS
  const now = options.now?.() ?? Date.now()
  const workingMemoryFreshnessMs = options.workingMemoryFreshnessMs ?? DEFAULT_WORKING_MEMORY_FRESHNESS_MS
  const summaryInput: AiContextSummaryInput = {
    lastCompressionReason: options.lastCompressionReason,
    messages,
    previousMemory: memory || null,
  }
  const deterministicBaseSummary = summarizeConversationMessages(messages)

  if (!deterministicBaseSummary) {
    return memory || null
  }

  const cachedSummaryKey = buildSummaryCacheKey(summaryInput, options.summarizer.name, deterministicBaseSummary.sourceMessageIds)
  if (memory?.status === 'summarized'
    && memory.historySummary
    && memory.sourceMessageIds.join(',') === deterministicBaseSummary.sourceMessageIds.join(',')
    && isFreshTimestamp(memory.lastCompressionAt, workingMemoryFreshnessMs, now)) {
    return mergeConversationSummaryIntoWorkingMemory(memory, {
      historySummary: memory.historySummary,
      lastCompressionReason: options.lastCompressionReason || 'history_summary_reused',
      sourceMessageIds: deterministicBaseSummary.sourceMessageIds,
    })
  }

  const cachedSummary = asyncSummaryCache.get(cachedSummaryKey)
  if (cachedSummary && now - cachedSummary.createdAt <= cacheTtlMs) {
    return mergeConversationSummaryIntoWorkingMemory(memory, {
      historySummary: cachedSummary.summary.historySummary,
      lastCompressionReason: options.lastCompressionReason || 'history_summary_cached',
      sourceMessageIds: cachedSummary.summary.sourceMessageIds,
    })
  }
  if (cachedSummary) {
    asyncSummaryCache.delete(cachedSummaryKey)
  }

  try {
    const inFlightSummary = asyncSummaryInFlight.get(cachedSummaryKey)
      || options.summarizer.summarize(summaryInput)
    if (!asyncSummaryInFlight.has(cachedSummaryKey)) {
      asyncSummaryInFlight.set(cachedSummaryKey, Promise.resolve(inFlightSummary).finally(() => {
        asyncSummaryInFlight.delete(cachedSummaryKey)
      }))
    }

    const summary = await asyncSummaryInFlight.get(cachedSummaryKey)
    if (!summary) {
      return memory || null
    }

    asyncSummaryCache.set(cachedSummaryKey, {
      createdAt: now,
      summary,
    })

    return mergeConversationSummaryIntoWorkingMemory(memory, {
      historySummary: summary.historySummary,
      lastCompressionReason: options.lastCompressionReason || 'history_summary',
      sourceMessageIds: summary.sourceMessageIds,
    })
  }
  catch {
    return applyConversationSummaryToWorkingMemory(memory, messages, {
      lastCompressionReason: options.lastCompressionReason || 'history_summary_fallback',
      summarizer: fallbackSummarizer,
    })
  }
}
