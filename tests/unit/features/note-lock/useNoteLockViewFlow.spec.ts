import { describe, expect, it, vi } from 'vitest'
import { useNoteLockViewFlow } from '@/features/note-lock/model/use-note-lock-view-flow'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteLockViewFlow', () => {
  it('syncs locked note snapshots and blocks editor content until unlocked', async () => {
    const onLocked = vi.fn()
    const onUnlocked = vi.fn()
    const note = makeNote({
      id: 'locked-note',
      is_locked: 1,
    })
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(async () => ({
          viewState: 'locked',
          failedAttempts: 1,
          cooldownUntil: null,
          biometricEnabled: true,
          deviceSupportsBiometric: true,
          session: null,
        })),
        isPinLockNote: vi.fn(() => true),
        tryBiometricUnlock: vi.fn(),
        verifyPin: vi.fn(),
      },
      onLocked,
      onUnlocked,
    })

    await flow.applyNoteState(note)

    expect(flow.state.viewState).toBe('locked')
    expect(flow.state.biometricEnabled).toBe(true)
    expect(flow.state.deviceSupportsBiometric).toBe(true)
    expect(flow.state.failedAttempts).toBe(1)
    expect(onLocked).toHaveBeenCalledTimes(1)
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it('unlocks with pin and forwards unlocked note back to page', async () => {
    const note = makeNote({
      id: 'locked-note',
      is_locked: 1,
    })
    const onUnlocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(),
        isPinLockNote: vi.fn(() => true),
        tryBiometricUnlock: vi.fn(),
        verifyPin: vi.fn(async () => ({
          ok: true,
          code: 'ok',
          message: null,
          failedAttempts: 0,
          cooldownUntil: null,
        })),
      },
      onLocked: vi.fn(),
      onUnlocked,
    })

    await flow.unlockWithPin(note, '123456')

    expect(flow.state.viewState).toBe('unlocked')
    expect(flow.state.errorMessage).toBe('')
    expect(flow.state.failedAttempts).toBe(0)
    expect(flow.state.cooldownUntil).toBeNull()
    expect(onUnlocked).toHaveBeenCalledWith(note)
  })

  it('keeps locked state and surfaces biometric fallback messaging on failure', async () => {
    const note = makeNote({
      id: 'locked-note',
      is_locked: 1,
    })
    const onLocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(),
        isPinLockNote: vi.fn(() => true),
        tryBiometricUnlock: vi.fn(async () => ({
          ok: false,
          code: 'unsupported',
          message: '当前设备不支持生物识别，请输入 PIN 解锁',
          failedAttempts: 0,
          cooldownUntil: null,
        })),
        verifyPin: vi.fn(),
      },
      onLocked,
      onUnlocked: vi.fn(),
    })

    await flow.unlockWithBiometric(note)

    expect(flow.state.viewState).toBe('locked')
    expect(flow.state.errorMessage).toBe('当前设备不支持生物识别，请输入 PIN 解锁')
    expect(onLocked).toHaveBeenCalledTimes(1)
  })
})
