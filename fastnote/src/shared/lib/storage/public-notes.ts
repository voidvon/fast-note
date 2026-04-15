import type { Note } from '@/shared/types'
import Dexie from 'dexie'

export interface UserPublicNotesDatabase extends Dexie {
  notes: Dexie.Table<Note, string>
}

export const USER_PUBLIC_NOTES_DATABASE_VERSION = 1

export const USER_PUBLIC_NOTES_DATABASE_SCHEMA = {
  notes: '&id, [item_type+parent_id+is_deleted], title, created, item_type, parent_id, content, updated, version, is_deleted, note_count',
} as const

export function createUserPublicNotesDatabase(username: string): UserPublicNotesDatabase {
  const database = new Dexie(`UserPublicNotes_${username}`) as UserPublicNotesDatabase
  database.version(USER_PUBLIC_NOTES_DATABASE_VERSION).stores(USER_PUBLIC_NOTES_DATABASE_SCHEMA)
  return database
}

export async function readUserPublicNotes(database: Pick<UserPublicNotesDatabase, 'notes'>) {
  return await database.notes
    .orderBy('created')
    .toArray()
}
