import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPocketBaseCollectionMock } from '../../mocks/pocketbase.mock'

describe('pocketbase users pin settings', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns immediately when update response already contains the latest pin fields', async () => {
    const usersCollection = createPocketBaseCollectionMock()
    const authStoreSaveMock = vi.fn()
    usersCollection.update.mockResolvedValue({
      id: 'user-a',
      note_lock_pin_salt: 'salt-1',
      note_lock_pin_hash: 'hash-1',
      note_lock_pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })

    vi.doMock('@/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          token: 'token-1',
          model: { id: 'user-a' },
          isValid: true,
          save: authStoreSaveMock,
        },
        collection: vi.fn(() => usersCollection),
      },
    }))

    const { usersService } = await import('@/pocketbase/users')
    const result = await usersService.updateCurrentUserPinSettings({
      note_lock_pin_salt: 'salt-1',
      note_lock_pin_hash: 'hash-1',
      note_lock_pin_version: 1,
    })

    expect(result).toMatchObject({
      note_lock_pin_salt: 'salt-1',
      note_lock_pin_hash: 'hash-1',
      note_lock_pin_version: 1,
    })
    expect(usersCollection.getOne).not.toHaveBeenCalled()
    expect(authStoreSaveMock).toHaveBeenCalledWith('token-1', expect.objectContaining({
      id: 'user-a',
      note_lock_pin_version: 1,
    }))
  })

  it('re-reads the user record when update response does not include the pin fields', async () => {
    const usersCollection = createPocketBaseCollectionMock()
    const authStoreSaveMock = vi.fn()
    usersCollection.update.mockResolvedValue({
      id: 'user-a',
      note_lock_pin_salt: null,
      note_lock_pin_hash: null,
      note_lock_pin_version: null,
      updated: '2026-03-10 10:00:00',
    })
    usersCollection.getOne.mockResolvedValue({
      id: 'user-a',
      note_lock_pin_salt: 'salt-2',
      note_lock_pin_hash: 'hash-2',
      note_lock_pin_version: 2,
      updated: '2026-03-10 10:00:05',
    })

    vi.doMock('@/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          token: 'token-1',
          model: { id: 'user-a' },
          isValid: true,
          save: authStoreSaveMock,
        },
        collection: vi.fn(() => usersCollection),
      },
    }))

    const { usersService } = await import('@/pocketbase/users')
    const result = await usersService.updateCurrentUserPinSettings({
      note_lock_pin_salt: 'salt-2',
      note_lock_pin_hash: 'hash-2',
      note_lock_pin_version: 2,
    })

    expect(usersCollection.getOne).toHaveBeenCalledWith('user-a')
    expect(result).toMatchObject({
      note_lock_pin_salt: 'salt-2',
      note_lock_pin_hash: 'hash-2',
      note_lock_pin_version: 2,
    })
    expect(authStoreSaveMock).toHaveBeenCalledWith('token-1', expect.objectContaining({
      id: 'user-a',
      note_lock_pin_version: 2,
    }))
  })

  it('throws an explicit error when users record still misses the three pin fields after re-read', async () => {
    const usersCollection = createPocketBaseCollectionMock()
    usersCollection.update.mockResolvedValue({
      id: 'user-a',
      note_lock_pin_salt: null,
      note_lock_pin_hash: null,
      note_lock_pin_version: null,
    })
    usersCollection.getOne.mockResolvedValue({
      id: 'user-a',
      note_lock_pin_salt: null,
      note_lock_pin_hash: null,
      note_lock_pin_version: null,
    })

    vi.doMock('@/pocketbase/client', () => ({
      mapErrorMessage: (error: any) => error?.message || 'error',
      pb: {
        authStore: {
          token: 'token-1',
          model: { id: 'user-a' },
          isValid: true,
          save: vi.fn(),
        },
        collection: vi.fn(() => usersCollection),
      },
    }))

    const { usersService } = await import('@/pocketbase/users')

    await expect(usersService.updateCurrentUserPinSettings({
      note_lock_pin_salt: 'salt-3',
      note_lock_pin_hash: 'hash-3',
      note_lock_pin_version: 3,
    })).rejects.toThrow('更新当前用户 PIN 设置失败: PocketBase users 表未保存备忘录锁字段')
  })
})
