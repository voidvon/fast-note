import type { AiNoteToolCall, AiToolResult } from '@/shared/types'

export interface AiAssistantToolEnvelope {
  answer?: string
  mode: 'tool_calls'
  toolCalls: AiNoteToolCall[]
}

const TOOL_ENVELOPE_KEY_PATTERN = /"mode"\s*:|"toolCalls"\s*:|"payload"\s*:|"answer"\s*:/

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

function appendDistinctParagraph(result: string, value: string) {
  const normalizedValue = value.trim()
  if (!normalizedValue) {
    return result
  }

  const normalizedResult = result.trim()
  if (!normalizedResult) {
    return normalizedValue
  }

  if (normalizedResult === normalizedValue || normalizedResult.endsWith(normalizedValue)) {
    return normalizedResult
  }

  if (normalizedValue.endsWith(normalizedResult)) {
    return normalizedValue
  }

  return `${normalizedResult}\n\n${normalizedValue}`
}

function mergeEnvelopeAnswerParts(...parts: Array<string | undefined>) {
  return parts.reduce<string>((result, part) => appendDistinctParagraph(result, part ?? ''), '')
}

function stripFencePrefix(text: string) {
  return text.replace(/^\s*```(?:json)?\s*/i, '')
}

function stripFenceSuffix(text: string) {
  return text.replace(/\s*```\s*$/i, '')
}

function cleanOuterEnvelopeText(text: string) {
  return stripFenceSuffix(stripFencePrefix(text)).trim()
}

interface EnvelopeCandidate {
  candidate: string
  leadingText: string
  trailingText: string
}

function buildEnvelopeFromCandidate(candidate: EnvelopeCandidate) {
  try {
    const parsed = JSON.parse(candidate.candidate)
    const envelope = normalizeEnvelope(parsed)
    if (!envelope) {
      return null
    }

    return {
      ...envelope,
      answer: mergeEnvelopeAnswerParts(
        cleanOuterEnvelopeText(candidate.leadingText),
        envelope.answer,
        cleanOuterEnvelopeText(candidate.trailingText),
      ),
    }
  }
  catch {
    return null
  }
}

function extractFencedJsonCandidates(rawText: string) {
  const candidates: EnvelopeCandidate[] = []
  const regex = /```(?:json)?\s*([\s\S]*?)```/gi
  let match: RegExpExecArray | null = regex.exec(rawText)
  while (match) {
    const block = match[0]
    const content = match[1]?.trim() || ''
    if (content) {
      candidates.push({
        candidate: content,
        leadingText: rawText.slice(0, match.index),
        trailingText: rawText.slice(match.index + block.length),
      })
    }
    match = regex.exec(rawText)
  }

  return candidates
}

function extractEmbeddedJsonCandidates(rawText: string) {
  const candidates: EnvelopeCandidate[] = []
  const seen = new Set<string>()

  for (let start = 0; start < rawText.length; start += 1) {
    if (rawText[start] !== '{') {
      continue
    }

    let depth = 0
    let inString = false
    let escaped = false

    for (let end = start; end < rawText.length; end += 1) {
      const char = rawText[end]

      if (inString) {
        if (escaped) {
          escaped = false
          continue
        }

        if (char === '\\') {
          escaped = true
          continue
        }

        if (char === '"') {
          inString = false
        }
        continue
      }

      if (char === '"') {
        inString = true
        continue
      }

      if (char === '{') {
        depth += 1
        continue
      }

      if (char !== '}') {
        continue
      }

      depth -= 1
      if (depth !== 0) {
        continue
      }

      const candidate = rawText.slice(start, end + 1).trim()
      if (!candidate || seen.has(candidate)) {
        break
      }

      seen.add(candidate)
      candidates.push({
        candidate,
        leadingText: rawText.slice(0, start),
        trailingText: rawText.slice(end + 1),
      })
      break
    }
  }

  return candidates
}

function extractJsonCandidates(rawText: string) {
  const text = rawText.trim()
  if (!text) {
    return []
  }

  const candidates: EnvelopeCandidate[] = [{
    candidate: text,
    leadingText: '',
    trailingText: '',
  }]

  candidates.push(...extractFencedJsonCandidates(rawText))
  candidates.push(...extractEmbeddedJsonCandidates(rawText))

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = `${candidate.candidate}\u0000${candidate.leadingText}\u0000${candidate.trailingText}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function findLikelyEnvelopeStart(rawText: string) {
  const match = TOOL_ENVELOPE_KEY_PATTERN.exec(rawText)
  if (!match) {
    return -1
  }

  return rawText.slice(0, match.index).lastIndexOf('{')
}

function extractPartialEnvelopeAnswer(rawText: string) {
  const match = rawText.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)"/s)
  if (!match?.[1]) {
    return ''
  }

  try {
    return JSON.parse(`"${match[1]}"`).trim()
  }
  catch {
    return match[1].trim()
  }
}

export function parseAiAssistantToolEnvelope(rawText: string) {
  const candidates = extractJsonCandidates(rawText)

  for (const candidate of candidates) {
    const envelope = buildEnvelopeFromCandidate(candidate)
    if (envelope) {
      return envelope
    }
  }

  return null
}

export function extractVisibleAiAssistantText(rawText: string) {
  const text = rawText.trim()
  if (!text) {
    return ''
  }

  const envelope = parseAiAssistantToolEnvelope(rawText)
  if (envelope) {
    return envelope.answer?.trim() || ''
  }

  const envelopeStart = findLikelyEnvelopeStart(rawText)
  if (envelopeStart >= 0) {
    const prefix = cleanOuterEnvelopeText(rawText.slice(0, envelopeStart))
    if (prefix) {
      return prefix
    }

    return extractPartialEnvelopeAnswer(rawText)
  }

  if (/^\s*```(?:json)?/i.test(rawText) && TOOL_ENVELOPE_KEY_PATTERN.test(rawText)) {
    return extractPartialEnvelopeAnswer(rawText)
  }

  return rawText
}

export function isLikelyPartialAiAssistantToolEnvelope(rawText: string) {
  const text = rawText.trim()
  if (!text) {
    return false
  }

  if (parseAiAssistantToolEnvelope(text)) {
    return true
  }

  return extractVisibleAiAssistantText(rawText) !== rawText
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
