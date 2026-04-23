import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  matchModelContextProfile,
  MODEL_CONTEXT_PROFILES,
} from '@/features/ai-chat/model/memory/model-context-profiles'

describe('model context profiles', () => {
  it('defines common provider families as maintainable profiles', () => {
    expect(MODEL_CONTEXT_PROFILES.some(profile => profile.id === 'openai-gpt-4.1')).toBe(true)
    expect(MODEL_CONTEXT_PROFILES.some(profile => profile.id === 'anthropic-claude')).toBe(true)
    expect(MODEL_CONTEXT_PROFILES.some(profile => profile.id === 'qwen-family')).toBe(true)
  })

  it('matches provider family profiles by model name', () => {
    expect(matchModelContextProfile('gpt-4.1-mini')?.id).toBe('openai-gpt-4.1')
    expect(matchModelContextProfile('claude-3-7-sonnet')?.id).toBe('anthropic-claude')
    expect(matchModelContextProfile('deepseek-chat')?.id).toBe('deepseek-family')
  })

  it('returns null when no profile matches', () => {
    expect(matchModelContextProfile('custom-internal-model')).toBeNull()
    expect(DEFAULT_CONTEXT_WINDOW_TOKENS).toBe(32768)
  })
})
