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

export { default as NoteLockManageModal } from './ui/note-lock-manage-modal.vue'
export { default as NoteLockSetupModal } from './ui/note-lock-setup-modal.vue'
export { default as NoteUnlockPanel } from './ui/note-unlock-panel.vue'
