import type { UIMessage } from 'ai'
import type { AiWorkingMemory } from '../working-memory'
import {
  buildOpenAiMessages,
  type OpenAiRequestMessage,
} from '../openai-compatible-chat-transport'
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  matchModelContextProfile,
} from './model-context-profiles'
import {
  countUiMessageTokens,
  estimateTextTokens,
  resolveContextTokenizer,
  resolveContextTokenizerAsync,
  type AiContextTokenizer,
} from './context-tokenizer'

const MIN_DYNAMIC_BUDGET_TOKENS = 1_024
const RESERVED_OUTPUT_RATIO = 0.2
const MAX_RESERVED_OUTPUT_TOKENS = 4_096
const MIN_RESERVED_OUTPUT_TOKENS = 1_024
const SAFETY_MARGIN_RATIO = 0.1
const MIN_SAFETY_MARGIN_TOKENS = 512
const SUMMARY_TRIGGER_RATIO = 0.6
const HYGIENE_TRIGGER_RATIO = 0.85

export interface AiResolvedContextWindow {
  contextWindowTokens: number
  label: string
  profileId?: string
  source: 'configured' | 'profile' | 'suffix_hint' | 'default'
}

export interface AiContextBudgetEstimate {
  dynamicBudgetTokens: number
  estimatedInputTokens: number
  maxContextTokens: number
  remainingInputTokens: number
  reservedOutputTokens: number
  safetyMarginTokens: number
  shouldHygiene: boolean
  shouldSummarize: boolean
  usageRatio: number
}

interface EstimateContextBudgetOptions {
  contextSystemPrompt?: string
  contextWindowTokens?: number
  messages: UIMessage[]
  model: string
  systemPrompt: string
  tokenizer?: AiContextTokenizer
  workingMemory?: AiWorkingMemory | null | undefined
  workingMemorySystemPrompt?: string
}

function normalizeRequestMessage(message: OpenAiRequestMessage): { content: string, role: 'assistant' | 'system' | 'user' } {
  if (message.role === 'tool') {
    return {
      role: 'user',
      content: message.content,
    }
  }

  if ('tool_calls' in message) {
    return {
      role: 'assistant',
      content: [
        message.content,
        ...message.tool_calls.map(toolCall => `${toolCall.function.name}(${toolCall.function.arguments})`),
      ]
        .filter(Boolean)
        .join('\n'),
    }
  }

  return message
}

function toSyntheticUiMessages(messages: OpenAiRequestMessage[]) {
  return messages.map((message) => {
    const normalizedMessage = normalizeRequestMessage(message)

    return {
      id: `${message.role}:${message.content.slice(0, 24)}`,
      role: normalizedMessage.role,
      parts: [{
        state: 'done' as const,
        type: 'text' as const,
        text: normalizedMessage.content,
      }],
    }
  })
}

