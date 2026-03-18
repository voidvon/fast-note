import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'

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

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: vi.fn(async () => undefined),
      }),
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/shared/api/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/processes/sync-notes')
    const { sync } = useSync()
    await sync(true)

    expect(syncWriteMock).toHaveBeenCalledWith(localNote, undefined, 'create')
  })

  it('uses update mode for synced notes even when cloud incremental list is empty', async () => {
    const localNote = createLocalNote('note-update', '2026-03-09 10:00:00.000Z')
    localNote.user_id = 'user-a'
    const syncWriteMock = vi.fn(async () => ({ success: true, record: null }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: vi.fn(async () => undefined),
      }),
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/shared/api/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/processes/sync-notes')
    const { sync } = useSync()
    await sync(true)

    expect(syncWriteMock).toHaveBeenCalledWith(localNote, undefined, 'update')
  })

  it('backfills user_id after first successful upload', async () => {
    const localNote = createLocalNote('note-backfill', '2026-03-09 10:00:00.000Z')
    const storeUpdateMock = vi.fn(async () => undefined)
    const syncWriteMock = vi.fn(async () => ({
      success: true,
      record: {
        id: localNote.id,
        user_id: 'user-a',
        updated: '2026-03-09 10:00:01.000Z',
      },
    }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: storeUpdateMock,
      }),
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/shared/api/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/processes/sync-notes')
    const { sync } = useSync()
    await sync(true)

    expect(storeUpdateMock).toHaveBeenCalledWith(localNote.id, {
      user_id: 'user-a',
      updated: '2026-03-09 10:00:01.000Z',
    })
  })

  it('does not create cloud tombstones for deleted unsynced notes', async () => {
    const localNote = {
      ...createLocalNote('note-deleted-local', '2026-03-09 10:00:00.000Z'),
      is_deleted: 1,
    }
    const syncWriteMock = vi.fn(async () => ({ success: true, record: null }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: vi.fn(async () => [localNote]),
        getNote: vi.fn(async () => localNote),
        addNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateNote: vi.fn(async () => undefined),
      }),
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    vi.doMock('@/shared/api/pocketbase', () => ({
      authService: {
        isAuthenticated: () => true,
        getCurrentAuthUser: () => ({ id: 'user-a' }),
      },
      notesService: {
        getNotesByUpdated: vi.fn(async () => ({ d: [] })),
        updateNote: syncWriteMock,
      },
    }))

    const { useSync } = await import('@/processes/sync-notes')
    const { sync } = useSync()
    await sync(true)

    expect(syncWriteMock).not.toHaveBeenCalled()
  })
})
