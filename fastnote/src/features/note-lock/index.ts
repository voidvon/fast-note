export {
  DEFAULT_NOTE_AUTO_LOCK_IDLE_MS,
  DEFAULT_NOTE_AUTO_LOCK_MOBILE_BACKGROUND_MS,
  DEFAULT_NOTE_AUTO_LOCK_RENEWAL_THROTTLE_MS,
  useNoteAutoLock,
} from './model/use-note-auto-lock'
export type { NoteAutoLockReason, UseNoteAutoLockOptions } from './model/use-note-auto-lock'
export {
  createNoteUnlockSession,
  createPinSalt,
  DEFAULT_NOTE_UNLOCK_COOLDOWN_MS,
  DEFAULT_NOTE_UNLOCK_MAX_FAILED_ATTEMPTS,
  DEFAULT_NOTE_UNLOCK_SESSION_TTL,
  hashPinSecret,
  isNoteUnlockSessionValid,
  isWebAuthnAvailable,
  onNoteLockSessionChanged,
  useNoteLock,
  validatePinSetup,
} from './model/use-note-lock'
export type {
  NoteLockBiometricResult,
  NoteLockManageResult,
  NoteLockSessionChangeEvent,
  NoteLockSessionChangeReason,
  NoteLockSetupResult,
  NoteLockVerifyResult,
  NoteLockViewSnapshot,
  NoteLockViewState,
  UseNoteLockOptions,
} from './model/use-note-lock'
export type { NoteLockIndicatorState } from './model/use-note-lock-indicator-state'
export { useNoteLockIndicatorState } from './model/use-note-lock-indicator-state'
export { useNoteLockModalFlow } from './model/use-note-lock-modal-flow'
export type {
  NoteLockFeedback,
  NoteLockManageAction,
  NoteLockManageUpdate,
  NoteLockModalState,
  PendingNoteLockModal,
} from './model/use-note-lock-modal-flow'
export { useNoteLockViewFlow } from './model/use-note-lock-view-flow'
export type { NoteLockViewFlowState, UseNoteLockViewFlowOptions } from './model/use-note-lock-view-flow'

export { default as NoteLockManageModal } from './ui/note-lock-manage-modal.vue'
export { default as NoteLockSetupModal } from './ui/note-lock-setup-modal.vue'
export { default as NoteUnlockPanel } from './ui/note-unlock-panel.vue'
