import type {
  NoteLockBiometricResult,
  NoteLockVerifyResult,
  NoteLockViewSnapshot,
  NoteLockViewState,
} from './use-note-lock'
import type { Note } from '@/shared/types'
import { reactive } from 'vue'
import { useNoteLock } from './use-note-lock'

export interface NoteLockViewFlowState {
  biometricEnabled: boolean
  cooldownUntil: number | null
  deviceSupportsBiometric: boolean
  errorMessage: string
  failedAttempts: number
  isPinUnlocking: boolean
  viewState: NoteLockViewState
}

export interface UseNoteLockViewFlowOptions {
  noteLock?: Pick<ReturnType<typeof useNoteLock>, 'getLockViewState' | 'isPinLockNote' | 'tryBiometricUnlock' | 'verifyPin'>
  onLocked?: () => void
  onUnlocked?: (note: Note, isCurrent: () => boolean) => void | Promise<void>
}

function createInitialState(): NoteLockViewFlowState {
  return {
    biometricEnabled: false,
    cooldownUntil: null,
    deviceSupportsBiometric: false,
    errorMessage: '',
    failedAttempts: 0,
    isPinUnlocking: false,
    viewState: 'unlocked',
  }
}

export function useNoteLockViewFlow(options: UseNoteLockViewFlowOptions = {}) {
  const noteLock = options.noteLock || useNoteLock()
  const state = reactive<NoteLockViewFlowState>(createInitialState())
  let requestVersion = 0

  function beginRequest() {
    const version = ++requestVersion
    state.isPinUnlocking = false
    return () => version === requestVersion
  }

  function reset() {
    requestVersion += 1
    Object.assign(state, createInitialState())
  }

  function applySnapshot(snapshot: NoteLockViewSnapshot) {
    state.viewState = snapshot.viewState
    state.failedAttempts = snapshot.failedAttempts
    state.cooldownUntil = snapshot.cooldownUntil
    state.biometricEnabled = snapshot.biometricEnabled
    state.deviceSupportsBiometric = snapshot.deviceSupportsBiometric

    if (snapshot.viewState !== 'cooldown') {
      state.errorMessage = ''
    }
  }

  function lock() {
    requestVersion += 1
    state.isPinUnlocking = false
    state.viewState = 'locked'
    state.errorMessage = ''
    options.onLocked?.()
  }

  async function refresh(note: Note) {
    const isCurrent = beginRequest()
    const snapshot = await noteLock.getLockViewState(note.id, note)
    if (isCurrent()) {
      applySnapshot(snapshot)
    }
    return snapshot
  }

  async function applyNoteState(note: Note) {
    const isCurrent = beginRequest()
    if (noteLock.isPinLockNote(note)) {
      // Hide both content and PIN UI until the persisted local session is known.
      state.viewState = 'checking'
      let snapshot: NoteLockViewSnapshot
      try {
        snapshot = await noteLock.getLockViewState(note.id, note)
      }
      catch (error) {
        if (isCurrent()) {
          lock()
        }
        throw error
      }
      if (!isCurrent()) {
        return snapshot
      }
      applySnapshot(snapshot)
      if (snapshot.viewState !== 'unlocked') {
        options.onLocked?.()
        return snapshot
      }
    }
    else {
      Object.assign(state, createInitialState())
    }

    await options.onUnlocked?.(note, isCurrent)
    return {
      biometricEnabled: state.biometricEnabled,
      cooldownUntil: state.cooldownUntil,
      deviceSupportsBiometric: state.deviceSupportsBiometric,
      failedAttempts: state.failedAttempts,
      session: null,
      viewState: state.viewState,
    } satisfies NoteLockViewSnapshot
  }

  async function unlockWithPin(note: Note, pin: string) {
    if (!note.id) {
      return null
    }

    const isCurrent = beginRequest()
    state.isPinUnlocking = true
    state.viewState = 'unlocking'
    state.errorMessage = ''

    try {
      const result = await noteLock.verifyPin(note.id, pin)
      if (!isCurrent()) {
        return result
      }
      await applyUnlockResult(result, note, 'PIN 不正确，请重试', isCurrent)

      if (!result.ok && isCurrent()) {
        options.onLocked?.()
      }

      return result
    }
    finally {
      if (isCurrent()) {
        state.isPinUnlocking = false
      }
    }
  }

  async function unlockWithBiometric(note: Note) {
    if (!note.id) {
      return null
    }

    const isCurrent = beginRequest()
    state.isPinUnlocking = true
    state.viewState = 'unlocking'
    state.errorMessage = ''

    try {
      const result = await noteLock.tryBiometricUnlock(note.id, note)
      if (!isCurrent()) {
        return result
      }
      await applyUnlockResult(result, note, '生物识别不可用，请输入 PIN 解锁', isCurrent)

      if (!result.ok && isCurrent()) {
        options.onLocked?.()
      }

      return result
    }
    finally {
      if (isCurrent()) {
        state.isPinUnlocking = false
      }
    }
  }

  async function applyUnlockResult(
    result: NoteLockVerifyResult | NoteLockBiometricResult,
    note: Note,
    fallbackMessage: string,
    isCurrent: () => boolean,
  ) {
    state.failedAttempts = result.failedAttempts
    state.cooldownUntil = result.cooldownUntil

    if (!result.ok) {
      state.viewState = result.code === 'cooldown' ? 'cooldown' : 'locked'
      state.errorMessage = result.message || fallbackMessage
      return
    }

    state.viewState = 'unlocked'
    state.errorMessage = ''
    await options.onUnlocked?.(note, isCurrent)
  }

  return {
    applyNoteState,
    lock,
    refresh,
    reset,
    state,
    unlockWithBiometric,
    unlockWithPin,
  }
}
