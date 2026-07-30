import type { Note } from '@/shared/types'
import { clearUnusedPublicAncestorFolders, ensurePublicAncestorFolders, useNote } from '@/entities/note'
import { getTime } from '@/shared/lib/date'
import { NOTE_TYPE } from '@/shared/types'

type NoteStoreApi = ReturnType<typeof useNote>

export interface PublicNoteAccessResult {
  message: string
  note: Note
  ok: boolean
}

export interface UsePublicNoteAccessOptions {
  getNote?: NoteStoreApi['getNote']
  getNotesByParentId?: NoteStoreApi['getNotesByParentId']
  updateNote?: NoteStoreApi['updateNote']
}

export function buildPublicNoteUrl(note: Note, username: string, origin: string) {
  if (!note.id || !username || !origin) {
    return ''
  }

  const routeSegment = note.item_type === NOTE_TYPE.FOLDER ? 'f' : 'n'
  return `${origin.replace(/\/$/, '')}/${encodeURIComponent(username)}/${routeSegment}/${note.id}`
}

export function usePublicNoteAccess(options: UsePublicNoteAccessOptions = {}) {
  const noteStore = useNote()
  const getNote = options.getNote || noteStore.getNote
  const getNotesByParentId = options.getNotesByParentId || noteStore.getNotesByParentId
  const updateNote = options.updateNote || noteStore.updateNote

  async function makePublic(note: Note, now: string) {
    note.is_public = true
    note.updated = now
    await updateNote(note.id, note)

    await ensurePublicAncestorFolders(note, now, { getNote, updateNote })
  }

  async function makePrivate(note: Note, now: string) {
    note.is_public = false
    note.updated = now
    await updateNote(note.id, { ...note })

    if (note.parent_id) {
      await clearUnusedPublicAncestorFolders(note.parent_id, now, {
        getNote,
        getNotesByParentId,
        updateNote,
      })
    }
  }

  async function togglePublic(note: Note): Promise<PublicNoteAccessResult> {
    try {
      const now = getTime()
      const isPublic = !note.is_public

      if (isPublic) {
        await makePublic(note, now)
      }
      else {
        await makePrivate(note, now)
      }

      return {
        message: isPublic ? '已设为公开' : '已设为私密',
        note,
        ok: true,
      }
    }
    catch (error) {
      console.error('更新备忘录公开状态异常:', error)

      return {
        message: '操作失败，请重试',
        note,
        ok: false,
      }
    }
  }

  return {
    togglePublic,
  }
}
