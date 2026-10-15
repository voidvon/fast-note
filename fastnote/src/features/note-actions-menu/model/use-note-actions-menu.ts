import { nanoid } from 'nanoid'
import { NOTE_TYPE, useNote } from '@/entities/note'
import { useNotePurgeService } from '@/entities/note/model/note-purge-service'
import { getTime } from '@/shared/lib/date'

export function useNoteActionsMenu() {
  const { addNote, getNote, setNoteDeletedState, updateNote } = useNote()
  const { queueNotePurge } = useNotePurgeService()

  function getNoteById(id: string) {
    return getNote(id)
  }

  async function createFolder(parentId: string, title: string) {
    const isoTime = getTime()
    const folderId = nanoid(12)
    await addNote({
      id: folderId,
      title,
      created: isoTime,
      updated: isoTime,
      item_type: NOTE_TYPE.FOLDER,
      parent_id: parentId,
      version: 1,
      content: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
    })
    return getNote(folderId)
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
    createFolder,
    deleteNote,
    deleteNow,
    getNoteById,
    renameNote,
    restoreNote,
  }
}
