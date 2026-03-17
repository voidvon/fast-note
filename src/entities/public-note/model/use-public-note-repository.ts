import type { useUserPublicNotes } from './state/public-note-store'
import { useUserPublicNotes as usePublicNoteStore } from './state/public-note-store'

export type PublicNoteRepository = ReturnType<typeof useUserPublicNotes>

export function usePublicNoteRepository(username: string): PublicNoteRepository {
  return usePublicNoteStore(username)
}
