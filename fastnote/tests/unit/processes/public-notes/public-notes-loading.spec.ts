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
      initializeUserPublicNotes: vi.fn(async () => undefined),
      publicNoteRemoteService: {
        getPublicFolders,
        getPublicNote,
      },
      useUserPublicNotes: () => store,
    }))
    vi.doMock('@/processes/public-notes/model/use-public-user-cache', () => ({
      usePublicUserCache: () => ({
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      }),
    }))

    const { ensurePublicNotesReady } = await import('@/processes/public-notes/model/ensure-public-notes-ready')
    const result = await ensurePublicNotesReady('alice', { noteId: 'note-1' })

    expect(getPublicFolders).toHaveBeenCalledWith('user-a')
    expect(getPublicNote).toHaveBeenCalledWith('user-a', 'note-1')
    expect(result.synced).toBe(2)
    expect(publicNotes.value.map(note => note.id)).toEqual(['folder-1', 'note-1'])
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
    vi.doMock('@/processes/public-notes/model/use-public-user-cache', () => ({
      usePublicUserCache: () => ({
        getPublicUserInfo: vi.fn(async () => ({ id: 'user-a', username: 'alice' })),
      }),
    }))

    const { loadPublicFolderNotes } = await import('@/processes/public-notes/model/load-public-folder-notes')
    const result = await loadPublicFolderNotes('alice', 'folder-1')

    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'folder-1', 1)
    expect(mergePublicNotes).toHaveBeenCalledWith(result.items)
    expect(result.totalPages).toBe(2)
  })
})
