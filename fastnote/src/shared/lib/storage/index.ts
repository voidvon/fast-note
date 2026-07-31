export {
  deleteNotePurgeJob,
  deleteStoredNoteFileRefs,
  getStoredNoteFileRef,
  listNotePurgeJobs,
  listStoredNoteFileRefs,
  putNotePurgeJob,
  putStoredNoteFileRef,
} from './attachment-files'

export { preparePersistentStorage } from './capacity'

export {
  getCurrentDatabaseName,
  initializeDatabase,
  type NoteDatabase,
  openCurrentDatabaseConnection,
  openIsolatedDatabase,
  switchDatabase,
  toBool,
  toNumber,
  useDexie,
} from './dexie'

export {
  deleteStoredNoteFile,
  deleteStoredNoteFiles,
  getStoredNoteFile,
  getStoredNoteFiles,
  hasStoredNoteFile,
  listStoredNoteFiles,
  putStoredNoteFile,
} from './note-files'

export {
  createNotesSync,
  type NoteSyncController,
  readStoredNotes,
} from './notes'

export { useRefDBSync } from './sync'

export type {
  DeviceSecurityState,
  Metadata,
  Note,
  NoteFile,
  NoteFileRef,
  NoteFileRefStatus,
  NoteLockFields,
  NoteLockType,
  NotePurgeJob,
  NoteUnlockSession,
  SecuritySettings,
  SyncableItem,
  SyncStatus,
  TypedFile,
  UseRefDBSyncOptions,
  UserInfo,
} from './types'
