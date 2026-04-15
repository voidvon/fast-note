import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildNoteSyncOperations } from '@/entities/note'
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

  it('uses create mode for first-time upload operations', () => {
    const localNote = createLocalNote('note-upload', '2026-03-09 10:00:00.000Z')

    const operations = buildNoteSyncOperations({
      localNotes: [localNote],
      cloudNotes: [],
    })

    expect(operations).toEqual([
      {
        note: localNote,
        action: 'upload',
      },
    ])
  })

  it('uses update mode for synced notes even when cloud incremental list is empty', () => {
    const localNote = createLocalNote('note-update', '2026-03-09 10:00:00.000Z')
    localNote.user_id = 'user-a'

    const operations = buildNoteSyncOperations({
      localNotes: [localNote],
      cloudNotes: [],
    })

    expect(operations).toEqual([
      {
        note: localNote,
        action: 'update',
      },
    ])
  })

  it('backfills user_id after first successful upload', async () => {
    const localNote = createLocalNote('note-backfill', '2026-03-09 10:00:00.000Z')
    const storeUpdateMock = vi.fn(async () => undefined)
    const remoteUpdateMock = vi.fn(async () => ({
      success: true,
      record: {
        id: localNote.id,
        user_id: 'user-a',
        updated: '2026-03-09 10:00:01.000Z',
        files: [],
      },
    }))

    vi.doMock('@/entities/note/model/state/note-store', () => ({
      useNote: () => ({
        updateNote: storeUpdateMock,
      }),
    }))
    vi.doMock('@/entities/note/model/note-remote-service', () => ({
      noteRemoteService: {
        updateNote: remoteUpdateMock,
      },
    }))
    vi.doMock('@/entities/note/model/use-note-files', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => null),
      }),
    }))

    const { useNoteSyncService } = await import('@/entities/note/model/note-sync-service')
    const { syncNoteToRemote } = useNoteSyncService()

    await syncNoteToRemote(localNote, 'create')

    expect(remoteUpdateMock).toHaveBeenCalledWith(localNote, undefined, 'create')
    expect(storeUpdateMock).toHaveBeenCalledWith(localNote.id, expect.objectContaining({
      user_id: 'user-a',
      updated: '2026-03-09 10:00:01.000Z',
    }))
  })

  it('does not create cloud tombstones for deleted unsynced notes', () => {
    const localNote = {
      ...createLocalNote('note-deleted-local', '2026-03-09 10:00:00.000Z'),
      is_deleted: 1,
    }

    const operations = buildNoteSyncOperations({
      localNotes: [localNote],
      cloudNotes: [],
    })

    expect(operations).toEqual([
      {
        note: localNote,
        action: 'skip',
      },
    ])
    expect(operations.some(operation => operation.action === 'delete')).toBe(false)
  })
})
