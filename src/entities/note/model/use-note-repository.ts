import type { useNote } from '@/stores/notes'
import { useNote as useNoteStore } from '@/stores/notes'

export type NoteRepository = ReturnType<typeof useNote>

export function useNoteRepository(): NoteRepository {
  return useNoteStore()
}
