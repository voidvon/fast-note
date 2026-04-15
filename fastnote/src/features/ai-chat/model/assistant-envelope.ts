import type { AiNoteToolCall, AiToolResult } from '@/shared/types'

export interface AiAssistantToolEnvelope {
  answer?: string
  mode: 'tool_calls'
  toolCalls: AiNoteToolCall[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isAiNoteToolCall(value: unknown): value is AiNoteToolCall {
  if (!isRecord(value)) {
    return false
  }

  return typeof value.tool === 'string' && isRecord(value.payload)
}

function normalizeEnvelope(value: unknown): AiAssistantToolEnvelope | null {
  if (!isRecord(value)) {
    return null
  }

  const toolCalls = Array.isArray(value.toolCalls)
    ? value.toolCalls.filter(isAiNoteToolCall)
    : []

  if (!toolCalls.length) {
    return null
  }

  if (value.mode && value.mode !== 'tool_calls') {
    return null
  }

  return {
    answer: typeof value.answer === 'string' ? value.answer.trim() : '',
    mode: 'tool_calls',
    toolCalls,
  }
}

function extractJsonCandidates(rawText: string) {
  const text = rawText.trim()
  if (!text) {
    return []
  }

  const candidates = [text]
  const fencedMatches = text.match(/```(?:json)?\s*([\s\S]*?)```/gi) || []
  for (const block of fencedMatches) {
    const content = block
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim()
    if (content) {
      candidates.push(content)
    }
  }

  return [...new Set(candidates)]
}

export function parseAiAssistantToolEnvelope(rawText: string) {
  const candidates = extractJsonCandidates(rawText)

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      const envelope = normalizeEnvelope(parsed)
      if (envelope) {
        return envelope
      }
    }
    catch {
      continue
    }
  }

  return null
}

export function summarizePreviewResults(results: AiToolResult[]) {
  const lines = results.map((result) => {
    const title = result.preview?.title || '待执行操作'
    const summary = result.preview?.summary || '已生成执行预览'
    return `- ${title}：${summary}`
  })

  return [
    '我已根据你的请求生成执行预览：',
    ...lines,
    '',
    '请确认是否继续执行。',
  ].join('\n')
}

export function summarizeExecutionResults(results: AiToolResult[]) {
  const lines = results.map((result) => {
    const status = result.ok ? '已完成' : '失败'
    const summary = result.preview?.summary || result.message || result.code
    const suffix = result.humanActionRequired ? '（需要人工完成后续步骤）' : ''
    return `- ${status}：${summary}${suffix}`
  })

  return [
    '本次操作执行结果如下：',
    ...lines,
  ].join('\n')
}

export function mergeAssistantAnswer(answer: string | undefined, summary: string) {
  const trimmedAnswer = answer?.trim()
  if (!trimmedAnswer) {
    return summary
  }

  return `${trimmedAnswer}\n\n${summary}`
}
