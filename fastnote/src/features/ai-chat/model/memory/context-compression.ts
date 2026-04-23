import type { UIMessage } from 'ai'
import type { AiStructuredHistorySummary, AiWorkingMemory } from '../working-memory'
import type { AiToolResult } from '@/shared/types'
import { formatAiStructuredHistorySummary } from '../working-memory'

const MAX_TOOL_RESULTS = 3
const MAX_TEXT_LENGTH = 1600
const MAX_NOTE_CONTENT_LENGTH = 1200
const MAX_ARRAY_ITEMS = 5
const PROTECT_FIRST_N = 3
const PROTECT_LAST_N = 8
const MIN_COMPRESSIBLE_MESSAGES = 3
const MIN_COMPRESSIBLE_TEXT_LENGTH = 400
const MAX_SUMMARY_MESSAGES = 10
const SUMMARY_SECTION_KEYWORDS = {
  blockers: ['失败', '报错', '错误', '异常', '超时', '无法', '中断', '拒绝'],
  constraints: ['必须', '不要', '仅', '只能', '优先', '保留', '禁止', '需要遵守'],
  pending: ['待确认', '确认', '下一步', '接下来', '需要补充', '请继续', '是否'],
} as const

export interface AiConversationSummaryResult {
  historySummary: AiStructuredHistorySummary
  sourceMessageIds: string[]
  summaryText: string
}

function truncateText(value: string, maxLength: number) {
  const text = value.trim()
  if (!text) {
    return ''
  }

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 7))}…[已截断]`
}

function formatJsonBlock(value: unknown) {
  return truncateText(JSON.stringify(value, null, 2), MAX_TEXT_LENGTH)
}

function extractPlainText(message: UIMessage) {
  return message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }

      return ''
    })
    .join('\n')
    .trim()
}

function summarizeMessageLine(message: UIMessage) {
  const content = truncateText(extractPlainText(message), 180)
  if (!content) {
    return ''
  }

  const roleLabel = message.role === 'assistant'
    ? '助手'
    : message.role === 'system'
      ? '系统'
      : '用户'

  return `${roleLabel}：${content}`
}

function hasKeyword(text: string, keywords: readonly string[]) {
  return keywords.some(keyword => text.includes(keyword))
}

function toStructuredHistorySummary(lines: string[], omittedCount: number): AiStructuredHistorySummary {
  const summary: AiStructuredHistorySummary = {
    blockers: lines.filter(line => hasKeyword(line, SUMMARY_SECTION_KEYWORDS.blockers)).slice(0, 3),
    constraints: lines.filter(line => hasKeyword(line, SUMMARY_SECTION_KEYWORDS.constraints)).slice(0, 3),
    pending: lines.filter(line => hasKeyword(line, SUMMARY_SECTION_KEYWORDS.pending)).slice(0, 3),
    progress: lines.slice(0, 4),
  }

  if (omittedCount > 0) {
    summary.progress.push(`更早的 ${omittedCount} 条中段消息已合并省略`)
  }

  return summary
}

export function summarizeConversationMessages(messages: UIMessage[]) {
  if (messages.length <= PROTECT_FIRST_N + PROTECT_LAST_N) {
    return null
  }

  const middleMessages = messages.slice(PROTECT_FIRST_N, Math.max(PROTECT_FIRST_N, messages.length - PROTECT_LAST_N))
  const summarizedLines = middleMessages
    .map(message => ({
      id: message.id,
      line: summarizeMessageLine(message),
    }))
    .filter((item): item is { id: string, line: string } => !!item.line)

  const totalCompressibleLength = summarizedLines.reduce((sum, item) => sum + item.line.length, 0)
  if (summarizedLines.length < MIN_COMPRESSIBLE_MESSAGES || totalCompressibleLength < MIN_COMPRESSIBLE_TEXT_LENGTH) {
    return null
  }

  const sampledLines = summarizedLines.slice(-MAX_SUMMARY_MESSAGES).map((item, index) => `${index + 1}. ${item.line}`)
  const omittedCount = summarizedLines.length - sampledLines.length
  const historySummary = toStructuredHistorySummary(sampledLines, omittedCount)

  return {
    historySummary,
    sourceMessageIds: summarizedLines.map(item => item.id),
    summaryText: formatAiStructuredHistorySummary(historySummary),
  } satisfies AiConversationSummaryResult
}

export function applyWorkingMemoryToMessages(messages: UIMessage[], workingMemory: AiWorkingMemory | null | undefined) {
  if (!workingMemory || workingMemory.status !== 'summarized' || !workingMemory.sourceMessageIds.length) {
    return messages
  }

  const compressedIds = new Set(workingMemory.sourceMessageIds)
  return messages.filter(message => !compressedIds.has(message.id))
}

export function formatToolResultDataForPrompt(result: AiToolResult) {
  if (!result.data) {
    return ''
  }

  if (Array.isArray(result.data)) {
    const sampled = result.data.slice(0, MAX_ARRAY_ITEMS)
    const lines = [
      sampled.length ? `返回数据：\n${formatJsonBlock(sampled)}` : '返回数据：空列表',
    ]

    if (result.data.length > sampled.length) {
      lines.push(`其余 ${result.data.length - sampled.length} 项已省略`)
    }

    return lines.join('\n')
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
      `summary: ${typeof note.summary === 'string' ? truncateText(note.summary, 160) : ''}`,
      `updated: ${typeof note.updated === 'string' ? note.updated : ''}`,
      `readSource: ${typeof notePayload.source === 'string' ? notePayload.source : ''}`,
      `contentHtml:\n${typeof note.content === 'string' ? truncateText(note.content, MAX_NOTE_CONTENT_LENGTH) : ''}`,
    ].join('\n')
  }

  return `返回数据：\n${formatJsonBlock(result.data)}`
}

export function buildDetailedToolResultsPrompt(results: AiToolResult[]) {
  const visibleResults = results.slice(0, MAX_TOOL_RESULTS)
  const prompt = visibleResults.map((result, index) => {
    const lines = [
      `工具结果 ${index + 1}:`,
      `ok: ${result.ok}`,
      `code: ${result.code}`,
      `summary: ${truncateText(result.preview?.summary || result.message || '', 240)}`,
    ]

    const dataBlock = formatToolResultDataForPrompt(result)
    if (dataBlock) {
      lines.push(dataBlock)
    }

    return lines.join('\n')
  }).join('\n\n')

  if (results.length <= visibleResults.length) {
    return prompt
  }

  return [
    prompt,
    `其余 ${results.length - visibleResults.length} 条工具结果已省略，请优先依据上面的摘要继续执行。`,
  ].filter(Boolean).join('\n\n')
}
