import type { UIMessage } from 'ai'
import { matchModelContextProfile } from './model-context-profiles'

const MESSAGE_OVERHEAD_TOKENS = 6
const REQUEST_OVERHEAD_TOKENS = 4

export interface AiContextTokenizer {
  countTextTokens: (text: string) => number
  countUiMessageTokens?: (message: UIMessage) => number
  implementation?: 'heuristic' | 'tiktoken'
  label?: string
  name: string
  source?: 'custom' | 'default' | 'profile'
}

export interface AiResolvedContextTokenizer {
  implementation: 'heuristic' | 'tiktoken'
  label: string
  name: string
  source: 'custom' | 'default' | 'profile'
  tokenizer: AiContextTokenizer
}

interface HeuristicTokenizerProfile {
  cjkWeight: number
  id: string
  label: string
  otherCharDivisor: number
  punctuationWeight: number
  whitespaceWeight: number
}

const HEURISTIC_TOKENIZER_PROFILES: HeuristicTokenizerProfile[] = [
  {
    cjkWeight: 1.15,
    id: 'openai-like',
    label: 'OpenAI-like heuristic',
    otherCharDivisor: 3.9,
    punctuationWeight: 0.15,
    whitespaceWeight: 0.1,
  },
  {
    cjkWeight: 1.08,
    id: 'anthropic-like',
    label: 'Anthropic-like heuristic',
    otherCharDivisor: 4.2,
    punctuationWeight: 0.14,
    whitespaceWeight: 0.08,
  },
  {
    cjkWeight: 1.02,
    id: 'gemini-like',
    label: 'Gemini-like heuristic',
    otherCharDivisor: 4.5,
    punctuationWeight: 0.12,
    whitespaceWeight: 0.08,
  },
  {
    cjkWeight: 1.28,
    id: 'cjk-dense',
    label: 'CJK-dense heuristic',
    otherCharDivisor: 3.6,
    punctuationWeight: 0.18,
    whitespaceWeight: 0.1,
  },
  {
    cjkWeight: 1.2,
    id: 'balanced',
    label: 'Balanced heuristic',
    otherCharDivisor: 3.8,
    punctuationWeight: 0.15,
    whitespaceWeight: 0.1,
  },
]

let openAiO200kTokenizerInstancePromise: Promise<AiContextTokenizer> | null = null

