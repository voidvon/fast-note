import type { Ref } from 'vue'
import type { DeviceSecurityState, Metadata, Note, NoteFile, NoteUnlockSession, SecuritySettings, UserInfo } from './types'
import Dexie from 'dexie'
import { ref } from 'vue'
import { getScopedDatabaseName } from '@/utils/userScope'

export interface NoteDatabase extends Dexie {
  notes: Dexie.Table<Note, string>
  note_files: Dexie.Table<NoteFile, string>
  user_info: Dexie.Table<UserInfo, string>
  metadata: Dexie.Table<Metadata, string>
  security_settings: Dexie.Table<SecuritySettings, string>
  device_security_state: Dexie.Table<DeviceSecurityState, string>
  note_unlock_sessions: Dexie.Table<NoteUnlockSession, string>
  [key: string]: any
}

export const NOTE_DATABASE_VERSION = 3

export const NOTE_DATABASE_SCHEMA_V1 = {
  notes: '&id, [item_type+parent_id+is_deleted], title, created, item_type, parent_id, content, updated, version, is_deleted, note_count, files',
  note_files: '&hash, fileName, fileSize, fileType, created, updated',
  user_info: '&id, username, name',
  metadata: '&key, value',
} as const

export const NOTE_DATABASE_SCHEMA_V2 = {
  ...NOTE_DATABASE_SCHEMA_V1,
  notes: `${NOTE_DATABASE_SCHEMA_V1.notes}, is_locked, lock_type, lock_secret_salt, lock_secret_hash, lock_version`,
  device_security_state: '&scope_key, updated',
  note_unlock_sessions: '&note_id, expires_at, updated',
} as const

export const NOTE_DATABASE_SCHEMA_V3 = {
  ...NOTE_DATABASE_SCHEMA_V1,
  notes: `${NOTE_DATABASE_SCHEMA_V1.notes}, is_locked`,
  security_settings: '&scope_key, updated',
  device_security_state: '&scope_key, updated',
  note_unlock_sessions: '&note_id, expires_at, updated',
} as const

const db = ref<NoteDatabase>()
const onNoteUpdateArr: (() => void)[] = []
let currentDatabaseName = ''

function applySchema(database: NoteDatabase) {
  database.version(1).stores(NOTE_DATABASE_SCHEMA_V1)
  database.version(2).stores(NOTE_DATABASE_SCHEMA_V2)
  database.version(NOTE_DATABASE_VERSION).stores(NOTE_DATABASE_SCHEMA_V3)
}

async function openDatabase(databaseName: string) {
  const database = new Dexie(databaseName) as NoteDatabase
  applySchema(database)
  await database.open()
  return database
}

export async function openIsolatedDatabase(userId?: string | null) {
  const databaseName = getScopedDatabaseName(userId)
  return openDatabase(databaseName)
}

export async function initializeDatabase(userId?: string | null) {
  const databaseName = getScopedDatabaseName(userId)

  if (db.value && currentDatabaseName === databaseName)
    return db.value

  if (db.value)
    db.value.close()

  db.value = await openDatabase(databaseName)
  currentDatabaseName = databaseName
  ;(window as any).db = db.value

  return db.value
}

export async function switchDatabase(userId?: string | null) {
  return initializeDatabase(userId)
}

export function getCurrentDatabaseName() {
  return currentDatabaseName
}

export function toBool(value: boolean | 0 | 1 | undefined): boolean {
  if (typeof value === 'boolean')
    return value
  return value === 1
}

export function toNumber(value: boolean | 0 | 1 | undefined): 0 | 1 {
  if (typeof value === 'number')
    return value as 0 | 1
  return value ? 1 : 0
}

export function useDexie() {
  const privateNoteUpdateArr: (() => void)[] = []

  function onNoteUpdate(fn: () => void) {
    onNoteUpdateArr.push(fn)
    privateNoteUpdateArr.push(fn)
  }

  return {
    db: db as Ref<NoteDatabase>,
    onNoteUpdate,
  }
}
