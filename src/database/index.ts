/**
 * 数据库模块统一导出
 */

export {
  getCurrentDatabaseName,
  initializeDatabase,
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
