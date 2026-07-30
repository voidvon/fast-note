import { useNote } from '@/entities/note'
import { useNotePurgeService } from '@/entities/note/model/note-purge-service'

export function useNoteActionsMenu() {
  const { getNote, setNoteDeletedState, updateNote } = useNote()
  const { queueNotePurge } = useNotePurgeService()

  function getNoteById(id: string) {
    return getNote(id)
  }

  async function renameNote(noteId: string, title: string) {
    const note = getNote(noteId)
    if (!note) {
      return null
    }

    await updateNote(noteId, { title })
    return getNote(noteId)
  }

  async function deleteNote(noteId: string) {
    const note = getNote(noteId)
    if (!note) {
      return null
    }

    return await setNoteDeletedState(note, 1)
  }

  async function restoreNote(noteId: string) {
    const note = getNote(noteId)
    if (!note) {
      return null
    }

    return await setNoteDeletedState(note, 0)
  }

  async function deleteNow(noteId: string) {
    const note = getNote(noteId)
    if (!note) {
      return null
    }

    await queueNotePurge(noteId)
    return getNote(noteId)
  }

  return {
    deleteNote,
    deleteNow,
    getNoteById,
    renameNote,
    restoreNote,
  }
}
