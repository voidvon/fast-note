import { describe, expect, it } from 'vitest'
import { resolveAiChatTarget } from '@/features/ai-chat/model/target-resolution'

describe('resolveAiChatTarget', () => {
  const context = {
    activeFolder: {
      id: 'folder-1',
      title: '产品文档',
      kind: 'folder' as const,
    },
    activeNote: {
      id: 'note-1',
      title: '周报',
      summary: '待整理',
      parentId: 'folder-1',
      updated: '2026-04-16 10:00:00',
      isDeleted: false,
      isLocked: false,
    },
    candidateNotes: [{
      id: 'note-2',
      title: '会议纪要',
      summary: '包含待办',
      parentId: 'folder-1',
      updated: '2026-04-16 09:30:00',
      isDeleted: false,
      isLocked: false,
    }],
    recentNotes: [],
  }

  it('resolves note id from a fastnote note url', () => {
    expect(resolveAiChatTarget('读取 http://localhost:8888/n/note-2 并帮我改写', context)).toMatchObject({
      source: 'message_note_url',
      note: {
        id: 'note-2',
        title: '会议纪要',
      },
    })
  })

  it('does not resolve natural-language current-note references without explicit links', () => {
    expect(resolveAiChatTarget('读取这条笔记并帮我总结', context)).toBeNull()
  })

  it('resolves folder id from a fastnote folder url', () => {
    expect(resolveAiChatTarget('查看 /f/root/folder-88 这个目录', context)).toMatchObject({
      source: 'message_folder_url',
      folder: {
        id: 'folder-88',
        title: '链接中的目录',
      },
    })
  })

  it('prefers the last explicit target when multiple note and folder references coexist', () => {
    expect(resolveAiChatTarget('先看 @周报(/n/note-1)，再处理 @产品文档(/f/folder-1)', context)).toMatchObject({
      source: 'message_folder_url',
      folder: {
        id: 'folder-1',
        title: '产品文档',
      },
    })
  })

  it('keeps using the last explicit target as a weak hint for multi-target messages', () => {
    expect(resolveAiChatTarget('把 @周报(/n/note-1) 移到 @产品文档(/f/folder-1)', context)).toMatchObject({
      source: 'message_folder_url',
      folder: {
        id: 'folder-1',
        title: '产品文档',
      },
    })
  })

  it('keeps the last explicit note target for compare messages and leaves full semantics to mentioned targets', () => {
    expect(resolveAiChatTarget('比较 @周报(/n/note-1) 和 @会议纪要(/n/note-2)', context)).toMatchObject({
      source: 'message_note_url',
      note: {
        id: 'note-2',
        title: '会议纪要',
      },
    })
  })
})