export function formatContextWindowTokens(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 'unknown'
  }

  if (value >= 1_000_000) {
    return `${Math.round((value / 1_000_000) * 10) / 10}M`
  }

  if (value >= 1_000) {
    const rounded = Math.round((value / 1_000) * 10) / 10
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded}k`
  }

  return String(value)
}

export function resolveModelContextWindow(model: string): AiResolvedContextWindow {
  const normalizedModel = model.trim().toLowerCase()
  if (!normalizedModel) {
    return {
      contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
      label: 'Default fallback',
      source: 'default',
    }
  }

  const explicitWindowMatch = normalizedModel.match(/(\d+)\s*(k|m)\b/)
  if (explicitWindowMatch) {
    const value = Number.parseInt(explicitWindowMatch[1] || '0', 10)
    const unit = explicitWindowMatch[2]
    if (Number.isFinite(value) && value > 0) {
      return {
        contextWindowTokens: unit === 'm' ? value * 1_000_000 : value * 1_000,
        label: 'Model name suffix hint',
        source: 'suffix_hint',
      }
    }
  }

  const matchedProfile = matchModelContextProfile(normalizedModel)
  if (matchedProfile) {
    return {
      contextWindowTokens: matchedProfile.contextWindowTokens,
      label: matchedProfile.label,
      profileId: matchedProfile.id,
      source: 'profile',
    }
  }

  const genericWindowMatch = normalizedModel.match(/\b(8|16|32|64|128|200)\s*k\b/)
  if (genericWindowMatch) {
    const value = Number.parseInt(genericWindowMatch[1] || '0', 10)
    if (Number.isFinite(value) && value > 0) {
      return {
        contextWindowTokens: value * 1_000,
        label: 'Generic model name suffix hint',
        source: 'suffix_hint',
      }
    }
  }

  return {
    contextWindowTokens: DEFAULT_CONTEXT_WINDOW_TOKENS,
    label: 'Default fallback',
    source: 'default',
  }
}

export function resolveModelContextWindowTokens(model: string) {
  return resolveModelContextWindow(model).contextWindowTokens
}

export function resolveEffectiveContextWindow(
  model: string,
  configuredContextWindowTokens?: number | null,
): AiResolvedContextWindow {
  if (configuredContextWindowTokens && configuredContextWindowTokens > 0) {
    return {
      contextWindowTokens: Math.floor(configuredContextWindowTokens),
      label: 'Manual override',
      source: 'configured',
    }
  }

  return resolveModelContextWindow(model)
}

export function estimateContextBudget(options: EstimateContextBudgetOptions): AiContextBudgetEstimate {
  const requestMessages = buildOpenAiMessages(
    options.messages,
    options.systemPrompt,
    options.contextSystemPrompt || '',
    options.workingMemorySystemPrompt || '',
    options.workingMemory,
  )
  const resolvedTokenizer = resolveContextTokenizer(options.model, options.tokenizer || null)
  const tokenizer = resolvedTokenizer.tokenizer

  const resolvedContextWindow = resolveEffectiveContextWindow(options.model, options.contextWindowTokens)
  const maxContextTokens = resolvedContextWindow.contextWindowTokens
  const reservedOutputTokens = Math.min(
    MAX_RESERVED_OUTPUT_TOKENS,
    Math.max(MIN_RESERVED_OUTPUT_TOKENS, Math.floor(maxContextTokens * RESERVED_OUTPUT_RATIO)),
  )
  const safetyMarginTokens = Math.max(MIN_SAFETY_MARGIN_TOKENS, Math.floor(maxContextTokens * SAFETY_MARGIN_RATIO))
  const dynamicBudgetTokens = Math.max(
    MIN_DYNAMIC_BUDGET_TOKENS,
    maxContextTokens - reservedOutputTokens - safetyMarginTokens,
  )

  const estimatedInputTokens = countUiMessageTokens(toSyntheticUiMessages(requestMessages), tokenizer)
  const remainingInputTokens = dynamicBudgetTokens - estimatedInputTokens
  const usageRatio = estimatedInputTokens / dynamicBudgetTokens

  return {
    dynamicBudgetTokens,
    estimatedInputTokens,
    maxContextTokens,
    remainingInputTokens,
    reservedOutputTokens,
    safetyMarginTokens,
    shouldHygiene: usageRatio >= HYGIENE_TRIGGER_RATIO,
    shouldSummarize: usageRatio >= SUMMARY_TRIGGER_RATIO,
    usageRatio,
  }
}

export async function estimateContextBudgetAsync(options: EstimateContextBudgetOptions): Promise<AiContextBudgetEstimate> {
  const requestMessages = buildOpenAiMessages(
    options.messages,
    options.systemPrompt,
    options.contextSystemPrompt || '',
    options.workingMemorySystemPrompt || '',
    options.workingMemory,
  )
  const resolvedTokenizer = await resolveContextTokenizerAsync(options.model, options.tokenizer || null)
  const tokenizer = resolvedTokenizer.tokenizer

  const resolvedContextWindow = resolveEffectiveContextWindow(options.model, options.contextWindowTokens)
  const maxContextTokens = resolvedContextWindow.contextWindowTokens
  const reservedOutputTokens = Math.min(
    MAX_RESERVED_OUTPUT_TOKENS,
    Math.max(MIN_RESERVED_OUTPUT_TOKENS, Math.floor(maxContextTokens * RESERVED_OUTPUT_RATIO)),
  )
  const safetyMarginTokens = Math.max(MIN_SAFETY_MARGIN_TOKENS, Math.floor(maxContextTokens * SAFETY_MARGIN_RATIO))
  const dynamicBudgetTokens = Math.max(
    MIN_DYNAMIC_BUDGET_TOKENS,
    maxContextTokens - reservedOutputTokens - safetyMarginTokens,
  )

  const estimatedInputTokens = countUiMessageTokens(toSyntheticUiMessages(requestMessages), tokenizer)
  const remainingInputTokens = dynamicBudgetTokens - estimatedInputTokens
  const usageRatio = estimatedInputTokens / dynamicBudgetTokens

  return {
    dynamicBudgetTokens,
    estimatedInputTokens,
    maxContextTokens,
    remainingInputTokens,
    reservedOutputTokens,
    safetyMarginTokens,
    shouldHygiene: usageRatio >= HYGIENE_TRIGGER_RATIO,
    shouldSummarize: usageRatio >= SUMMARY_TRIGGER_RATIO,
    usageRatio,
  }
}
