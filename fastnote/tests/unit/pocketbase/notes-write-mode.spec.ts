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
