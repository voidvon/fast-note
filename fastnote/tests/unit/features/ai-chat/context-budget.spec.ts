import { describe, expect, it } from 'vitest'
import {
  estimateContextBudget,
  estimateContextBudgetAsync,
  formatContextWindowTokens,
  resolveEffectiveContextWindow,
  resolveModelContextWindow,
  resolveModelContextWindowTokens,
} from '@/features/ai-chat/model/memory/context-budget'
import { estimateTextTokens } from '@/features/ai-chat/model/memory/context-tokenizer'

function createMessages(count: number, textLength: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `msg-${index + 1}`,
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    parts: [{
      type: 'text' as const,
      text: `第 ${index + 1} 条消息：${'正文'.repeat(Math.ceil(textLength / 2))}`,
    }],
  }))
}

describe('context budget helpers', () => {
  it('estimates text tokens for multilingual content', () => {
    expect(estimateTextTokens('')).toBe(0)
    expect(estimateTextTokens('hello world')).toBeGreaterThan(0)
    expect(estimateTextTokens('读取当前备忘录并总结重点')).toBeGreaterThan(estimateTextTokens('hello'))
  })

  it('resolves common model context windows conservatively', () => {
    expect(resolveModelContextWindowTokens('gpt-4.1-mini')).toBe(128000)
    expect(resolveModelContextWindowTokens('qwen2.5-32k-instruct')).toBe(32000)
    expect(resolveModelContextWindowTokens('')).toBe(32768)
  })

  it('resolves model context window profiles with source metadata', () => {
    const resolved = resolveModelContextWindow('claude-3-7-sonnet')

    expect(resolved.contextWindowTokens).toBe(200000)
    expect(resolved.source).toBe('profile')
    expect(resolved.profileId).toBe('anthropic-claude')
  })

  it('prefers explicit context window tokens over model-name inference', () => {
    const estimate = estimateContextBudget({
      contextWindowTokens: 16000,
      messages: createMessages(2, 120),
      model: 'gpt-4.1-mini',
      systemPrompt: '系统提示',
    })

    expect(estimate.maxContextTokens).toBe(16000)
  })

  it('loads real tokenizer implementations asynchronously for supported model families', async () => {
    const estimate = await estimateContextBudgetAsync({
      messages: createMessages(2, 120),
      model: 'gpt-4.1-mini',
      systemPrompt: '系统提示',
    })

    expect(estimate.maxContextTokens).toBe(128000)
    expect(estimate.estimatedInputTokens).toBeGreaterThan(0)
  })

  it('formats and resolves effective context windows for configured overrides', () => {
    const resolved = resolveEffectiveContextWindow('gpt-4.1-mini', 64000)

    expect(resolved.contextWindowTokens).toBe(64000)
    expect(resolved.source).toBe('configured')
    expect(formatContextWindowTokens(resolved.contextWindowTokens)).toBe('64k')
  })

  it('uses injected tokenizer implementations when estimating prompt size', () => {
    const estimate = estimateContextBudget({
      messages: createMessages(2, 120),
      model: 'mock-8k',
      systemPrompt: '系统提示',
      tokenizer: {
        countTextTokens: () => 100,
        name: 'fixed',
      },
    })

    expect(estimate.estimatedInputTokens).toBeGreaterThanOrEqual(304)
  })

  it('marks long requests as needing summary when nearing the dynamic budget', () => {
    const estimate = estimateContextBudget({
      messages: createMessages(18, 1200),
      model: 'mock-8k',
      systemPrompt: '系统提示',
    })

    expect(estimate.maxContextTokens).toBe(8000)
    expect(estimate.estimatedInputTokens).toBeGreaterThan(0)
    expect(estimate.shouldSummarize).toBe(true)
    expect(estimate.shouldHygiene).toBe(true)
    expect(estimate.usageRatio).toBeGreaterThanOrEqual(0.85)
  })

  it('accounts for summarized working memory dropping compressed middle messages', () => {
    const messages = createMessages(14, 800)
    const fullEstimate = estimateContextBudget({
      messages,
      model: 'mock-8k',
      systemPrompt: '系统提示',
    })
    const summarizedEstimate = estimateContextBudget({
      messages,
      model: 'mock-8k',
      systemPrompt: '系统提示',
      workingMemory: {
        version: 1,
        taskId: 'task-1',
        scope: 'private',
        status: 'summarized',
        taskSummary: '读取周报并总结重点',
        lastCompressionAt: '2026-04-23T10:00:00.000Z',
        sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
      },
      workingMemorySystemPrompt: '任务工作记忆',
    })

    expect(summarizedEstimate.estimatedInputTokens).toBeLessThan(fullEstimate.estimatedInputTokens)
  })
})
