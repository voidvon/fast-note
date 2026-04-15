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
  searchStoredNotesInDatabase,
} from './notes'

export {
  createUserPublicNotesDatabase,
  readUserPublicNotes,
  type UserPublicNotesDatabase,
} from './public-notes'

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
