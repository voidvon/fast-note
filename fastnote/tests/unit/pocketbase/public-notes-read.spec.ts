import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPocketBaseCollectionMock } from '../../mocks/pocketbase.mock'

describe('pocketbase public notes reads', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('loads lightweight folders and a bounded note page', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    const filter = vi.fn((expression: string) => expression)
    notesCollection.getFullList.mockResolvedValue([{ id: 'folder-1' }])
    notesCollection.getList.mockResolvedValue({
      items: [{ id: 'note-1' }],
      page: 1,
      perPage: 30,
      totalItems: 31,
      totalPages: 2,
    })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: { isValid: false, model: null },
        collection: vi.fn(() => notesCollection),
        filter,
      },
    }))

    const { notesService, PUBLIC_NOTES_PAGE_SIZE } = await import('@/shared/api/pocketbase/notes')
    await notesService.getPublicFolders('user-a')
    const result = await notesService.getPublicNotesPage('user-a', 'folder-1')

    expect(notesCollection.getFullList).toHaveBeenCalledWith(expect.objectContaining({
      fields: expect.not.stringContaining('content'),
      requestKey: 'public-folders:user-a',
      sort: '+created',
    }))
    expect(notesCollection.getList).toHaveBeenCalledWith(1, PUBLIC_NOTES_PAGE_SIZE, expect.objectContaining({
      fields: expect.not.stringContaining('content'),
      requestKey: `public-notes:user-a:folder-1:1:${PUBLIC_NOTES_PAGE_SIZE}`,
      sort: '-updated',
    }))
    expect(result.totalPages).toBe(2)
    expect(filter).toHaveBeenCalledWith(expect.stringContaining('parent_id = {:parentId}'), {
      parentId: 'folder-1',
      userId: 'user-a',
    })
  })

  it('loads a public detail as a single filtered record', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    const filter = vi.fn((expression: string) => expression)
    notesCollection.getFirstListItem.mockResolvedValue({ id: 'note-1', content: '<p>detail</p>' })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: { isValid: false, model: null },
        collection: vi.fn(() => notesCollection),
        filter,
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    const note = await notesService.getPublicNote('user-a', 'note-1')

    expect(note.content).toBe('<p>detail</p>')
    expect(notesCollection.getFirstListItem).toHaveBeenCalledWith(
      expect.stringContaining('id = {:noteId}'),
      { requestKey: 'public-note:user-a:note-1' },
    )
    expect(filter).toHaveBeenCalledWith(expect.stringContaining('is_public = true'), {
      noteId: 'note-1',
      userId: 'user-a',
    })
  })
})
