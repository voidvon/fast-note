import type { useNote } from './state/note-store'
import { useNote as useNoteStore } from './state/note-store'

export type NoteRepository = ReturnType<typeof useNote>

export function useNoteRepository(): NoteRepository {
  return useNoteStore()
}
