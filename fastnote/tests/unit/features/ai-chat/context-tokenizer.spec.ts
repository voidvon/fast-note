import { describe, expect, it } from 'vitest'
import {
  countUiMessageTokens,
  describeContextTokenizer,
  estimateTextTokens,
  heuristicContextTokenizer,
  resolveContextTokenizer,
  resolveContextTokenizerAsync,
} from '@/features/ai-chat/model/memory/context-tokenizer'

describe('context tokenizer helpers', () => {
  it('provides a reusable heuristic tokenizer', () => {
    expect(heuristicContextTokenizer.name).toBe('heuristic')
    expect(estimateTextTokens('读取当前备忘录')).toBeGreaterThan(0)
  })

  it('resolves profile-based tokenizers for known model families', () => {
    const resolved = resolveContextTokenizer('claude-3-7-sonnet')

    expect(resolved.source).toBe('profile')
    expect(resolved.name).toBe('anthropic-like')
    expect(resolved.implementation).toBe('heuristic')
  })

  it('describes real tokenizer support for supported openai families', () => {
    const resolved = describeContextTokenizer('gpt-4.1-mini')

    expect(resolved.source).toBe('profile')
    expect(resolved.implementation).toBe('tiktoken')
    expect(resolved.name).toBe('o200k_base')
  })

  it('loads a real tiktoken implementation asynchronously for supported openai families', async () => {
    const resolved = await resolveContextTokenizerAsync('gpt-4.1-mini')

    expect(resolved.source).toBe('profile')
    expect(resolved.implementation).toBe('tiktoken')
    expect(resolved.name).toBe('o200k_base')
    expect(resolved.tokenizer.countTextTokens('hello world')).toBeGreaterThan(0)
  })

  it('counts ui message tokens with default message overhead', () => {
    const tokenCount = countUiMessageTokens([{
      id: 'msg-1',
      role: 'user',
      parts: [{
        state: 'done' as const,
        type: 'text' as const,
        text: '请读取这条周报并总结重点',
      }],
    }])

    expect(tokenCount).toBeGreaterThan(6)
  })

  it('allows swapping in a custom tokenizer implementation', () => {
    const tokenCount = countUiMessageTokens([{
      id: 'msg-1',
      role: 'user',
      parts: [{
        state: 'done' as const,
        type: 'text' as const,
        text: '任意文本',
      }],
    }], {
      countTextTokens: () => 10,
      label: 'Custom tokenizer',
      name: 'custom',
    })

    expect(tokenCount).toBe(20)
  })

  it('prefers explicit custom tokenizers over model-based resolution', () => {
    const resolved = resolveContextTokenizer('gpt-4.1-mini', {
      countTextTokens: () => 1,
      implementation: 'heuristic',
      label: 'Injected tokenizer',
      name: 'injected',
    })

    expect(resolved.source).toBe('custom')
    expect(resolved.name).toBe('injected')
  })
})
