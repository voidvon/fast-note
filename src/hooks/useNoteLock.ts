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
} from '@/features/note-lock'

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
} from '@/features/note-lock'
