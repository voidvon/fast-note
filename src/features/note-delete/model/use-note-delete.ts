import type { Note } from '@/shared/types'
import { useNote } from '@/entities/note'
import { getTime } from '@/shared/lib/date'

type NoteStoreApi = ReturnType<typeof useNote>

export interface NoteDeleteResult {
  note: Note
  ok: boolean
}

export interface UseNoteDeleteOptions {
  updateNote?: NoteStoreApi['updateNote']
  updateParentFolderSubcount?: NoteStoreApi['updateParentFolderSubcount']
  setNoteDeletedState?: NoteStoreApi['setNoteDeletedState']
}

export function useNoteDelete(options: UseNoteDeleteOptions = {}) {
  const noteStore = useNote()
  const updateNote = options.updateNote || noteStore.updateNote
  const updateParentFolderSubcount = options.updateParentFolderSubcount || noteStore.updateParentFolderSubcount
  const setNoteDeletedState = options.setNoteDeletedState || noteStore.setNoteDeletedState

  async function deleteNote(note: Note): Promise<NoteDeleteResult> {
    if (setNoteDeletedState) {
      const deletedNote = await setNoteDeletedState(note, 1)

      return {
        note: deletedNote,
        ok: true,
      }
    }

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
