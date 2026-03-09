import type { Ref } from 'vue'
import type { Metadata, Note, NoteFile, UserInfo } from './types'
import Dexie from 'dexie'
import { ref } from 'vue'
import { getScopedDatabaseName } from '@/utils/userScope'

interface NoteDatabase extends Dexie {
  notes: Dexie.Table<Note, string>
  note_files: Dexie.Table<NoteFile, string>
  user_info: Dexie.Table<UserInfo, string>
  metadata: Dexie.Table<Metadata, string>
  [key: string]: any
}

const db = ref<NoteDatabase>()
const onNoteUpdateArr: (() => void)[] = []
let currentDatabaseName = ''

function applySchema(database: NoteDatabase) {
  database.version(1).stores({
    notes: '&id, [item_type+parent_id+is_deleted], title, created, item_type, parent_id, content, updated, version, is_deleted, note_count, files',
    note_files: '&hash, fileName, fileSize, fileType, created, updated',
    user_info: '&id, username, name',
    metadata: '&key, value',
  })
}

async function openDatabase(databaseName: string) {
  const database = new Dexie(databaseName) as NoteDatabase
  applySchema(database)
  await database.open()
  return database
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
