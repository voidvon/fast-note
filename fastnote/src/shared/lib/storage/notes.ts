import type { Ref } from 'vue'
import type { NoteDatabase } from './dexie'
import type { Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'
import { useRefDBSync } from './sync'

export type NoteSyncController = ReturnType<typeof useRefDBSync<Note>>

interface NotesDatabaseReader {
  notes: Pick<NoteDatabase['notes'], 'filter' | 'orderBy'>
}

interface NotesDatabaseWriter {
  notes: NoteDatabase['notes']
}

export async function readStoredNotes(database: Pick<NoteDatabase, 'notes'>) {
  return await database.notes
    .orderBy('created')
    .toArray()
}

export async function searchStoredNotesInDatabase(database: NotesDatabaseReader, keyword: string) {
  return await database.notes
    .filter(note =>
      note.item_type === NOTE_TYPE.NOTE
      && note.is_deleted !== 1
      && (note.content.includes(keyword) || note.title.includes(keyword)),
    )
    .toArray()
}

export function createNotesSync(data: Ref<Note[]>, database: NotesDatabaseWriter, debounceMs = 300): NoteSyncController {
  return useRefDBSync({
    data,
    table: database.notes,
    idField: 'id',
    debounceMs,
  })
}
