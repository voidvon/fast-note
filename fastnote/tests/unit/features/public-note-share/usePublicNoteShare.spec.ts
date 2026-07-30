import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeNote } from '../../../factories/note.factory'

describe('usePublicNoteAccess', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('builds public URLs for notes and folders', async () => {
    const { buildPublicNoteUrl } = await import('@/features/public-note-share')

    expect(buildPublicNoteUrl(
      makeNote({ id: 'note-1', item_type: 2 }),
      '用户 name',
      'https://fastnote.test/',
    )).toBe('https://fastnote.test/%E7%94%A8%E6%88%B7%20name/n/note-1')
    expect(buildPublicNoteUrl(
      makeNote({ id: 'folder-1', item_type: 1 }),
      'virjay',
      'https://fastnote.test',
    )).toBe('https://fastnote.test/virjay/f/folder-1')
  })

  it('makes the note and all parents public', async () => {
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

    const { usePublicNoteAccess } = await import('@/features/public-note-share')
    const { togglePublic } = usePublicNoteAccess()
    const result = await togglePublic(notes[1])

    expect(result).toMatchObject({
      color: 'success',
      message: '已设为公开',
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

  it('makes a parent private only when no public descendants remain', async () => {
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

    const { usePublicNoteAccess } = await import('@/features/public-note-share')
    const { togglePublic } = usePublicNoteAccess()

    const firstResult = await togglePublic(notes[1])

    expect(firstResult).toMatchObject({
      message: '已设为私密',
      ok: true,
    })
    expect(notes[1].is_public).toBe(false)
    expect(notes[0].is_public).toBe(false)

    notes[1].is_public = 1
    notes[2].is_public = 1
    notes[0].is_public = 1

    const secondResult = await togglePublic(notes[1])

    expect(secondResult).toMatchObject({
      message: '已设为私密',
      ok: true,
    })
    expect(notes[1].is_public).toBe(false)
    expect(notes[2].is_public).toBe(1)
    expect(notes[0].is_public).toBe(1)
  })
})
