import type { NoteDatabase } from './dexie'
import type { NoteFile } from './types'

interface NoteFilesDatabase {
  note_files: NoteDatabase['note_files']
}

export async function putStoredNoteFile(database: NoteFilesDatabase, file: NoteFile) {
  await database.note_files.put(file)
}

export async function getStoredNoteFile(database: NoteFilesDatabase, hash: string) {
  return await database.note_files.get(hash)
}

export async function getStoredNoteFiles(database: NoteFilesDatabase, hashes: string[]) {
  const files = await Promise.all(hashes.map(hash => database.note_files.get(hash)))
  return files.filter(Boolean) as NoteFile[]
}

export async function hasStoredNoteFile(database: NoteFilesDatabase, hash: string) {
  return !!await database.note_files.get(hash)
}

export async function deleteStoredNoteFile(database: NoteFilesDatabase, hash: string) {
  await database.note_files.delete(hash)
}

export async function deleteStoredNoteFiles(database: NoteFilesDatabase, hashes: string[]) {
  await Promise.all(hashes.map(hash => database.note_files.delete(hash)))
}

export async function listStoredNoteFiles(database: NoteFilesDatabase) {
  return await database.note_files.toArray()
}
