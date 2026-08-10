import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { makeNote } from '../../../factories/note.factory'

describe('public notes incremental loading', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('initializes with folder metadata and only the requested detail', async () => {
    const publicNotes = ref<any[]>([])
    const folder = makeNote({ id: 'folder-1', item_type: 1 })
    const detail = makeNote({ id: 'note-1', content: '<p>detail</p>', parent_id: 'folder-1' })
    const getPublicFolders = vi.fn(async () => [folder])
    const getPublicNote = vi.fn(async () => detail)
    const getPublicNotesPage = vi.fn(async () => ({
      items: [],
      page: 1,
      perPage: 1,
      totalItems: 0,
      totalPages: 0,
    }))

    const store = {
      getPublicNote: (id: string) => publicNotes.value.find(note => note.id === id) || null,
      mergePublicNotes: (notes: any[]) => {
        publicNotes.value = [...publicNotes.value.filter(note => !notes.some(item => item.id === note.id)), ...notes]
      },
      publicNotes,
      replacePublicNotes: (notes: any[]) => {
        publicNotes.value = [...notes]
      },
    }

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: {
        getPublicFolders,
        getPublicNote,
        getPublicNotesPage,
      },
      useUserPublicNotes: () => store,
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { ensurePublicNotesReady } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    const result = await ensurePublicNotesReady('alice', { noteId: 'note-1' })

    expect(getPublicFolders).toHaveBeenCalledWith('user-a')
    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'unfilednotes', 1, 1)
    expect(getPublicNote).toHaveBeenCalledWith('user-a', 'note-1')
    expect(result.synced).toBe(2)
    expect(result.unfiledNotesCount).toBe(0)
    expect(publicNotes.value.map(note => note.id)).toEqual(['folder-1', 'note-1'])
  })

  it('loads only one root-note preview and exposes its total for the virtual folder', async () => {
    const publicNotes = ref<any[]>([])
    const rootNote = makeNote({ id: 'root-note', parent_id: '' })
    const getPublicNotesPage = vi.fn(async () => ({
      items: [rootNote],
      page: 1,
      perPage: 1,
      totalItems: 42,
      totalPages: 42,
    }))

    const store = {
      getPublicNote: (id: string) => publicNotes.value.find(note => note.id === id) || null,
      mergePublicNotes: (notes: any[]) => {
        publicNotes.value = [...publicNotes.value.filter(note => !notes.some(item => item.id === note.id)), ...notes]
      },
      publicNotes,
      replacePublicNotes: (notes: any[]) => {
        publicNotes.value = [...notes]
      },
    }

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: {
        getPublicFolders: vi.fn(async () => []),
        getPublicNote: vi.fn(),
        getPublicNotesPage,
      },
      useUserPublicNotes: () => store,
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { ensurePublicNotesReady } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    const result = await ensurePublicNotesReady('root-only-user', { force: true })

    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'unfilednotes', 1, 1)
    expect(result.unfiledNotesCount).toBe(42)
    expect(publicNotes.value.map(note => note.id)).toEqual(['root-note'])
  })

  it('loads the selected all-notes page during initialization', async () => {
    const publicNotes = ref<any[]>([])
    const rootNote = makeNote({ id: 'root-note', parent_id: '' })
    const folderNote = makeNote({ id: 'folder-note', parent_id: 'folder-1' })
    const getPublicNotesPage = vi.fn(async (_userId: string, parentId: string) => ({
      items: parentId === 'allnotes' ? [rootNote, folderNote] : [rootNote],
      page: 1,
      perPage: parentId === 'allnotes' ? 30 : 1,
      totalItems: parentId === 'allnotes' ? 2 : 1,
      totalPages: 1,
    }))
    const store = {
      getPublicNote: (id: string) => publicNotes.value.find(note => note.id === id) || null,
      mergePublicNotes: (notes: any[]) => {
        const merged = new Map(publicNotes.value.map(note => [note.id, note]))
        notes.forEach(note => merged.set(note.id, { ...merged.get(note.id), ...note }))
        publicNotes.value = [...merged.values()]
      },
      publicNotes,
      replacePublicNotes: (notes: any[]) => {
        publicNotes.value = [...notes]
      },
    }

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: {
        getPublicFolders: vi.fn(async () => [makeNote({ id: 'folder-1', item_type: 1 })]),
        getPublicNote: vi.fn(),
        getPublicNotesPage,
      },
      useUserPublicNotes: () => store,
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { ensurePublicNotesReady } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    const result = await ensurePublicNotesReady('alice', { folderId: 'allnotes' })

    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'unfilednotes', 1, 1)
    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'allnotes', 1)
    expect(result.notes.filter(note => note.item_type === 2).map(note => note.id)).toEqual([
      'root-note',
      'folder-note',
    ])
    expect(result.synced).toBe(3)
  })

  it('requests fresh public data on every route entry', async () => {
    const publicNotes = ref<any[]>([])
    const getPublicFolders = vi.fn(async () => [makeNote({ id: 'folder-1', item_type: 1 })])
    const getPublicNotesPage = vi.fn(async () => ({
      items: [],
      page: 1,
      perPage: 1,
      totalItems: 0,
      totalPages: 0,
    }))
    const store = {
      getPublicNote: vi.fn(),
      mergePublicNotes: (notes: any[]) => {
        publicNotes.value = [...publicNotes.value.filter(note => !notes.some(item => item.id === note.id)), ...notes]
      },
      publicNotes,
      replacePublicNotes: (notes: any[]) => {
        publicNotes.value = [...notes]
      },
    }

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: {
        getPublicFolders,
        getPublicNote: vi.fn(),
        getPublicNotesPage,
      },
      useUserPublicNotes: () => store,
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { ensurePublicNotesReady } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    await ensurePublicNotesReady('alice')
    await ensurePublicNotesReady('alice')

    expect(getPublicFolders).toHaveBeenCalledTimes(2)
    expect(getPublicNotesPage).toHaveBeenCalledTimes(2)
  })

  it('merges one requested folder page into the public store', async () => {
    const mergePublicNotes = vi.fn()
    const getPublicNotesPage = vi.fn(async () => ({
      items: [makeNote({ id: 'note-1', parent_id: 'folder-1' })],
      page: 1,
      perPage: 30,
      totalItems: 31,
      totalPages: 2,
    }))

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: { getPublicNotesPage },
      useUserPublicNotes: () => ({ mergePublicNotes }),
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { loadPublicFolderNotes } = await import('@/processes/public-notes/model/load-public-folder-notes')
    const result = await loadPublicFolderNotes('alice', 'folder-1')

    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'folder-1', 1)
    expect(mergePublicNotes).toHaveBeenCalledWith(result.items)
    expect(result.totalPages).toBe(2)
  })

  it('loads and merges a complete note without replacing the public list', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: 1 })
    const preview = makeNote({ id: 'note-1', content: undefined })
    const detail = makeNote({ id: 'note-1', content: '<p>完整正文</p>' })
    const publicNotes = ref<any[]>([folder, preview])
    const getPublicNote = vi.fn(async () => detail)

    vi.doMock('@/entities/public-note', () => ({
      publicNoteRemoteService: { getPublicNote },
      useUserPublicNotes: () => ({
        mergePublicNotes: (notes: any[]) => {
          const merged = new Map(publicNotes.value.map(note => [note.id, note]))
          notes.forEach(note => merged.set(note.id, { ...merged.get(note.id), ...note }))
          publicNotes.value = [...merged.values()]
        },
      }),
    }))
    vi.doMock('@/entities/auth', () => ({
      authUsersService: {
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      },
    }))

    const { loadPublicNote } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    const result = await loadPublicNote('alice', 'note-1')

    expect(getPublicNote).toHaveBeenCalledWith('user-a', 'note-1')
    expect(result?.content).toBe('<p>完整正文</p>')
    expect(publicNotes.value.map(note => note.id)).toEqual(['folder-1', 'note-1'])
    expect(publicNotes.value.find(note => note.id === 'note-1')?.content).toBe('<p>完整正文</p>')
  })
})
