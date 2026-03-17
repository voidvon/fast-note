import type { Note } from '@/types'
import { useNote } from '@/stores'
import { getTime } from '@/utils/date'

export interface NoteDeleteResult {
  note: Note
  ok: boolean
}

export interface UseNoteDeleteOptions {
  updateNote?: ReturnType<typeof useNote>['updateNote']
  updateParentFolderSubcount?: ReturnType<typeof useNote>['updateParentFolderSubcount']
}

export function useNoteDelete(options: UseNoteDeleteOptions = {}) {
  const noteStore = useNote()
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
