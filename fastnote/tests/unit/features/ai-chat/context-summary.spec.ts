import { describe, expect, it, vi } from 'vitest'
import {
  applyConversationSummaryToWorkingMemoryAsync,
  createLlmContextSummarizer,
  deterministicContextSummarizer,
  resetContextSummaryCaches,
} from '@/features/ai-chat/model/memory/context-summary'

function createLongMessages() {
  return Array.from({ length: 14 }, (_, index) => ({
    id: `msg-${index + 1}`,
    role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
    parts: [{
      type: 'text' as const,
      text: `第 ${index + 1} 条消息：${'正文'.repeat(80)}`,
    }],
  }))
}

describe('context summary helpers', () => {
  it('reuses fresh summarized working memory for the same slice without re-calling the summarizer', async () => {
    resetContextSummaryCaches()
    const summarize = vi.fn(async () => ({
      historySummary: {
        blockers: [],
        constraints: [],
        pending: [],
        progress: ['不应被调用'],
      },
      sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
      summaryText: '已压缩的历史消息摘要：\n进展：\n- 不应被调用',
    }))

    const memory = await applyConversationSummaryToWorkingMemoryAsync({
      version: 1,
      taskId: 'task-fresh',
      scope: 'private',
      status: 'summarized',
      taskSummary: '读取周报并总结重点',
      historySummary: {
        blockers: [],
        constraints: ['保留原始标题'],
        pending: ['等待是否写回'],
        progress: ['已做过一次摘要'],
      },
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
    }, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      now: () => new Date('2026-04-23T10:00:30.000Z').getTime(),
      summarizer: {
        name: 'llm',
        summarize,
      },
      workingMemoryFreshnessMs: 60 * 1000,
    })

    expect(summarize).not.toHaveBeenCalled()
    expect(memory?.historySummary?.progress).toContain('已做过一次摘要')
    expect(memory?.lastCompressionReason).toBe('history_summary_reused')
  })

  it('re-summarizes stale working memory for the same slice after freshness expires', async () => {
    resetContextSummaryCaches()
    const summarize = vi.fn(async () => ({
      historySummary: {
        blockers: [],
        constraints: [],
        pending: [],
        progress: ['新的摘要'],
      },
      sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
      summaryText: '已压缩的历史消息摘要：\n进展：\n- 新的摘要',
    }))

    const memory = await applyConversationSummaryToWorkingMemoryAsync({
      version: 1,
      taskId: 'task-stale',
      scope: 'private',
      status: 'summarized',
      taskSummary: '读取周报并总结重点',
      historySummary: {
        blockers: [],
        constraints: ['旧约束'],
        pending: [],
        progress: ['旧摘要'],
      },
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
    }, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      now: () => new Date('2026-04-23T10:02:30.000Z').getTime(),
      summarizer: {
        name: 'llm',
        summarize,
      },
      workingMemoryFreshnessMs: 60 * 1000,
    })

    expect(summarize).toHaveBeenCalledTimes(1)
    expect(memory?.historySummary?.progress).toContain('新的摘要')
  })

  it('reuses cached async summary for the same task and message slice', async () => {
    resetContextSummaryCaches()
    const summarize = vi.fn(async () => ({
      historySummary: {
        blockers: [],
        constraints: ['保留原始语气'],
        pending: ['确认是否写回'],
        progress: ['缓存摘要'],
      },
      sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
      summaryText: '已压缩的历史消息摘要：\n进展：\n- 缓存摘要',
    }))
    const summarizer = {
      name: 'llm',
      summarize,
    }
    const baseMemory = {
      version: 1 as const,
      taskId: 'task-cache',
      scope: 'private',
      status: 'idle' as const,
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }

    const first = await applyConversationSummaryToWorkingMemoryAsync(baseMemory, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      summarizer,
    })
    const second = await applyConversationSummaryToWorkingMemoryAsync({
      ...baseMemory,
      status: 'idle',
      historySummary: undefined,
      sourceMessageIds: [],
    }, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      summarizer,
    })

    expect(summarize).toHaveBeenCalledTimes(1)
    expect(first?.historySummary?.progress).toContain('缓存摘要')
    expect(second?.historySummary?.progress).toContain('缓存摘要')
  })

  it('expires cached async summary after ttl and recomputes it', async () => {
    resetContextSummaryCaches()
    const summarize = vi.fn()
      .mockResolvedValueOnce({
        historySummary: {
          blockers: [],
          constraints: [],
          pending: [],
          progress: ['第一次摘要'],
        },
        sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
        summaryText: '已压缩的历史消息摘要：\n进展：\n- 第一次摘要',
      })
      .mockResolvedValueOnce({
        historySummary: {
          blockers: [],
          constraints: [],
          pending: [],
          progress: ['第二次摘要'],
        },
        sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
        summaryText: '已压缩的历史消息摘要：\n进展：\n- 第二次摘要',
      })
    const summarizer = {
      name: 'llm',
      summarize,
    }
    const baseMemory = {
      version: 1 as const,
      taskId: 'task-cache-expire',
      scope: 'private',
      status: 'idle' as const,
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }

    const first = await applyConversationSummaryToWorkingMemoryAsync(baseMemory, createLongMessages(), {
      cacheTtlMs: 30 * 1000,
      fallbackSummarizer: deterministicContextSummarizer,
      now: () => new Date('2026-04-23T10:00:00.000Z').getTime(),
      summarizer,
    })
    const second = await applyConversationSummaryToWorkingMemoryAsync(baseMemory, createLongMessages(), {
      cacheTtlMs: 30 * 1000,
      fallbackSummarizer: deterministicContextSummarizer,
      now: () => new Date('2026-04-23T10:00:45.000Z').getTime(),
      summarizer,
    })

    expect(summarize).toHaveBeenCalledTimes(2)
    expect(first?.historySummary?.progress).toContain('第一次摘要')
    expect(second?.historySummary?.progress).toContain('第二次摘要')
  })

  it('deduplicates in-flight async summary requests for the same key', async () => {
    resetContextSummaryCaches()
    let release: (() => void) | null = null
    const summarize = vi.fn(() => new Promise<{
      historySummary: {
        blockers: string[]
        constraints: string[]
        pending: string[]
        progress: string[]
      }
      sourceMessageIds: string[]
      summaryText: string
    }>((resolve) => {
      release = () => resolve({
        historySummary: {
          blockers: [],
          constraints: [],
          pending: ['等待用户确认'],
          progress: ['并发摘要'],
        },
        sourceMessageIds: ['msg-4', 'msg-5', 'msg-6'],
        summaryText: '已压缩的历史消息摘要：\n进展：\n- 并发摘要',
      })
    }))
    const summarizer = {
      name: 'llm',
      summarize,
    }
    const baseMemory = {
      version: 1 as const,
      taskId: 'task-inflight',
      scope: 'private',
      status: 'idle' as const,
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }

    const firstPromise = applyConversationSummaryToWorkingMemoryAsync(baseMemory, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      summarizer,
    })
    const secondPromise = applyConversationSummaryToWorkingMemoryAsync(baseMemory, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      summarizer,
    })

    expect(summarize).toHaveBeenCalledTimes(1)
    release?.()
    const [first, second] = await Promise.all([firstPromise, secondPromise])

    expect(first?.historySummary?.progress).toContain('并发摘要')
    expect(second?.historySummary?.progress).toContain('并发摘要')
  })

  it('creates an llm summarizer that rewrites deterministic history summary', async () => {
    resetContextSummaryCaches()
    const complete = vi.fn(async () => [
      '约束：',
      '- 保留原始标题',
      '',
      '进展：',
      '- 已完成首轮阅读',
      '',
      '阻塞：',
      '- 无',
      '',
      '待处理：',
      '- 等待用户确认是否写回',
    ].join('\n'))
    const summarizer = createLlmContextSummarizer({ complete })

    const result = await summarizer.summarize({
      messages: createLongMessages(),
      previousMemory: {
        version: 1,
        taskId: 'task-1',
        scope: 'private',
        status: 'idle',
        taskSummary: '读取周报并总结重点',
        lastCompressionAt: '2026-04-23T10:00:00.000Z',
        sourceMessageIds: [],
      },
    })

    expect(complete).toHaveBeenCalledTimes(1)
    expect(result?.sourceMessageIds.length).toBe(3)
    expect(result?.historySummary.constraints).toContain('保留原始标题')
    expect(result?.historySummary.progress).toContain('已完成首轮阅读')
    expect(result?.historySummary.pending).toContain('等待用户确认是否写回')
    expect(result?.summaryText).toContain('约束：')
  })

  it('falls back to deterministic summary when llm summarizer fails', async () => {
    resetContextSummaryCaches()
    const memory = await applyConversationSummaryToWorkingMemoryAsync({
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'idle',
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }, createLongMessages(), {
      fallbackSummarizer: deterministicContextSummarizer,
      summarizer: {
        name: 'llm',
        summarize: async () => {
          throw new Error('llm_failed')
        },
      },
    })

    expect(memory?.status).toBe('summarized')
    expect(memory?.historySummary?.progress[0]).toContain('第 4 条消息')
  })
})
