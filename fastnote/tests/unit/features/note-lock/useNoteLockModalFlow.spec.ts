import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteLockModalFlow', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('prepares and opens the correct pending modal for unlocked notes', async () => {
    vi.doMock('@/features/note-lock/model/use-note-lock', () => ({
      useNoteLock: () => ({
        getDeviceSecurityState: vi.fn(async () => ({
          biometric_enabled: 1,
        })),
        hasGlobalPin: vi.fn(async () => true),
        isBiometricSupported: vi.fn(() => true),
        isPinLockNote: vi.fn(() => false),
      }),
    }))

    const { useNoteLockModalFlow } = await import('@/features/note-lock/model/use-note-lock-modal-flow')
    const flow = useNoteLockModalFlow()

    await flow.prepareLockModal(makeNote({
      id: 'note-1',
      is_locked: 0,
    }))

    expect(flow.lockModalState.defaultBiometricEnabled).toBe(true)
    expect(flow.lockModalState.hasGlobalPin).toBe(true)
    expect(flow.pendingLockModal.value).toBe('setup')

    flow.openPendingLockModal()

    expect(flow.lockModalState.isOpen).toBe(true)
    expect(flow.lockModalState.manageOpen).toBe(false)
    expect(flow.pendingLockModal.value).toBeNull()
  })

  it('builds manage feedback and syncs biometric state back into modal state', async () => {
    vi.doMock('@/features/note-lock/model/use-note-lock', () => ({
      useNoteLock: () => ({
        getDeviceSecurityState: vi.fn(async () => ({
          biometric_enabled: 0,
        })),
        hasGlobalPin: vi.fn(async () => false),
        isBiometricSupported: vi.fn(() => true),
        isPinLockNote: vi.fn(() => true),
      }),
    }))

    const { useNoteLockModalFlow } = await import('@/features/note-lock/model/use-note-lock-modal-flow')
    const flow = useNoteLockModalFlow()
    const note = makeNote({
      id: 'note-2',
      is_locked: 1,
    })

    const feedback = flow.buildManageFeedback({
      action: 'toggle_biometric',
      biometricEnabled: true,
      code: 'ok',
      message: null,
      note,
    })

    expect(flow.lockModalState.defaultBiometricEnabled).toBe(true)
    expect(feedback).toMatchObject({
      color: 'success',
      duration: 1500,
      message: '已启用生物识别快捷解锁',
      note,
    })
  })
})
