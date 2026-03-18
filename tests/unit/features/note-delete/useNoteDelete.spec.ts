import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteDelete', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('marks the note as deleted and refreshes parent counts', async () => {
    const updateNote = vi.fn(async () => undefined)
    const updateParentFolderSubcount = vi.fn(async () => undefined)
    const note = makeNote({
      id: 'note-1',
      parent_id: 'folder-1',
      is_deleted: 0,
    })

    vi.doMock('@/entities/note', () => ({
      useNoteRepository: () => ({
        updateNote,
        updateParentFolderSubcount,
      }),
    }))
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-03-17 11:20:00',
    }))

    const { useNoteDelete } = await import('@/features/note-delete')
    const { deleteNote } = useNoteDelete()
    const result = await deleteNote(note)

    expect(updateNote).toHaveBeenCalledWith('note-1', expect.objectContaining({
      id: 'note-1',
      is_deleted: 1,
      updated: '2026-03-17 11:20:00',
    }))
    expect(updateParentFolderSubcount).toHaveBeenCalledWith(note)
    expect(result).toMatchObject({
      ok: true,
      note: expect.objectContaining({
        id: 'note-1',
        is_deleted: 1,
        updated: '2026-03-17 11:20:00',
      }),
    })
  })
})
