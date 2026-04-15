import { describe, expect, it, vi } from 'vitest'

describe('useNoteMove', () => {
  it('blocks moving a folder into its descendant branch', async () => {
    vi.resetModules()

    const notes = [
      {
        id: 'folder-a',
        title: 'A',
        content: '',
        created: '2026-03-20 09:00:00',
        updated: '2026-03-20 09:00:00',
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 1,
      },
      {
        id: 'folder-b',
        title: 'B',
        content: '',
        created: '2026-03-20 09:01:00',
        updated: '2026-03-20 09:01:00',
        item_type: 1,
        parent_id: 'folder-a',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
      },
    ]

    const getNote = vi.fn((id: string) => notes.find(note => note.id === id))
    const updateNote = vi.fn()

    vi.doMock('@/entities/note', () => ({
      NOTE_TYPE: {
        FOLDER: 1,
        NOTE: 2,
      },
      createsCircularFolderMove: (items: typeof notes, noteId: string, targetFolderId: string) => {
        if (targetFolderId !== 'folder-b') {
          return false
        }

        return items.some(note => note.id === noteId && note.id === 'folder-a')
      },
      useNote: () => ({
        getFolderTreeByParentId: () => [],
        getNote,
        getNoteCountByParentId: vi.fn(async () => 0),
        notes: {
          value: notes,
        },
        updateNote,
      }),
    }))

    const { useNoteMove } = await import('@/features/note-move/model/use-note-move')
    const api = useNoteMove()
    const result = await api.moveNote('folder-a', 'folder-b')

    expect(result).toMatchObject({
      moved: false,
      code: 'circular_move_forbidden',
    })
    expect(updateNote).not.toHaveBeenCalled()
  })
})
