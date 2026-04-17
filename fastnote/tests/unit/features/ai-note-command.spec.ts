import type { Note } from '@/shared/types'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useAiNoteCommand } from '@/features/ai-note-command'

const baseNote: Note = {
  id: 'note-1',
  title: '周报',
  summary: '待整理',
  content: '<p>原始内容</p>',
  created: '2026-03-20 09:00:00',
  updated: '2026-03-20 09:30:00',
  item_type: 2,
  parent_id: '',
  is_deleted: 0,
  is_locked: 0,
  note_count: 0,
  files: [],
}

function createApi() {
  return useAiNoteCommand({
    notes: ref([baseNote]),
    getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
    getFolderTreeByParentId: vi.fn(() => []),
    searchNotes: vi.fn(async () => [baseNote]),
    createNote: vi.fn(),
    updateNote: vi.fn(),
    moveNote: vi.fn(async () => ({
      moved: true,
      note: {
        ...baseNote,
        parent_id: 'folder-1',
      },
    })),
    deleteNote: vi.fn(async (note: Note) => ({
      ok: true,
      note: {
        ...note,
        is_deleted: 1,
      },
    })),
    enableLockForNote: vi.fn(async () => ({
      ok: false,
      code: 'pin_required',
      message: '请先创建全局 PIN',
    })),
    disableLockForNote: vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: {
        ...baseNote,
        is_locked: 0,
      },
    })),
    sync: vi.fn(async () => null),
  })
}

