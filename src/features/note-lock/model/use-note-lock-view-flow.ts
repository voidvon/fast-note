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
  onUnlocked?: (note: Note) => void
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

  function reset() {
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

  async function refresh(note: Note) {
    const snapshot = await noteLock.getLockViewState(note.id, note)
    applySnapshot(snapshot)
    return snapshot
  }

  async function applyNoteState(note: Note) {
    if (noteLock.isPinLockNote(note)) {
      const snapshot = await refresh(note)
      if (snapshot.viewState !== 'unlocked') {
        options.onLocked?.()
        return snapshot
      }
    }
    else {
      reset()
    }

    options.onUnlocked?.(note)
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

    state.isPinUnlocking = true
    state.viewState = 'unlocking'
    state.errorMessage = ''

    try {
      const result = await noteLock.verifyPin(note.id, pin)
      applyUnlockResult(result, 'PIN 不正确，请重试')

      if (result.ok) {
        options.onUnlocked?.(note)
      }
      else {
        options.onLocked?.()
      }

      return result
    }
    finally {
      state.isPinUnlocking = false
    }
  }

  async function unlockWithBiometric(note: Note) {
    if (!note.id) {
      return null
    }

    state.isPinUnlocking = true
    state.viewState = 'unlocking'
    state.errorMessage = ''

    try {
      const result = await noteLock.tryBiometricUnlock(note.id, note)
      applyUnlockResult(result, '生物识别不可用，请输入 PIN 解锁')

      if (result.ok) {
        options.onUnlocked?.(note)
      }
      else {
        options.onLocked?.()
      }

      return result
    }
    finally {
      state.isPinUnlocking = false
    }
  }

  function applyUnlockResult(result: NoteLockVerifyResult | NoteLockBiometricResult, fallbackMessage: string) {
    state.failedAttempts = result.failedAttempts
    state.cooldownUntil = result.cooldownUntil

    if (!result.ok) {
      state.viewState = result.code === 'cooldown' ? 'cooldown' : 'locked'
      state.errorMessage = result.message || fallbackMessage
      return
    }

    state.viewState = 'unlocked'
    state.errorMessage = ''
  }

  return {
    applyNoteState,
    refresh,
    reset,
    state,
    unlockWithBiometric,
    unlockWithPin,
  }
}
