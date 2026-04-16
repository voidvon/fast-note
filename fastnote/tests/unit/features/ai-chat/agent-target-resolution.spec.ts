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

  it('resolves note id from a FastNote note url', () => {
    expect(resolveAiChatTarget('读取 http://localhost:8888/n/note-2 并帮我改写', context)).toMatchObject({
      source: 'message_note_url',
      note: {
        id: 'note-2',
        title: '会议纪要',
      },
    })
  })

  it('resolves active note for current-note references', () => {
    expect(resolveAiChatTarget('读取这条笔记并帮我总结', context)).toMatchObject({
      source: 'active_note',
      note: {
        id: 'note-1',
      },
    })
  })

  it('resolves folder id from a FastNote folder url', () => {
    expect(resolveAiChatTarget('查看 /f/root/folder-88 这个目录', context)).toMatchObject({
      source: 'message_folder_url',
      folder: {
        id: 'folder-88',
        title: '链接中的目录',
      },
    })
  })
})
