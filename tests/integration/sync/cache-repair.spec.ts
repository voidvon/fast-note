import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'

function createCloudNote(id: string) {
  return {
    id,
    title: '云端备忘录',
    summary: '来自云端',
    content: '<p>云端内容</p>',
    created: '2026-03-08 10:00:00.000Z',
    updated: '2026-03-09 09:30:00.000Z',
    item_type: NOTE_TYPE.NOTE,
    parent_id: '',
    is_deleted: 0,
    is_locked: 0,
    note_count: 0,
    version: 1,
    files: [],
  }
}

describe('cache repair sync (t-fn-032 / tc-fn-025)', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('resets current user cursor and backfills when local cache is empty but cursor is stale', async () => {
    const cloudNote = createCloudNote('cloud-note-1')
    const addNoteMock = vi.fn(async () => undefined)
    const updateNoteMock = vi.fn(async () => undefined)
    const deleteNoteMock = vi.fn(async () => undefined)
    const getNoteMock = vi.fn(async () => null)
    const getNotesByUpdatedMock = vi.fn(async () => [])
    const getNotesByUpdatedFromCloudMock = vi.fn(async () => ({ d: [cloudNote] }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: getNotesByUpdatedMock,
        getNote: getNoteMock,
        addNote: addNoteMock,
        deleteNote: deleteNoteMock,
        updateNote: updateNoteMock,
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
        getNotesByUpdated: getNotesByUpdatedFromCloudMock,
        updateNote: vi.fn(async () => ({ success: true })),
      },
    }))

    const {
      getInitialSyncCursor,
      readSyncCursor,
      useSync,
      writeSyncCursor,
    } = await import('@/processes/sync-notes')

    writeSyncCursor('2026-03-09 08:00:00.000Z', 'user-a')

    const { sync } = useSync()
    const result = await sync(true)

    expect(getNotesByUpdatedMock).toHaveBeenNthCalledWith(1, '1970-01-01T00:00:00.000Z')
    expect(getNotesByUpdatedMock).toHaveBeenNthCalledWith(2, getInitialSyncCursor())
    expect(getNotesByUpdatedFromCloudMock).toHaveBeenCalledWith(getInitialSyncCursor())
    expect(addNoteMock).toHaveBeenCalledWith(cloudNote)
    expect(updateNoteMock).not.toHaveBeenCalled()
    expect(deleteNoteMock).not.toHaveBeenCalled()
    expect(getNoteMock).toHaveBeenCalledWith('cloud-note-1')
    expect(readSyncCursor('user-a')).toBe('2026-03-09 09:30:00.000Z')
    expect(result).toEqual({
      uploaded: 0,
      downloaded: 1,
      deleted: 0,
    })
  })

  it('repairs missing private note with stale cursor by forcing a backfill sync', async () => {
    const cloudNote = createCloudNote('missing-note')
    const addNoteMock = vi.fn(async () => undefined)
    const getNotesByUpdatedMock = vi.fn(async () => [])
    const getNotesByUpdatedFromCloudMock = vi.fn(async () => ({ d: [cloudNote] }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        getNotesByUpdated: getNotesByUpdatedMock,
        getNote: vi.fn(async () => null),
        addNote: addNoteMock,
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
        getNotesByUpdated: getNotesByUpdatedFromCloudMock,
        updateNote: vi.fn(async () => ({ success: true })),
      },
    }))

    const {
      getInitialSyncCursor,
      readSyncCursor,
      useSync,
      writeSyncCursor,
    } = await import('@/processes/sync-notes')

    writeSyncCursor('2026-03-09 08:00:00.000Z', 'user-a')

    const { repairMissingPrivateNoteIfNeeded } = useSync()
    const repaired = await repairMissingPrivateNoteIfNeeded('missing-note')

    expect(repaired).toBe(true)
    expect(getNotesByUpdatedFromCloudMock).toHaveBeenCalledWith(getInitialSyncCursor())
    expect(addNoteMock).toHaveBeenCalledWith(cloudNote)
    expect(readSyncCursor('user-a')).toBe('2026-03-09 09:30:00.000Z')
  })
})
