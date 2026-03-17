import type { NoteLockSetupResult } from './use-note-lock'
import type { Note } from '@/types'
import { reactive, ref } from 'vue'
import { useNoteLock } from './use-note-lock'

export type PendingNoteLockModal = 'setup' | 'manage'

export type NoteLockManageAction = 'change_global_pin' | 'toggle_biometric' | 'relock' | 'disable_lock'

export interface NoteLockManageUpdate {
  action: NoteLockManageAction
  note: Note
  biometricEnabled: boolean
  code: string
  message: string | null
}

export interface NoteLockFeedback {
  color: 'success' | 'warning'
  duration: number
  message: string
  note: Note
}

export interface NoteLockModalState {
  defaultBiometricEnabled: boolean
  hasGlobalPin: boolean
  isOpen: boolean
  manageOpen: boolean
}

export function useNoteLockModalFlow() {
  const noteLock = useNoteLock()
  const pendingLockModal = ref<PendingNoteLockModal | null>(null)
  const lockModalState = reactive<NoteLockModalState>({
    defaultBiometricEnabled: false,
    hasGlobalPin: false,
    isOpen: false,
    manageOpen: false,
  })

  async function prepareLockModal(note: Note) {
    const deviceState = await noteLock.getDeviceSecurityState()
    lockModalState.defaultBiometricEnabled = deviceState.biometric_enabled === 1
    lockModalState.hasGlobalPin = await noteLock.hasGlobalPin(true)
    pendingLockModal.value = noteLock.isPinLockNote(note) ? 'manage' : 'setup'
  }

  function openPendingLockModal() {
    if (pendingLockModal.value === 'manage') {
      lockModalState.manageOpen = true
    }
    else if (pendingLockModal.value === 'setup') {
      lockModalState.isOpen = true
    }

    pendingLockModal.value = null
  }

  function isBiometricSupported() {
    return noteLock.isBiometricSupported()
  }

  function buildSetupFeedback(payload: NoteLockSetupResult & { note: Note }): NoteLockFeedback {
    return {
      color: payload.code === 'ok' ? 'success' : 'warning',
      duration: 2200,
      message: payload.message || (payload.note.is_locked === 1 ? '已启用备忘录锁' : '已更新备忘录锁'),
      note: payload.note,
    }
  }

  function buildManageFeedback(payload: NoteLockManageUpdate): NoteLockFeedback {
    lockModalState.defaultBiometricEnabled = payload.biometricEnabled

    const messageMap = {
      change_global_pin: '已更新全局 PIN',
      disable_lock: '已关闭备忘录锁',
      relock: '已重新锁定',
      toggle_biometric: payload.biometricEnabled ? '已启用生物识别快捷解锁' : '已关闭生物识别快捷解锁',
    } as const

    return {
      color: payload.code === 'ok' ? 'success' : 'warning',
      duration: payload.code === 'ok' ? 1500 : 2200,
      message: payload.message || messageMap[payload.action],
      note: payload.note,
    }
  }

  return {
    buildManageFeedback,
    buildSetupFeedback,
    isBiometricSupported,
    lockModalState,
    openPendingLockModal,
    pendingLockModal,
    prepareLockModal,
  }
}
