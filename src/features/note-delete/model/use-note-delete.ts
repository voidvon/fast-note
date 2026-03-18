import type { NoteRepository } from '@/entities/note'
import type { Note } from '@/shared/types'
import { useNoteRepository } from '@/entities/note'
import { getTime } from '@/shared/lib/date'

export interface NoteDeleteResult {
  note: Note
  ok: boolean
}

export interface UseNoteDeleteOptions {
  updateNote?: NoteRepository['updateNote']
  updateParentFolderSubcount?: NoteRepository['updateParentFolderSubcount']
}

export function useNoteDelete(options: UseNoteDeleteOptions = {}) {
  const noteStore = useNoteRepository()
  const updateNote = options.updateNote || noteStore.updateNote
  const updateParentFolderSubcount = options.updateParentFolderSubcount || noteStore.updateParentFolderSubcount

  async function deleteNote(note: Note): Promise<NoteDeleteResult> {
    const now = getTime()
    const deletedNote = {
      ...note,
      is_deleted: 1,
      updated: now,
    }

    await updateNote(note.id, deletedNote)
    await updateParentFolderSubcount(note)

    return {
      note: deletedNote,
      ok: true,
    }
  }

  return {
    deleteNote,
  }
}
