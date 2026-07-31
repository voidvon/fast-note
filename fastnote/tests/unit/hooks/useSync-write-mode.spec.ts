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

    expect(remoteUpdateMock).toHaveBeenCalledWith(localNote, [], 'create')
    expect(storeUpdateMock).toHaveBeenCalledWith(localNote.id, expect.objectContaining({
      user_id: 'user-a',
      updated: '2026-03-09 10:00:01.000Z',
    }))
  })

  it('stops remote sync when content references a missing local attachment blob', async () => {
    const hash = 'a'.repeat(64)
    const localNote = {
      ...createLocalNote('note-missing-file', '2026-03-09 10:00:00.000Z'),
      content: `<img data-note-attachment="image" data-file-type="image/png" src="${hash}">`,
    }
    const remoteUpdateMock = vi.fn()

    vi.doMock('@/entities/note/model/state/note-store', () => ({
      useNote: () => ({ updateNote: vi.fn() }),
    }))
    vi.doMock('@/entities/note/model/note-remote-service', () => ({
      noteRemoteService: { updateNote: remoteUpdateMock },
    }))
    vi.doMock('@/entities/note/model/use-note-files', () => ({
      useNoteFiles: () => ({ getNoteFileByHash: vi.fn(async () => null) }),
    }))

    const { useNoteSyncService } = await import('@/entities/note/model/note-sync-service')
    await expect(useNoteSyncService()
      .syncNoteToRemote(localNote, 'update'))
      .rejects
      .toThrow('本地附件不存在')
    expect(remoteUpdateMock).not.toHaveBeenCalled()
  })

  it('replaces an uploaded hash with a canonical PocketBase file URL', async () => {
    const hash = 'b'.repeat(64)
    const file = new File(['image'], 'photo.png', { type: 'image/png' })
    const localNote = {
      ...createLocalNote('note-with-file', '2026-03-09 10:00:00.000Z'),
      content: `<img data-note-attachment="image" data-file-type="image/png" data-file-name="photo.png" src="${hash}">`,
    }
    const storeUpdateMock = vi.fn(async () => undefined)
    const commitUploadedNoteAttachments = vi.fn(async () => undefined)
    const remoteFilename = 'photo_random.png'
    const remoteStageMock = vi.fn(async () => ({
      success: true,
      fileMapping: new Map([[file, remoteFilename]]),
      record: { files: [remoteFilename], updated: '2026-03-09 10:00:01.000Z', user_id: 'user-a' },
    }))
    const remoteUpdateMock = vi.fn(async () => ({
      success: true,
      record: { files: [remoteFilename], updated: '2026-03-09 10:00:02.000Z', user_id: 'user-a' },
    }))

    vi.doMock('@/entities/note/model/state/note-store', () => ({
      useNote: () => ({ updateNote: storeUpdateMock }),
    }))
    vi.doMock('@/entities/note/model/note-remote-service', () => ({
      noteRemoteService: { stageNoteFiles: remoteStageMock, updateNote: remoteUpdateMock },
    }))
    vi.doMock('@/entities/note/model/use-note-files', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => ({
          hash,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          created: localNote.created,
          updated: localNote.updated,
        })),
      }),
    }))
    vi.doMock('@/entities/attachment', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/entities/attachment')>()
      return { ...actual, commitUploadedNoteAttachments }
    })

    const { useNoteSyncService } = await import('@/entities/note/model/note-sync-service')
    await useNoteSyncService().syncNoteToRemote(localNote, 'update')

    expect(remoteStageMock).toHaveBeenCalledWith(localNote, [file], 'update')

    const finalNote = storeUpdateMock.mock.calls.find(call => call[1]?.content)?.[1]
    expect(finalNote.content).toContain(`src="/api/files/notes/${localNote.id}/${remoteFilename}"`)
    expect(finalNote.content).not.toContain(hash)
    expect(finalNote.content).not.toContain('__TEMP_FILE_')
    expect(commitUploadedNoteAttachments).toHaveBeenCalledWith(finalNote, [{
      file: expect.objectContaining({ file, hash }),
      remoteFilename,
    }])
    expect(remoteUpdateMock).toHaveBeenCalledOnce()
    expect(remoteUpdateMock).toHaveBeenCalledWith(finalNote, [remoteFilename], 'update')
  })

  it('keeps previously synced files during staging and removes stale files in the final write', async () => {
    const hash = 'c'.repeat(64)
    const file = new File(['new'], 'new.png', { type: 'image/png' })
    const localNote = {
      ...createLocalNote('note-replace-file', '2026-03-09 10:00:00.000Z'),
      content: `<img data-note-attachment="image" data-file-type="image/png" src="${hash}">`,
      files: ['old_remote.png'],
      user_id: 'user-a',
    }
    const remoteFilename = 'new_random.png'
    const remoteStageMock = vi.fn(async () => ({
      success: true,
      fileMapping: new Map([[file, remoteFilename]]),
      record: { files: ['old_remote.png', remoteFilename], user_id: 'user-a' },
    }))
    const remoteUpdateMock = vi.fn(async (note: any) => ({ success: true, record: note }))

    vi.doMock('@/entities/note/model/state/note-store', () => ({
      useNote: () => ({ updateNote: vi.fn() }),
    }))
    vi.doMock('@/entities/note/model/note-remote-service', () => ({
      noteRemoteService: { stageNoteFiles: remoteStageMock, updateNote: remoteUpdateMock },
    }))
    vi.doMock('@/entities/note/model/use-note-files', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => ({
          hash,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          created: localNote.created,
          updated: localNote.updated,
        })),
      }),
    }))
    vi.doMock('@/entities/attachment', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/entities/attachment')>()
      return { ...actual, commitUploadedNoteAttachments: vi.fn(async () => undefined) }
    })

    const { useNoteSyncService } = await import('@/entities/note/model/note-sync-service')
    await useNoteSyncService().syncNoteToRemote(localNote, 'update')

    expect(remoteStageMock).toHaveBeenCalledWith(localNote, ['old_remote.png', file], 'update')
    expect(remoteUpdateMock.mock.calls[0][1]).toEqual([remoteFilename])
    expect(remoteUpdateMock.mock.calls[0][0].content).toContain(`/api/files/notes/${localNote.id}/${remoteFilename}`)
  })

  it('keeps the final local state recoverable when the final remote write fails', async () => {
    const hash = 'd'.repeat(64)
    const file = new File(['recover'], 'recover.png', { type: 'image/png' })
    const remoteFilename = 'recover_random.png'
    const localNote = {
      ...createLocalNote('note-recover-upload', '2026-03-09 10:00:00.000Z'),
      content: `<img data-note-attachment="image" data-file-type="image/png" src="${hash}">`,
    }
    const storeUpdateMock = vi.fn()
    const commitMock = vi.fn(async () => undefined)
    const remoteUpdateMock = vi.fn(async () => {
      throw new Error('final write failed')
    })

    vi.doMock('@/entities/note/model/state/note-store', () => ({
      useNote: () => ({ updateNote: storeUpdateMock }),
    }))
    vi.doMock('@/entities/note/model/note-remote-service', () => ({
      noteRemoteService: {
        stageNoteFiles: vi.fn(async () => ({
          success: true,
          fileMapping: new Map([[file, remoteFilename]]),
          record: { files: [remoteFilename], user_id: 'user-a' },
        })),
        updateNote: remoteUpdateMock,
      },
    }))
    vi.doMock('@/entities/note/model/use-note-files', () => ({
      useNoteFiles: () => ({
        getNoteFileByHash: vi.fn(async () => ({
          hash,
          file,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          created: localNote.created,
          updated: localNote.updated,
        })),
      }),
    }))
    vi.doMock('@/entities/attachment', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/entities/attachment')>()
      return { ...actual, commitUploadedNoteAttachments: commitMock }
    })

    const { useNoteSyncService } = await import('@/entities/note/model/note-sync-service')
    await expect(useNoteSyncService().syncNoteToRemote(localNote, 'update')).rejects.toThrow('final write failed')

    const committedNote = commitMock.mock.calls[0][0]
    expect(committedNote.content).toContain(`/api/files/notes/${localNote.id}/${remoteFilename}`)
    expect(committedNote.files).toEqual([remoteFilename])
    expect(storeUpdateMock).toHaveBeenCalledWith(localNote.id, committedNote)
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
        action: 'purge',
      },
    ])
    expect(operations.some(operation => operation.action === 'delete')).toBe(false)
  })
})
