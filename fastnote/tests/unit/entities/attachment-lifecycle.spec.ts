import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('attachment lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('downloads a remote attachment, stores its hash blob and marks the ref ready', async () => {
    const hash = 'b'.repeat(64)
    const putFile = vi.fn(async () => undefined)
    const putRef = vi.fn(async () => undefined)
    const storedRefs = new Map<string, any>()

    vi.doMock('@/shared/lib/date', () => ({ getTime: () => '2026-07-30 12:00:00.000Z' }))
    vi.doMock('@/shared/lib/file-hash', () => ({ getFileHash: vi.fn(async () => hash) }))
    vi.doMock('@/shared/api/pocketbase/files', () => ({
      filesApi: {
        downloadNoteFile: vi.fn(async () => new File(['attachment'], 'remote.pdf', { type: 'application/pdf' })),
      },
    }))
    vi.doMock('@/shared/lib/storage/attachment-files', () => ({
      deleteStoredNoteFileRefs: vi.fn(),
      getStoredNoteFileRef: vi.fn(async (_database, noteId, filename) => storedRefs.get(`${noteId}:${filename}`)),
      listStoredNoteFileRefs: vi.fn(async () => []),
      putStoredNoteFileRef: vi.fn(async (_database, ref) => {
        storedRefs.set(`${ref.noteId}:${ref.remoteFilename}`, ref)
        await putRef(ref)
      }),
    }))
    vi.doMock('@/shared/lib/storage/dexie', () => ({
      useDexie: () => ({ db: { value: {} } }),
    }))
    vi.doMock('@/shared/lib/storage/note-files', () => ({
      deleteStoredNoteFile: vi.fn(),
      getStoredNoteFile: vi.fn(async () => undefined),
      listStoredNoteFiles: vi.fn(async () => []),
      putStoredNoteFile: putFile,
    }))

    const { hydrateRemoteAttachment } = await import('@/entities/attachment/model/attachment-lifecycle-service')
    const result = await hydrateRemoteAttachment('note-1', 'remote.pdf')

    expect(putFile).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      hash,
      fileName: 'remote.pdf',
      downloadedAt: '2026-07-30 12:00:00.000Z',
    }))
    expect(result).toMatchObject({
      noteId: 'note-1',
      remoteFilename: 'remote.pdf',
      hash,
      status: 'ready',
    })
    expect(putRef).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ready', hash }))
  })

  it('reconciles remote attachment refs without downloading their blobs', async () => {
    const downloadNoteFile = vi.fn()
    const putRef = vi.fn(async () => undefined)

    vi.doMock('@/shared/lib/date', () => ({ getTime: () => '2026-07-30 12:00:00.000Z' }))
    vi.doMock('@/shared/lib/file-hash', () => ({ getFileHash: vi.fn() }))
    vi.doMock('@/shared/api/pocketbase/files', () => ({
      filesApi: { downloadNoteFile },
    }))
    vi.doMock('@/shared/lib/storage/attachment-files', () => ({
      deleteStoredNoteFileRefs: vi.fn(),
      getStoredNoteFileRef: vi.fn(async () => undefined),
      listStoredNoteFileRefs: vi.fn(async () => []),
      putStoredNoteFileRef: putRef,
    }))
    vi.doMock('@/shared/lib/storage/dexie', () => ({
      useDexie: () => ({ db: { value: {} } }),
    }))
    vi.doMock('@/shared/lib/storage/note-files', () => ({
      deleteStoredNoteFile: vi.fn(),
      getStoredNoteFile: vi.fn(async () => undefined),
      listStoredNoteFiles: vi.fn(async () => []),
      putStoredNoteFile: vi.fn(),
    }))

    const { reconcileRemoteNoteAttachmentRefs } = await import('@/entities/attachment/model/attachment-lifecycle-service')
    const result = await reconcileRemoteNoteAttachmentRefs({
      id: 'note-1',
      content: '<file-upload url="remote.pdf"></file-upload><file-upload url="photo.png"></file-upload>',
    } as any)

    expect(result).toEqual({ ready: 0, remoteOnly: 2, total: 2 })
    expect(downloadNoteFile).not.toHaveBeenCalled()
    expect(putRef).toHaveBeenCalledTimes(2)
    expect(putRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      remoteFilename: 'remote.pdf',
      fileType: 'application/pdf',
      status: 'remote_only',
    }))
    expect(putRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      remoteFilename: 'photo.png',
      fileType: 'image/png',
      status: 'remote_only',
    }))
  })

  it('garbage collects only blobs outside the global note and ref live set', async () => {
    const noteHash = 'c'.repeat(64)
    const refHash = 'd'.repeat(64)
    const staleHash = 'e'.repeat(64)
    const deleteFile = vi.fn(async () => undefined)

    vi.doMock('@/shared/api/pocketbase/files', () => ({ filesApi: {} }))
    vi.doMock('@/shared/lib/date', () => ({ getTime: () => '2026-07-30 12:00:00.000Z' }))
    vi.doMock('@/shared/lib/file-hash', () => ({ getFileHash: vi.fn() }))
    vi.doMock('@/shared/lib/storage/attachment-files', () => ({
      deleteStoredNoteFileRefs: vi.fn(),
      getStoredNoteFileRef: vi.fn(),
      listStoredNoteFileRefs: vi.fn(async () => [{ hash: refHash, status: 'ready' }]),
      putStoredNoteFileRef: vi.fn(),
    }))
    vi.doMock('@/shared/lib/storage/dexie', () => ({
      useDexie: () => ({ db: { value: {} } }),
    }))
    vi.doMock('@/shared/lib/storage/note-files', () => ({
      deleteStoredNoteFile: deleteFile,
      getStoredNoteFile: vi.fn(),
      listStoredNoteFiles: vi.fn(async () => [
        { hash: noteHash },
        { hash: refHash },
        { hash: staleHash },
      ]),
      putStoredNoteFile: vi.fn(),
    }))

    const { garbageCollectAttachments } = await import('@/entities/attachment/model/attachment-lifecycle-service')
    const deleted = await garbageCollectAttachments([{
      id: 'note-1',
      content: `<file-upload url="${noteHash}"></file-upload>`,
    } as any])

    expect(deleted).toBe(1)
    expect(deleteFile).toHaveBeenCalledOnce()
    expect(deleteFile).toHaveBeenCalledWith(expect.anything(), staleHash)
  })
})
