import { describe, expect, it, vi } from 'vitest'

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('authManager initialize', () => {
  it('restores local auth user without waiting for remote auth refresh', async () => {
    vi.resetModules()

    const pendingRefresh = deferred<{ success: boolean, user?: { id: string, email: string, username: string, avatar: string, created: string, updated: string } }>()
    const localUser = {
      id: 'local-user',
      email: 'local@example.com',
      username: 'local',
      avatar: '',
      created: '2026-04-16 11:00:00',
      updated: '2026-04-16 11:00:00',
    }
    const remoteUser = {
      ...localUser,
      username: 'remote',
    }

    const { authManager } = await import('@/processes/session/model/auth-manager')
    authManager.setAuthService({
      signIn: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      getCurrentAuthUser: vi.fn(() => localUser),
      getCurrentUser: vi.fn(() => pendingRefresh.promise),
      getToken: vi.fn(() => 'token'),
      isAuthenticated: vi.fn(() => true),
      onAuthChange: vi.fn(() => vi.fn()),
    } as any)

    await authManager.initialize()

    expect(authManager.userInfo.value).toMatchObject({ id: 'local-user', username: 'local' })

    pendingRefresh.resolve({
      success: true,
      user: remoteUser,
    })
    await pendingRefresh.promise
    await Promise.resolve()

    expect(authManager.userInfo.value).toMatchObject({ id: 'local-user', username: 'remote' })
  })
})