describe('useAiNoteCommand', () => {
  it('returns a confirmation preview before deleting a note', async () => {
    const api = createApi()

    const result = await api.executeToolCall({
      tool: 'delete_note',
      payload: {
        noteId: 'note-1',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      code: 'confirmation_required',
      requiresConfirmation: true,
      preview: expect.objectContaining({
        affectedNoteIds: ['note-1'],
      }),
    })
  })

  it('marks lock setup as requiring human action when a global pin is missing', async () => {
    const api = createApi()

    const result = await api.executeToolCall({
      tool: 'set_note_lock',
      confirmed: true,
      payload: {
        noteId: 'note-1',
        action: 'enable',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'pin_required',
      humanActionRequired: true,
      affectedNoteIds: ['note-1'],
    })
  })

  it('marks get note detail responses as coming from local store', async () => {
    const api = createApi()

    const result = await api.executeToolCall({
      tool: 'get_note_detail',
      payload: {
        noteId: 'note-1',
      },
    })

    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      data: {
        note: expect.objectContaining({
          id: 'note-1',
        }),
        source: 'store',
      },
      affectedNoteIds: ['note-1'],
    })
  })

  it('uses the shared note search path for search_notes', async () => {
    const searchNotes = vi.fn(async () => [baseNote])
    const api = useAiNoteCommand({
      notes: ref([baseNote]),
      getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
      getFolderTreeByParentId: vi.fn(() => []),
      searchNotes,
      createNote: vi.fn(),
      updateNote: vi.fn(),
      moveNote: vi.fn(),
      deleteNote: vi.fn(),
      enableLockForNote: vi.fn(),
      disableLockForNote: vi.fn(),
      sync: vi.fn(async () => null),
    })

    const result = await api.executeToolCall({
      tool: 'search_notes',
      payload: {
        query: '健康 皮炎',
        folderId: 'folder-health',
        limit: 5,
      },
    })

    expect(searchNotes).toHaveBeenCalledWith('健康 皮炎', {
      folderId: 'folder-health',
      limit: 5,
    })
    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      data: [expect.objectContaining({
        id: 'note-1',
        title: '周报',
      })],
    })
  })

  it('reuses the shared note save path for update_note and syncs immediately', async () => {
    const sync = vi.fn(async () => null)
    const updateNote = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: {
        ...baseNote,
        content: '<p>改写后的内容</p>',
        updated: '2026-03-20 10:00:00',
        version: 2,
      },
    }))

    const api = useAiNoteCommand({
      notes: ref([baseNote]),
      getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
      getFolderTreeByParentId: vi.fn(() => []),
      searchNotes: vi.fn(async () => [baseNote]),
      createNote: vi.fn(),
      updateNote,
      moveNote: vi.fn(),
      deleteNote: vi.fn(),
      enableLockForNote: vi.fn(),
      disableLockForNote: vi.fn(),
      sync,
    })

    const result = await api.executeToolCall({
      tool: 'update_note',
      payload: {
        noteId: 'note-1',
        contentHtml: '<p>改写后的内容</p>',
      },
    })

    expect(updateNote).toHaveBeenCalledTimes(1)
    expect(sync).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      syncQueued: true,
      affectedNoteIds: ['note-1'],
      data: {
        note: expect.objectContaining({
          id: 'note-1',
          content: '<p>改写后的内容</p>',
        }),
      },
    })
  })

  it('accepts payload.content as an alias of contentHtml for rewrite writeback', async () => {
    const sync = vi.fn(async () => null)
    const updateNote = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: {
        ...baseNote,
        content: '<p>兼容 content 字段后的正文</p>',
        updated: '2026-03-20 10:00:00',
        version: 2,
      },
    }))

    const api = useAiNoteCommand({
      notes: ref([baseNote]),
      getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
      getFolderTreeByParentId: vi.fn(() => []),
      searchNotes: vi.fn(async () => [baseNote]),
      createNote: vi.fn(),
      updateNote,
      moveNote: vi.fn(),
      deleteNote: vi.fn(),
      enableLockForNote: vi.fn(),
      disableLockForNote: vi.fn(),
      sync,
    })

    const result = await api.executeToolCall({
      tool: 'update_note',
      payload: {
        noteId: 'note-1',
        content: '<p>兼容 content 字段后的正文</p>',
      },
    })

    expect(updateNote).toHaveBeenCalledTimes(1)
    expect(updateNote).toHaveBeenCalledWith(expect.objectContaining({
      content: '<p>兼容 content 字段后的正文</p>',
      noteId: 'note-1',
    }))
    expect(sync).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
      syncQueued: true,
      data: {
        note: expect.objectContaining({
          content: '<p>兼容 content 字段后的正文</p>',
        }),
      },
    })
  })

  it('rejects folder moves through update_note and requires move_note instead', async () => {
    const updateNote = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: baseNote,
    }))
    const sync = vi.fn(async () => null)

    const api = useAiNoteCommand({
      notes: ref([baseNote]),
      getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
      getFolderTreeByParentId: vi.fn(() => []),
      searchNotes: vi.fn(async () => [baseNote]),
      createNote: vi.fn(),
      updateNote,
      moveNote: vi.fn(),
      deleteNote: vi.fn(),
      enableLockForNote: vi.fn(),
      disableLockForNote: vi.fn(),
      sync,
    })

    const result = await api.executeToolCall({
      tool: 'update_note',
      payload: {
        noteId: 'note-1',
        parentId: 'folder-1',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'use_move_note',
      message: '变更备忘录所在目录请改用 move_note',
      affectedNoteIds: ['note-1'],
      syncQueued: false,
    })
    expect(updateNote).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })

  it('rejects update_note when it does not carry effective new content', async () => {
    const updateNote = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      note: baseNote,
    }))
    const sync = vi.fn(async () => null)

    const api = useAiNoteCommand({
      notes: ref([baseNote]),
      getNote: vi.fn(async (id: string) => id === baseNote.id ? baseNote : null),
      getFolderTreeByParentId: vi.fn(() => []),
      searchNotes: vi.fn(async () => [baseNote]),
      createNote: vi.fn(),
      updateNote,
      moveNote: vi.fn(),
      deleteNote: vi.fn(),
      enableLockForNote: vi.fn(),
      disableLockForNote: vi.fn(),
      sync,
    })

    const result = await api.executeToolCall({
      tool: 'update_note',
      payload: {
        noteId: 'note-1',
      },
    })

    expect(result).toMatchObject({
      ok: false,
      code: 'no_effective_changes',
      message: '本次 update_note 没有携带新的标题、摘要或正文内容',
      affectedNoteIds: ['note-1'],
      syncQueued: false,
    })
    expect(updateNote).not.toHaveBeenCalled()
    expect(sync).not.toHaveBeenCalled()
  })
})
