import { beforeEach, describe, expect, it, vi } from 'vitest'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, reject, resolve }
}

describe('public remote request deduplication', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('reuses an in-flight public user request', async () => {
    const pendingUser = deferred<{ id: string, username: string }>()
    const getUserByUsername = vi.fn(() => pendingUser.promise)

    vi.doMock('@/shared/api/pocketbase/users', () => ({
      usersService: {
        getUserByUsername,
      },
    }))
    vi.doMock('@/shared/api/pocketbase/auth-service', () => ({
      pocketbaseAuthService: {},
    }))
    vi.doMock('@/shared/api/pocketbase/client', () => ({
      pb: { files: { getURL: vi.fn() } },
    }))

    const { authUsersService } = await import('@/entities/auth/model/auth-service')
    const firstRequest = authUsersService.getPublicUserInfo('alice')
    const secondRequest = authUsersService.getPublicUserInfo('alice')

    expect(getUserByUsername).toHaveBeenCalledTimes(1)

    pendingUser.resolve({ id: 'user-a', username: 'alice' })
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { avatar: '', id: 'user-a', username: 'alice' },
      { avatar: '', id: 'user-a', username: 'alice' },
    ])
  })

  it('reuses an in-flight public note request and retries after failure', async () => {
    const firstNote = deferred<{ id: string }>()
    const getPublicNote = vi.fn()
      .mockReturnValueOnce(firstNote.promise)
      .mockResolvedValueOnce({ id: 'note-1' })

    vi.doMock('@/shared/api/pocketbase', () => ({
      notesApi: {
        getPublicFolders: vi.fn(),
        getPublicNote,
        getPublicNotesPage: vi.fn(),
      },
    }))

    const { publicNoteRemoteService } = await import(
      '@/entities/public-note/model/public-note-remote-service',
    )
    const firstRequest = publicNoteRemoteService.getPublicNote('user-a', 'note-1')
    const secondRequest = publicNoteRemoteService.getPublicNote('user-a', 'note-1')

    expect(getPublicNote).toHaveBeenCalledTimes(1)

    firstNote.reject(new Error('request failed'))
    await expect(firstRequest).rejects.toThrow('request failed')
    await expect(secondRequest).rejects.toThrow('request failed')

    await expect(
      publicNoteRemoteService.getPublicNote('user-a', 'note-1'),
    ).resolves.toEqual({ id: 'note-1' })
    expect(getPublicNote).toHaveBeenCalledTimes(2)
  })

  it('normalizes the default page size before reusing a list request', async () => {
    const page = {
      items: [],
      page: 1,
      perPage: 30,
      totalItems: 0,
      totalPages: 0,
    }
    const pendingPage = deferred<typeof page>()
    const getPublicNotesPage = vi.fn(() => pendingPage.promise)

    vi.doMock('@/shared/api/pocketbase', () => ({
      notesApi: {
        getPublicFolders: vi.fn(),
        getPublicNote: vi.fn(),
        getPublicNotesPage,
      },
      PUBLIC_NOTES_PAGE_SIZE: 30,
    }))

    const { publicNoteRemoteService } = await import(
      '@/entities/public-note/model/public-note-remote-service',
    )
    const defaultPageSizeRequest = publicNoteRemoteService.getPublicNotesPage(
      'user-a',
      'allnotes',
    )
    const explicitPageSizeRequest = publicNoteRemoteService.getPublicNotesPage(
      'user-a',
      'allnotes',
      1,
      30,
    )

    expect(getPublicNotesPage).toHaveBeenCalledTimes(1)
    expect(getPublicNotesPage).toHaveBeenCalledWith('user-a', 'allnotes', 1, 30)

    pendingPage.resolve(page)
    await expect(
      Promise.all([defaultPageSizeRequest, explicitPageSizeRequest]),
    ).resolves.toEqual([page, page])
  })
})
