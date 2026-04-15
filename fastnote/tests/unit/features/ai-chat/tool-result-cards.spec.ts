import { describe, expect, it } from 'vitest'
import { createToolResultCards } from '@/features/ai-chat/model/tool-result-cards'

describe('tool result cards', () => {
  it('creates list cards for note search results', () => {
    const cards = createToolResultCards([{
      ok: true,
      code: 'ok',
      message: null,
      preview: {
        title: '搜索备忘录',
        summary: '搜索关键字“周报”',
        affectedNoteIds: [],
      },
      data: [{
        id: 'note-1',
        title: '周报',
        summary: '本周项目推进',
        parentId: '',
        updated: '2026-04-15 10:00:00',
        isLocked: false,
        isDeleted: false,
      }],
    }])

    expect(cards[0]).toMatchObject({
      title: '搜索备忘录',
      status: 'success',
      items: [{
        action: {
          type: 'open-note',
          noteId: 'note-1',
        },
        id: 'note-1',
        meta: '根目录 · 更新于 2026-04-15 10:00:00',
        title: '周报',
      }],
    })
  })

  it('creates warning action cards for confirmation previews', () => {
    const cards = createToolResultCards([{
      ok: true,
      code: 'confirmation_required',
      message: null,
      preview: {
        title: '准备删除备忘录',
        summary: '将软删除备忘录 note-1',
        affectedNoteIds: ['note-1'],
      },
      requiresConfirmation: true,
      affectedNoteIds: ['note-1'],
    }])

    expect(cards[0]).toMatchObject({
      title: '准备删除备忘录',
      description: '将软删除备忘录 note-1',
      footer: '影响对象：note-1',
      status: 'warning',
    })
  })

  it('creates list cards for folder results with open action', () => {
    const cards = createToolResultCards([{
      ok: true,
      code: 'ok',
      message: null,
      preview: {
        title: '读取文件夹列表',
        summary: '读取根目录下的文件夹',
        affectedNoteIds: [],
      },
      data: [{
        id: 'folder-1',
        title: '项目资料',
        parentId: '',
        noteCount: 3,
      }],
    }])

    expect(cards[0]).toMatchObject({
      title: '读取文件夹列表',
      status: 'success',
      items: [{
        action: {
          type: 'open-folder',
          folderId: 'folder-1',
        },
        id: 'folder-1',
        meta: '根目录 · 3 项',
        title: '项目资料',
      }],
    })
  })
})
