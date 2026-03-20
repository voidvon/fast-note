import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeNote } from '../../../factories/note.factory'

describe('usePublicNoteShare', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('enables share for the note and all parents', async () => {
    const notes = [
      makeNote({
        id: 'folder-1',
        item_type: 1,
        is_public: 0,
      }),
      makeNote({
        id: 'note-1',
        parent_id: 'folder-1',
        is_public: 0,
      }),
    ]
    const updateNote = vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const target = notes.find(note => note.id === id)
      Object.assign(target!, updates)
    })

    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: vi.fn((id: string) => notes.find(note => note.id === id) || null),
          getNotesByParentId: vi.fn(async (parentId: string) => {
            return notes.filter(note => note.parent_id === parentId && note.is_deleted !== 1)
          }),
          updateNote,
        }),
      }
    })
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-03-17 11:10:00',
    }))

    const { usePublicNoteShare } = await import('@/features/public-note-share')
    const { toggleShare } = usePublicNoteShare()
    const result = await toggleShare(notes[1])

    expect(result).toMatchObject({
      color: 'success',
      message: '已启用分享',
      ok: true,
    })
    expect(notes[1]).toMatchObject({
      is_public: true,
      updated: '2026-03-17 11:10:00',
    })
    expect(notes[0]).toMatchObject({
      is_public: true,
      updated: '2026-03-17 11:10:00',
    })
  })

  it('disables parent share only when no public descendants remain', async () => {
    const notes = [
      makeNote({
        id: 'folder-1',
        item_type: 1,
        is_public: 1,
      }),
      makeNote({
        id: 'note-1',
        parent_id: 'folder-1',
        is_public: 1,
      }),
      makeNote({
        id: 'note-2',
        parent_id: 'folder-1',
        is_public: 0,
      }),
    ]
    const updateNote = vi.fn(async (id: string, updates: Record<string, unknown>) => {
      const target = notes.find(note => note.id === id)
      Object.assign(target!, updates)
    })

    vi.doMock('@/entities/note', async () => {
      const actual = await vi.importActual<typeof import('@/entities/note')>('@/entities/note')
      return {
        ...actual,
        useNote: () => ({
          getNote: vi.fn((id: string) => notes.find(note => note.id === id) || null),
          getNotesByParentId: vi.fn(async (parentId: string) => {
            return notes.filter(note => note.parent_id === parentId && note.is_deleted !== 1)
          }),
          updateNote,
        }),
      }
    })
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-03-17 11:11:00',
    }))

    const { usePublicNoteShare } = await import('@/features/public-note-share')
    const { toggleShare } = usePublicNoteShare()

    const firstResult = await toggleShare(notes[1])

    expect(firstResult).toMatchObject({
      message: '已取消分享',
      ok: true,
    })
    expect(notes[1].is_public).toBe(false)
    expect(notes[0].is_public).toBe(false)

    notes[1].is_public = 1
    notes[2].is_public = 1
    notes[0].is_public = 1

    const secondResult = await toggleShare(notes[1])

    expect(secondResult).toMatchObject({
      message: '已取消分享',
      ok: true,
    })
    expect(notes[1].is_public).toBe(false)
    expect(notes[2].is_public).toBe(1)
    expect(notes[0].is_public).toBe(1)
  })
})
