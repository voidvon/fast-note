import { describe, expect, it } from 'vitest'
import {
  AI_CHAT_REQUEST_CONTEXT_BODY_KEY,
  buildAiChatContextSystemPrompt,
  extractAiChatRequestContext,
  toAiChatContextNote,
} from '@/features/ai-chat/model/request-context'

describe('ai chat request context helpers', () => {
  it('formats note context into a short system prompt', () => {
    const prompt = buildAiChatContextSystemPrompt({
      source: 'home_global_search',
      routePath: '/home',
      activeFolder: {
        id: 'allnotes',
        title: '全部备忘录',
        kind: 'special',
      },
      activeNote: {
        id: 'note-1',
        title: '周报',
        summary: '准备整理工作进展',
        parentId: '',
        updated: '2026-04-15 10:00:00',
        isDeleted: false,
        isLocked: true,
      },
      recentNotes: [{
        id: 'note-2',
        title: '会议纪要',
        summary: '包含待办列表',
        parentId: '',
        updated: '2026-04-15 09:30:00',
        isDeleted: false,
        isLocked: false,
      }],
    })

    expect(prompt).toContain('当前入口')
    expect(prompt).toContain('当前选中备忘录')
    expect(prompt).toContain('最近更新的备忘录')
  })

  it('extracts internal context from request body', () => {
    const result = extractAiChatRequestContext({
      [AI_CHAT_REQUEST_CONTEXT_BODY_KEY]: {
        source: 'home_global_search',
      },
      temperature: 0.2,
    })

    expect(result.context).toMatchObject({
      source: 'home_global_search',
    })
    expect(result.requestBody).toEqual({
      temperature: 0.2,
    })
  })

  it('maps note records into lightweight context notes', () => {
    expect(toAiChatContextNote({
      id: 'note-1',
      title: '很长很长很长很长很长的标题需要被截断',
      summary: '这里是一段很长很长很长很长很长的摘要，需要被截断以控制 token。',
      content: '<p>ignored</p>',
      created: '2026-04-15 09:00:00',
      updated: '2026-04-15 10:00:00',
      item_type: 2,
      parent_id: '',
      is_deleted: 0,
      is_locked: 1,
      note_count: 0,
      files: [],
    })?.isLocked).toBe(true)
  })
})
