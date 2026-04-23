import { describe, expect, it } from 'vitest'
import {
  applyWorkingMemoryToMessages,
  buildDetailedToolResultsPrompt,
  formatToolResultDataForPrompt,
  summarizeConversationMessages,
} from '@/features/ai-chat/model/memory/context-compression'
import { mergeConversationSummaryIntoWorkingMemory } from '@/features/ai-chat/model/working-memory'

describe('context compression helpers', () => {
  it('truncates note detail payloads for prompt hygiene', () => {
    const prompt = formatToolResultDataForPrompt({
      code: 'ok',
      data: {
        note: {
          id: 'note-1',
          title: '周报',
          summary: '这是一个很长的摘要'.repeat(20),
          updated: '2026-04-23 10:00:00',
          content: '<p>正文</p>'.repeat(400),
        },
        source: 'store',
      },
      message: 'ok',
      ok: true,
    })

    expect(prompt).toContain('noteId: note-1')
    expect(prompt).toContain('contentHtml:')
    expect(prompt).toContain('[已截断]')
  })

  it('limits detailed tool results and appends omission notice', () => {
    const prompt = buildDetailedToolResultsPrompt([
      { code: 'ok', message: '1', ok: true, preview: { affectedNoteIds: [], summary: '一', title: '一' } },
      { code: 'ok', message: '2', ok: true, preview: { affectedNoteIds: [], summary: '二', title: '二' } },
      { code: 'ok', message: '3', ok: true, preview: { affectedNoteIds: [], summary: '三', title: '三' } },
      { code: 'ok', message: '4', ok: true, preview: { affectedNoteIds: [], summary: '四', title: '四' } },
    ])

    expect(prompt).toContain('工具结果 1')
    expect(prompt).toContain('工具结果 3')
    expect(prompt).not.toContain('工具结果 4')
    expect(prompt).toContain('其余 1 条工具结果已省略')
  })

  it('summarizes middle messages and keeps head/tail protection', () => {
    const messages = Array.from({ length: 14 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      parts: [{
        type: 'text' as const,
        text: `第 ${index + 1} 条消息：${'正文'.repeat(80)}`,
      }],
    }))

    const summary = summarizeConversationMessages(messages)

    expect(summary?.sourceMessageIds.length).toBe(3)
    expect(summary?.sourceMessageIds).toEqual(['msg-4', 'msg-5', 'msg-6'])
    expect(summary?.summaryText).toContain('已压缩的历史消息摘要')
    expect(summary?.historySummary.progress[0]).toContain('第 4 条消息')
  })

  it('drops compressed middle messages when working memory is summarized', () => {
    const messages = Array.from({ length: 6 }, (_, index) => ({
      id: `msg-${index + 1}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      parts: [{
        type: 'text' as const,
        text: `第 ${index + 1} 条消息`,
      }],
    }))

    const visibleMessages = applyWorkingMemoryToMessages(messages, {
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'summarized',
      taskSummary: '已压缩历史',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-3', 'msg-4'],
    })

    expect(visibleMessages.map(message => message.id)).toEqual(['msg-1', 'msg-2', 'msg-5', 'msg-6'])
  })

  it('stores conversation summary in historySummary instead of taskSummary', () => {
    const memory = mergeConversationSummaryIntoWorkingMemory({
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'idle',
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }, {
      lastCompressionReason: 'history_summary',
      sourceMessageIds: ['msg-3'],
      historySummary: {
        blockers: [],
        constraints: ['先保持原始标题'],
        pending: ['确认是否直接写回'],
        progress: ['用户：先读一下周报'],
      },
    })

    expect(memory?.taskSummary).toBe('读取周报并总结重点')
    expect(memory?.historySummary?.progress[0]).toContain('先读一下周报')
    expect(memory?.historySummary?.constraints).toContain('先保持原始标题')
    expect(memory?.status).toBe('summarized')
  })
})
