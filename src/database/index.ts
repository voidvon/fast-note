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
  Metadata,
  Note,
  SyncableItem,
  SyncStatus,
  TypedFile,
  UseRefDBSyncOptions,
  UserInfo,
} from './types'
