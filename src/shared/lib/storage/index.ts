export {
  getCurrentDatabaseName,
  initializeDatabase,
  type NoteDatabase,
  openIsolatedDatabase,
  switchDatabase,
  toBool,
  toNumber,
  useDexie,
} from './dexie'

export {
  useRefDBSync,
} from './sync'

export type {
  DeviceSecurityState,
  Metadata,
  Note,
  NoteFile,
  NoteLockFields,
  NoteLockType,
  NoteUnlockSession,
  SecuritySettings,
  SyncableItem,
  SyncStatus,
  TypedFile,
  UseRefDBSyncOptions,
  UserInfo,
} from './types'
