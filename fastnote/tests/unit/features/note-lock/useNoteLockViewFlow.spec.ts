import { describe, expect, it, vi } from 'vitest'
import { useNoteLockViewFlow } from '@/features/note-lock/model/use-note-lock-view-flow'
import { makeNote } from '../../../factories/note.factory'
import { deferred } from '../../../helpers/note-detail-save-test-utils'

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
    const onUnlocked = vi.fn(async () => {})
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

    expect(onUnlocked).toHaveBeenCalledWith(note, expect.any(Function))
    expect(flow.state.viewState).toBe('unlocked')
    expect(flow.state.errorMessage).toBe('')
    expect(flow.state.failedAttempts).toBe(0)
    expect(flow.state.cooldownUntil).toBeNull()
  })

  it('waits for unlocked rendering work before exposing the editor', async () => {
    const note = makeNote({
      id: 'locked-note',
      is_locked: 1,
    })
    const eventOrder: string[] = []
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
      onUnlocked: vi.fn(async () => {
        eventOrder.push('onUnlocked:start')
        expect(flow.state.viewState).toBe('unlocked')
        await Promise.resolve()
        eventOrder.push('onUnlocked:end')
      }),
    })

    await flow.unlockWithPin(note, '123456')

    expect(eventOrder).toEqual(['onUnlocked:start', 'onUnlocked:end'])
    expect(flow.state.viewState).toBe('unlocked')
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

  it('can fail closed without re-reading the persisted session', () => {
    const onLocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(),
        isPinLockNote: vi.fn(),
        tryBiometricUnlock: vi.fn(),
        verifyPin: vi.fn(),
      },
      onLocked,
      onUnlocked: vi.fn(),
    })
    flow.state.viewState = 'unlocked'
    flow.state.errorMessage = '旧错误'

    flow.lock()

    expect(flow.state.viewState).toBe('locked')
    expect(flow.state.errorMessage).toBe('')
    expect(onLocked).toHaveBeenCalledOnce()
  })

  it('returns to the locked view if reading the local session fails', async () => {
    const onLocked = vi.fn()
    const onUnlocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn()
          .mockRejectedValue(new Error('local storage unavailable')),
        isPinLockNote: vi.fn(() => true),
        tryBiometricUnlock: vi.fn(),
        verifyPin: vi.fn(),
      },
      onLocked,
      onUnlocked,
    })

    await expect(flow.applyNoteState(makeNote({ is_locked: 1 })))
      .rejects
      .toThrow('local storage unavailable')
    expect(flow.state.viewState).toBe('locked')
    expect(onLocked).toHaveBeenCalledOnce()
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it('ignores a failed local session read after selecting another note', async () => {
    const session = deferred<any>()
    const onUnlocked = vi.fn()
    const onLocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(() => session.promise),
        isPinLockNote: note => note?.is_locked === 1,
        tryBiometricUnlock: vi.fn(),
        verifyPin: vi.fn(),
      },
      onUnlocked,
      onLocked,
    })

    const loading = flow.applyNoteState(makeNote({ id: 'locked-note', is_locked: 1 }))
    const rejected = expect(loading).rejects.toThrow('local storage unavailable')
    const nextNote = makeNote({ id: 'next-note', is_locked: 0 })
    await flow.applyNoteState(nextNote)
    session.reject(new Error('local storage unavailable'))
    await rejected

    expect(flow.state.viewState).toBe('unlocked')
    expect(onUnlocked).toHaveBeenCalledExactlyOnceWith(nextNote, expect.any(Function))
    expect(onLocked).not.toHaveBeenCalled()
  })

  it('ignores a lock snapshot that arrives after a successful unlock', async () => {
    const snapshot = deferred<any>()
    const note = makeNote({ id: 'locked-note', is_locked: 1 })
    const onUnlocked = vi.fn()
    const onLocked = vi.fn()
    const flow = useNoteLockViewFlow({
      noteLock: {
        getLockViewState: vi.fn(() => snapshot.promise),
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
      onUnlocked,
      onLocked,
    })
    const loading = flow.applyNoteState(note)
    expect(flow.state.viewState).toBe('checking')
    await flow.unlockWithPin(note, '123456')
    snapshot.resolve({
      viewState: 'locked',
      failedAttempts: 0,
      cooldownUntil: null,
      biometricEnabled: false,
      deviceSupportsBiometric: false,
      session: null,
    })
    await loading
    expect(flow.state.viewState).toBe('unlocked')
    expect(onUnlocked).toHaveBeenCalledOnce()
    expect(onLocked).not.toHaveBeenCalled()
  })

  it.each(['unlockWithPin', 'unlockWithBiometric'] as const)(
    'discards pending %s after relocking',
    async (method) => {
      const verification = deferred<any>()
      const onUnlocked = vi.fn()
      const flow = useNoteLockViewFlow({
        noteLock: {
          getLockViewState: vi.fn(),
          isPinLockNote: vi.fn(() => true),
          tryBiometricUnlock: vi.fn(() => verification.promise),
          verifyPin: vi.fn(() => verification.promise),
        },
        onUnlocked,
      })
      const unlocking = flow[method](makeNote({ is_locked: 1 }), '123456')
      flow.lock()
      verification.resolve({
        ok: true,
        code: 'ok',
        message: null,
        failedAttempts: 0,
        cooldownUntil: null,
      })
      await unlocking
      expect(flow.state.viewState).toBe('locked')
      expect(flow.state.isPinUnlocking).toBe(false)
      expect(onUnlocked).not.toHaveBeenCalled()
    },
  )
})
