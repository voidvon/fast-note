import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PocketBaseAuthService } from '@/shared/api/pocketbase/auth-service'

const pocketbaseMocks = vi.hoisted(() => ({
  authRefresh: vi.fn(),
  authStore: {
    isValid: true,
    model: {
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
    },
    token: 'expired-token',
    clear: vi.fn(),
    onChange: vi.fn(),
  },
}))

vi.mock('@/shared/api/pocketbase/client', () => ({
  pb: {
    authStore: pocketbaseMocks.authStore,
    collection: vi.fn(() => ({
      authRefresh: pocketbaseMocks.authRefresh,
    })),
  },
}))

describe('pocketBaseAuthService.getCurrentUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pocketbaseMocks.authStore.isValid = true
    pocketbaseMocks.authStore.model = {
      id: 'user-1',
      email: 'user@example.com',
      username: 'user',
    }
    pocketbaseMocks.authStore.token = 'expired-token'
  })

  it('clears the local auth state when auth refresh returns 401', async () => {
    pocketbaseMocks.authRefresh.mockRejectedValueOnce({
      status: 401,
      message: 'The request requires valid record authorization token.',
    })

    const service = new PocketBaseAuthService()
    const result = await service.getCurrentUser()

    expect(result).toEqual({
      success: false,
      error: 'The request requires valid record authorization token.',
    })
    expect(pocketbaseMocks.authStore.clear).toHaveBeenCalledOnce()
  })

  it('keeps the local auth state for a temporary network failure', async () => {
    pocketbaseMocks.authRefresh.mockRejectedValueOnce({
      status: 0,
      message: 'Failed to fetch',
    })

    const service = new PocketBaseAuthService()
    const result = await service.getCurrentUser()

    expect(result).toEqual({ success: false, error: 'Failed to fetch' })
    expect(pocketbaseMocks.authStore.clear).not.toHaveBeenCalled()
  })
})