function countMatches(text: string, pattern: RegExp) {
  return text.match(pattern)?.length || 0
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

export function createHeuristicTokenizer(profile: HeuristicTokenizerProfile): AiContextTokenizer {
  const countTextTokens = (text: string) => {
    if (!text.trim()) {
      return 0
    }

    const cjkCount = countMatches(text, /[\u3400-\u9FFF\uF900-\uFAFF]/g)
    const whitespaceCount = countMatches(text, /\s/g)
    const punctuationCount = countMatches(text, /[{}[\]():,."`<>/\\_|@#$%^&*+=~-]/g)
    const otherCharCount = Math.max(0, text.length - cjkCount - whitespaceCount)

    return Math.max(
      1,
      Math.ceil(
        cjkCount * profile.cjkWeight
        + otherCharCount / profile.otherCharDivisor
        + whitespaceCount * profile.whitespaceWeight
        + punctuationCount * profile.punctuationWeight,
      ),
    )
  }

  return {
    countTextTokens,
    countUiMessageTokens(message) {
      return MESSAGE_OVERHEAD_TOKENS + countTextTokens(extractPlainText(message))
    },
    implementation: 'heuristic',
    label: profile.label,
    name: profile.id,
    source: 'profile',
  }
}

const defaultHeuristicProfile = HEURISTIC_TOKENIZER_PROFILES.find(profile => profile.id === 'balanced')
  || HEURISTIC_TOKENIZER_PROFILES[0]

export const heuristicContextTokenizer: AiContextTokenizer = {
  ...createHeuristicTokenizer(defaultHeuristicProfile),
  implementation: 'heuristic',
  name: 'heuristic',
  source: 'default',
}

export function estimateTextTokens(text: string) {
  return heuristicContextTokenizer.countTextTokens(text)
}

async function loadOpenAiO200kTokenizer() {
  if (openAiO200kTokenizerInstancePromise) {
    return await openAiO200kTokenizerInstancePromise
  }

  openAiO200kTokenizerInstancePromise = (async () => {
    const [{ Tiktoken }, { default: o200k_base }] = await Promise.all([
      import('js-tiktoken/lite'),
      import('js-tiktoken/ranks/o200k_base'),
    ])
    const encoder = new Tiktoken(o200k_base)

    return {
      countTextTokens(text) {
        if (!text.trim()) {
          return 0
        }

        return encoder.encode(text).length
      },
      countUiMessageTokens(message) {
        return MESSAGE_OVERHEAD_TOKENS + encoder.encode(extractPlainText(message)).length
      },
      implementation: 'tiktoken' as const,
      label: 'OpenAI o200k_base tokenizer',
      name: 'o200k_base',
      source: 'profile' as const,
    } satisfies AiContextTokenizer
  })()
    .catch((error) => {
      openAiO200kTokenizerInstancePromise = null
      throw error
    })

  return await openAiO200kTokenizerInstancePromise
}

export function describeContextTokenizer(model: string, customTokenizer?: AiContextTokenizer | null) {
  if (customTokenizer) {
    return {
      implementation: customTokenizer.implementation || 'heuristic',
      label: customTokenizer.label || customTokenizer.name,
      name: customTokenizer.name,
      source: 'custom' as const,
    }
  }

  const matchedProfile = matchModelContextProfile(model)
  if (matchedProfile?.realTokenizerEncoding === 'o200k_base') {
    return {
      implementation: 'tiktoken' as const,
      label: 'OpenAI o200k_base tokenizer',
      name: 'o200k_base',
      source: 'profile' as const,
    }
  }

  if (matchedProfile?.tokenizerProfileId) {
    const tokenizerProfile = HEURISTIC_TOKENIZER_PROFILES.find(profile => profile.id === matchedProfile.tokenizerProfileId)
    if (tokenizerProfile) {
      return {
        implementation: 'heuristic' as const,
        label: tokenizerProfile.label,
        name: tokenizerProfile.id,
        source: 'profile' as const,
      }
    }
  }

  return {
    implementation: heuristicContextTokenizer.implementation || 'heuristic',
    label: heuristicContextTokenizer.label || heuristicContextTokenizer.name,
    name: heuristicContextTokenizer.name,
    source: 'default' as const,
  }
}

export function resolveContextTokenizer(model: string, customTokenizer?: AiContextTokenizer | null): AiResolvedContextTokenizer {
  const matchedProfile = matchModelContextProfile(model)
  const described = describeContextTokenizer(model, customTokenizer)

  if (customTokenizer) {
    return { ...described, tokenizer: customTokenizer }
  }

  if (matchedProfile?.tokenizerProfileId) {
    const tokenizerProfile = HEURISTIC_TOKENIZER_PROFILES.find(profile => profile.id === matchedProfile.tokenizerProfileId)
    if (tokenizerProfile) {
      return {
        ...described,
        tokenizer: createHeuristicTokenizer(tokenizerProfile),
      }
    }
  }

  return {
    ...described,
    tokenizer: heuristicContextTokenizer,
  }
}

export async function resolveContextTokenizerAsync(model: string, customTokenizer?: AiContextTokenizer | null): Promise<AiResolvedContextTokenizer> {
  const matchedProfile = matchModelContextProfile(model)
  const described = describeContextTokenizer(model, customTokenizer)

  if (customTokenizer) {
    return { ...described, tokenizer: customTokenizer }
  }

  if (matchedProfile?.realTokenizerEncoding === 'o200k_base') {
    try {
      return {
        ...described,
        tokenizer: await loadOpenAiO200kTokenizer(),
      }
    }
    catch {
      return resolveContextTokenizer(model, customTokenizer)
    }
  }

  return resolveContextTokenizer(model, customTokenizer)
}

export function countUiMessageTokens(
  messages: UIMessage[],
  tokenizer: AiContextTokenizer = heuristicContextTokenizer,
) {
  return messages.reduce((sum, message) => {
    if (tokenizer.countUiMessageTokens) {
      return sum + tokenizer.countUiMessageTokens(message)
    }

    return sum + MESSAGE_OVERHEAD_TOKENS + tokenizer.countTextTokens(extractPlainText(message))
  }, REQUEST_OVERHEAD_TOKENS)
}
