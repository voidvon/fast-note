import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_TYPE } from '@/types'

function createLocalNote(id: string, updated: string) {
  return {
    id,
    title: '本地备忘录',
    summary: '摘要',
    content: '<p>内容</p>',
    created: '2026-03-09 09:00:00.000Z',
    updated,
    item_type: NOTE_TYPE.NOTE,
    parent_id: '',
    is_deleted: 0,
    is_locked: 0,
    note_count: 0,
    version: 1,
    files: [],
  }
}

describe('useSync write mode routing', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('uses create mode for upload operations', async () => {
    const localNote = createLocalNote('note-upload', '2026-03-09 10:00:00.000Z')
    const syncWriteMock = vi.fn(async () => ({ success: true, record: null }))

    vi.doMock('@/stores', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: vi.fn(async () => undefined),
      }),
    }))

    vi.doMock('@/hooks/useNoteFiles', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/hooks/useSync')
    const { sync } = useSync()
    await sync(true)

    expect(syncWriteMock).toHaveBeenCalledWith(localNote, undefined, 'create')
  })

  it('uses update mode for update operations', async () => {
    const localNote = createLocalNote('note-update', '2026-03-09 10:00:00.000Z')
    const cloudNote = createLocalNote('note-update', '2026-03-09 09:00:00.000Z')
    const syncWriteMock = vi.fn(async () => ({ success: true, record: null }))

    vi.doMock('@/stores', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: vi.fn(async () => undefined),
      }),
    }))

    vi.doMock('@/hooks/useNoteFiles', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [cloudNote] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/hooks/useSync')
    const { sync } = useSync()
    await sync(true)

    expect(syncWriteMock).toHaveBeenCalledWith(localNote, undefined, 'update')
  })
})
