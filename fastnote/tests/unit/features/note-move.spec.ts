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

    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
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
          getNotesByParentId: vi.fn(async (parentId: string) => notes.filter(note => note.parent_id === parentId)),
          notes: {
            value: notes,
          },
          updateNote,
        }),
      }
    })

    const { useNoteMove } = await import('@/features/note-move/model/use-note-move')
    const api = useNoteMove()
    const result = await api.moveNote('folder-a', 'folder-b')

    expect(result).toMatchObject({
      moved: false,
      code: 'circular_move_forbidden',
    })
    expect(updateNote).not.toHaveBeenCalled()
  })

  it('makes the new parent branch public when moving a public note', async () => {
    vi.resetModules()

    const notes = [
      {
        id: 'folder-old-root',
        title: 'Old root folder',
        content: '',
        created: '2026-03-20 08:58:00',
        updated: '2026-03-20 08:58:00',
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        is_public: true,
        note_count: 1,
      },
      {
        id: 'folder-old-child',
        title: 'Old child folder',
        content: '',
        created: '2026-03-20 08:59:00',
        updated: '2026-03-20 08:59:00',
        item_type: 1,
        parent_id: 'folder-old-root',
        is_deleted: 0,
        is_locked: 0,
        is_public: true,
        note_count: 1,
      },
      {
        id: 'folder-root',
        title: 'Root folder',
        content: '',
        created: '2026-03-20 09:00:00',
        updated: '2026-03-20 09:00:00',
        item_type: 1,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        is_public: false,
        note_count: 0,
      },
      {
        id: 'folder-child',
        title: 'Child folder',
        content: '',
        created: '2026-03-20 09:01:00',
        updated: '2026-03-20 09:01:00',
        item_type: 1,
        parent_id: 'folder-root',
        is_deleted: 0,
        is_locked: 0,
        is_public: false,
        note_count: 0,
      },
      {
        id: 'note-public',
        title: 'Public note',
        content: '',
        created: '2026-03-20 09:02:00',
        updated: '2026-03-20 09:02:00',
        item_type: 2,
        parent_id: 'folder-old-child',
        is_deleted: 0,
        is_locked: 0,
        is_public: true,
        note_count: 0,
      },
    ]
    const getNote = vi.fn((id: string) => notes.find(note => note.id === id))
    const updateNote = vi.fn(async (id: string, updates: Record<string, unknown>) => {
      Object.assign(getNote(id)!, updates)
    })

    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getFolderTreeByParentId: () => [],
          getNote,
          getNoteCountByParentId: vi.fn(async () => 0),
          getNotesByParentId: vi.fn(async (parentId: string) => {
            return notes.filter(note => note.parent_id === parentId && note.is_deleted !== 1)
          }),
          notes: { value: notes },
          updateNote,
        }),
      }
    })
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-03-20 10:00:00',
    }))

    const { useNoteMove } = await import('@/features/note-move/model/use-note-move')
    const result = await useNoteMove().moveNote('note-public', 'folder-child')

    expect(result).toMatchObject({ code: 'ok', moved: true })
    expect(notes.find(note => note.id === 'note-public')).toMatchObject({
      parent_id: 'folder-child',
      is_public: true,
    })
    expect(notes.find(note => note.id === 'folder-child')).toMatchObject({ is_public: true })
    expect(notes.find(note => note.id === 'folder-root')).toMatchObject({ is_public: true })
    expect(notes.find(note => note.id === 'folder-old-child')).toMatchObject({ is_public: false })
    expect(notes.find(note => note.id === 'folder-old-root')).toMatchObject({ is_public: false })
  })
})
