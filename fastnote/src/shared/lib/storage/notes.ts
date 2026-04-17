import type { Ref } from 'vue'
import type { NoteDatabase } from './dexie'
import type { Note } from '@/shared/types'
import { useRefDBSync } from './sync'

export type NoteSyncController = ReturnType<typeof useRefDBSync<Note>>

interface NotesDatabaseWriter {
  notes: NoteDatabase['notes']
}

export async function readStoredNotes(database: Pick<NoteDatabase, 'notes'>) {
  return await database.notes
    .orderBy('created')
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
