export interface AiModelContextProfile {
  contextWindowTokens: number
  id: string
  label: string
  realTokenizerEncoding?: 'o200k_base' | 'cl100k_base'
  test: RegExp
  tokenizerProfileId?: string
}

export const DEFAULT_CONTEXT_WINDOW_TOKENS = 32_768

export const MODEL_CONTEXT_PROFILES: AiModelContextProfile[] = [
  {
    contextWindowTokens: 128_000,
    id: 'openai-gpt-4.1',
    label: 'GPT-4.1 family',
    realTokenizerEncoding: 'o200k_base',
    test: /\bgpt-4\.1(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'openai-like',
  },
  {
    contextWindowTokens: 128_000,
    id: 'openai-gpt-4o',
    label: 'GPT-4o family',
    realTokenizerEncoding: 'o200k_base',
    test: /\bgpt-4o(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'openai-like',
  },
  {
    contextWindowTokens: 200_000,
    id: 'openai-o-series',
    label: 'OpenAI o-series',
    realTokenizerEncoding: 'o200k_base',
    test: /\bo[134](?:[-.\w]*)?\b/,
    tokenizerProfileId: 'openai-like',
  },
  {
    contextWindowTokens: 200_000,
    id: 'anthropic-claude',
    label: 'Claude family',
    test: /\bclaude(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'anthropic-like',
  },
  {
    contextWindowTokens: 200_000,
    id: 'google-gemini',
    label: 'Gemini family',
    test: /\bgemini(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'gemini-like',
  },
  {
    contextWindowTokens: 128_000,
    id: 'qwen-family',
    label: 'Qwen family',
    test: /\bqwen(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'cjk-dense',
  },
  {
    contextWindowTokens: 128_000,
    id: 'deepseek-family',
    label: 'DeepSeek family',
    test: /\bdeepseek(?:[-.\w]*)?\b/,
    tokenizerProfileId: 'balanced',
  },
]

export function matchModelContextProfile(model: string) {
  const normalizedModel = model.trim().toLowerCase()
  if (!normalizedModel) {
    return null
  }

  return MODEL_CONTEXT_PROFILES.find(profile => profile.test.test(normalizedModel)) || null
}
