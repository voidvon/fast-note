import { describe, expect, it } from 'vitest'
import { createAgentTask, updateAgentTask } from '@/features/ai-chat/model/agent-task'
import {
  applyConversationSummaryToWorkingMemory,
  deterministicContextSummarizer,
} from '@/features/ai-chat/model/memory/context-summary'
import {
  AI_CHAT_WORKING_MEMORY_BODY_KEY,
  buildAiWorkingMemorySystemPrompt,
  createAiWorkingMemoryFromTask,
  extractAiWorkingMemory,
} from '@/features/ai-chat/model/working-memory'

describe('working memory helpers', () => {
  it('builds working memory from task and request context', () => {
    const baseTask = createAgentTask('读取当前备忘录并改写')
    const task = updateAgentTask(baseTask, {
      lastRewriteSuggestion: '建议先保留标题，再改写正文。',
      status: 'waiting_confirmation',
    })

    const memory = createAiWorkingMemoryFromTask(task, {
      context: {
        resolvedTarget: {
          source: 'message_note_url',
          note: {
            id: 'note-1',
            title: '周报',
            summary: '本周需要整理的工作',
            parentId: '',
            updated: '2026-04-20 10:00:00',
            isDeleted: false,
            isLocked: false,
          },
        },
      },
      latestToolResultSummary: '已读取正文并提炼出 3 条改写建议',
      scope: 'private',
    })

    expect(memory?.taskId).toBe(task.id)
    expect(memory?.activeTargetSummary).toContain('note-1')
    expect(memory?.latestToolResultSummary).toContain('3 条改写建议')
    expect(memory?.pendingMutationSummary).toContain('建议先保留标题')
  })

  it('falls back to the latest mentioned target when no resolved target is present', () => {
    const task = createAgentTask('总结这两个对象')

    const memory = createAiWorkingMemoryFromTask(task, {
      context: {
        mentionedTargets: [{
          id: 'note-1',
          title: '周报',
          type: 'note',
          routePath: '/n/note-1',
          source: 'message_mention',
        }, {
          id: 'folder-1',
          title: '产品文档',
          type: 'folder',
          routePath: '/f/folder-1',
          source: 'message_mention',
        }],
      },
      scope: 'private',
    })

    expect(memory?.activeTargetSummary).toContain('提及目录：产品文档 [folder-1]')
  })

  it('extracts working memory from request body and strips internal field', () => {
    const result = extractAiWorkingMemory({
      [AI_CHAT_WORKING_MEMORY_BODY_KEY]: {
        version: 1,
        taskId: 'task-1',
        scope: 'private',
        status: 'summarized',
        taskSummary: '读取周报并总结重点',
        lastCompressionAt: '2026-04-23T10:00:00.000Z',
        sourceMessageIds: ['msg-1'],
      },
      temperature: 0.2,
    })

    expect(result.workingMemory).toMatchObject({
      taskId: 'task-1',
      status: 'summarized',
    })
    expect(result.requestBody).toEqual({
      temperature: 0.2,
    })
  })

  it('formats working memory into a system prompt', () => {
    const prompt = buildAiWorkingMemorySystemPrompt({
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'summarized',
      taskSummary: '读取周报并总结重点',
      historySummary: {
        blockers: ['上一次工具调用超时'],
        constraints: ['保留原始标题'],
        pending: ['确认是否直接写回'],
        progress: ['用户：先读一下这条周报'],
      },
      activeTargetSummary: '目标备忘录：周报 [note-1]',
      latestToolResultSummary: '已读取正文',
      pendingMutationSummary: '待确认写回摘要',
      recentErrorSummary: '最近一次请求超时',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-1'],
    })

    expect(prompt).toContain('任务工作记忆')
    expect(prompt).toContain('读取周报并总结重点')
    expect(prompt).toContain('历史消息摘要')
    expect(prompt).toContain('约束：')
    expect(prompt).toContain('进展：')
    expect(prompt).toContain('目标备忘录：周报 [note-1]')
    expect(prompt).toContain('待确认写回摘要')
    expect(prompt).toContain('最近一次请求超时')
  })

  it('marks working memory as partial_failed when summary generation throws', () => {
    const memory = applyConversationSummaryToWorkingMemory({
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'idle',
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-1'],
    }, [{
      id: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: '读取这条周报' }],
    }], {
      summarizer: {
        name: 'broken',
        summarize: () => {
          throw new Error('summary_failed')
        },
      },
    })

    expect(memory?.status).toBe('partial_failed')
    expect(memory?.lastCompressionReason).toContain('broken:summary_failed')
    expect(memory?.sourceMessageIds).toEqual([])
  })

  it('allows swapping in a custom summarizer implementation', () => {
    const memory = applyConversationSummaryToWorkingMemory({
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'idle',
      taskSummary: '读取周报并总结重点',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: [],
    }, [{
      id: 'msg-1',
      role: 'user',
      parts: [{ type: 'text', text: '读取这条周报' }],
    }], {
      summarizer: {
        name: 'custom',
        summarize: () => ({
          historySummary: {
            blockers: [],
            constraints: ['保留标题'],
            pending: ['确认是否覆盖原文'],
            progress: ['读取周报'],
          },
          sourceMessageIds: ['msg-1'],
          summaryText: '已压缩的历史消息摘要：\n进展：\n- 读取周报',
        }),
      },
    })

    expect(deterministicContextSummarizer.name).toBe('deterministic')
    expect(memory?.historySummary?.progress).toContain('读取周报')
    expect(memory?.historySummary?.constraints).toContain('保留标题')
    expect(memory?.status).toBe('summarized')
  })
})
