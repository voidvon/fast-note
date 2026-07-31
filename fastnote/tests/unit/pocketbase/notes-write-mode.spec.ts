import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPocketBaseCollectionMock } from '../../mocks/pocketbase.mock'

describe('pocketbase notes write mode', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('uses direct update in update mode without preflight query', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    notesCollection.update.mockResolvedValue({ id: 'note-1' })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          model: { id: 'user-a' },
          isValid: true,
        },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    await notesService.updateNote({ id: 'note-1', title: '更新内容' }, undefined, 'update')

    expect(notesCollection.update).toHaveBeenCalledWith('note-1', expect.objectContaining({
      id: 'note-1',
      title: '更新内容',
      user_id: 'user-a',
    }))
    expect(notesCollection.create).not.toHaveBeenCalled()
    expect(notesCollection.getFullList).not.toHaveBeenCalled()
  })

  it('submits an explicit empty files list when the last attachment is removed', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    notesCollection.update.mockResolvedValue({ id: 'note-empty-files', files: [] })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: { model: { id: 'user-a' }, isValid: true },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    await notesService.updateNote({ id: 'note-empty-files', content: '<p>no file</p>' }, [], 'update')

    expect(notesCollection.update).toHaveBeenCalledWith('note-empty-files', expect.objectContaining({
      files: [],
    }))
  })

  it('stages files on an existing note without changing remote content', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    const file = new File(['image'], 'new.png', { type: 'image/png' })
    notesCollection.update.mockResolvedValue({
      id: 'note-stage-existing',
      files: ['new_random.png', 'old.png'],
    })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: { model: { id: 'user-a' }, isValid: true },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    const result = await notesService.stageNoteFiles({
      id: 'note-stage-existing',
      content: '<p>本地新正文</p>',
      is_public: true,
    }, ['old.png', file], 'update')

    const payload = notesCollection.update.mock.calls[0][1] as FormData
    expect(payload).toBeInstanceOf(FormData)
    expect(payload.has('content')).toBe(false)
    expect(payload.has('is_public')).toBe(false)
    expect(payload.getAll('files')).toEqual(['old.png', file])
    expect(result.fileMapping?.get(file)).toBe('new_random.png')
  })

  it('creates a private empty staging record for a new note', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    const file = new File(['image'], 'new.png', { type: 'image/png' })
    notesCollection.create.mockResolvedValue({
      id: 'note-stage-new',
      files: ['new_random.png'],
    })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: { model: { id: 'user-a' }, isValid: true },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    await notesService.stageNoteFiles({
      id: 'note-stage-new',
      title: '公开笔记',
      content: '<p>包含本地附件</p>',
      is_public: true,
    }, [file], 'create')

    const payload = notesCollection.create.mock.calls[0][0] as FormData
    expect(payload.get('content')).toBe('')
    expect(payload.get('is_public')).toBe('false')
    expect(payload.get('title')).toBe('公开笔记')
    expect(payload.get('user_id')).toBe('user-a')
  })

  it('falls back to update when create mode hits validation_pk_invalid', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    notesCollection.create.mockRejectedValue({
      message: 'The record primary key is invalid or already exists.',
      response: {
        data: {
          id: {
            code: 'validation_pk_invalid',
          },
        },
      },
    })
    notesCollection.update.mockResolvedValue({ id: 'note-1' })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          model: { id: 'user-a' },
          isValid: true,
        },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    await notesService.updateNote({ id: 'note-1', title: '新建内容' }, undefined, 'create')

    expect(notesCollection.create).toHaveBeenCalledTimes(1)
    expect(notesCollection.update).toHaveBeenCalledWith('note-1', expect.objectContaining({
      id: 'note-1',
      title: '新建内容',
      user_id: 'user-a',
    }))
    expect(notesCollection.getFullList).not.toHaveBeenCalled()
  })

  it('falls back to create when update mode gets 404', async () => {
    const notesCollection = createPocketBaseCollectionMock()
    notesCollection.update.mockRejectedValue({ status: 404, message: 'Not found.' })
    notesCollection.create.mockResolvedValue({ id: 'note-2' })

    vi.doMock('@/shared/api/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          model: { id: 'user-a' },
          isValid: true,
        },
        collection: vi.fn(() => notesCollection),
      },
    }))

    const { notesService } = await import('@/shared/api/pocketbase/notes')
    await notesService.updateNote({ id: 'note-2', title: '缺失远端' }, undefined, 'update')

    expect(notesCollection.update).toHaveBeenCalledTimes(1)
    expect(notesCollection.create).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-2',
      title: '缺失远端',
      user_id: 'user-a',
    }))
  })
})
