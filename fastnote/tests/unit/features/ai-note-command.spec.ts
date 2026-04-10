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
    searchNotesInDatabase: vi.fn(async () => [baseNote]),
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
})
