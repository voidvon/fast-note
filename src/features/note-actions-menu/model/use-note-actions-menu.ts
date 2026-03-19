import { useNoteRepository } from '@/entities/note'

const DELETE_NOW_UPDATED_AT = new Date(0).toISOString().replace('T', ' ')

export function useNoteActionsMenu() {
  const { getNote, setNoteDeletedState, updateNote } = useNoteRepository()

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

    await updateNote(noteId, { updated: DELETE_NOW_UPDATED_AT })
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
