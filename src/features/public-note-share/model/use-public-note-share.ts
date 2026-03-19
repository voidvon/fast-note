import type { Note } from '@/shared/types'
import { useNote } from '@/entities/note'
import { getTime } from '@/shared/lib/date'

type NoteStoreApi = ReturnType<typeof useNote>

export interface PublicNoteShareResult {
  color: 'success' | 'danger'
  message: string
  note: Note
  ok: boolean
}

export interface UsePublicNoteShareOptions {
  getNote?: NoteStoreApi['getNote']
  getNotesByParentId?: NoteStoreApi['getNotesByParentId']
  updateNote?: NoteStoreApi['updateNote']
}

export function usePublicNoteShare(options: UsePublicNoteShareOptions = {}) {
  const noteStore = useNote()
  const getNote = options.getNote || noteStore.getNote
  const getNotesByParentId = options.getNotesByParentId || noteStore.getNotesByParentId
  const updateNote = options.updateNote || noteStore.updateNote

  async function getAllChildrenNotes(noteUuid: string): Promise<Note[]> {
    const children = await getNotesByParentId(noteUuid)

    let allChildren: Note[] = [...children]

    for (const child of children) {
      if (child.id) {
        const grandChildren = await getAllChildrenNotes(child.id)
        allChildren = [...allChildren, ...grandChildren]
      }
    }

    return allChildren
  }

  async function getParentNote(parentId: string | null): Promise<Note | null> {
    if (!parentId) {
      return null
    }

    return getNote(parentId)
  }

  async function getAllParentNotes(currentNote: Note): Promise<Note[]> {
    const parents: Note[] = []
    let current = currentNote

    while (current.parent_id) {
      const parent = await getParentNote(current.parent_id)
      if (!parent) {
        break
      }

      parents.push(parent)
      current = parent
    }

    return parents
  }

  async function enableShare(note: Note, now: string) {
    note.is_public = true
    note.updated = now
    await updateNote(note.id, note)

    const parents = await getAllParentNotes(note)
    for (const parent of parents) {
      if (!parent.is_public) {
        await updateNote(parent.id!, {
          ...parent,
          is_public: true,
          updated: now,
        })
      }
    }
  }

  async function disableShare(note: Note, now: string) {
    note.is_public = false
    note.updated = now
    await updateNote(note.id, { ...note })

    const parents = await getAllParentNotes(note)
    for (const parent of parents) {
      if (!parent.is_public) {
        continue
      }

      const allChildren = await getAllChildrenNotes(parent.id!)
      const hasPublicChildren = allChildren.some(child => child.is_public)

      if (!hasPublicChildren) {
        await updateNote(parent.id!, {
          ...parent,
          is_public: false,
          updated: now,
        })
      }
    }
  }

  async function toggleShare(note: Note): Promise<PublicNoteShareResult> {
    try {
      const now = getTime()
      const isPublic = !note.is_public

      if (isPublic) {
        await enableShare(note, now)
      }
      else {
        await disableShare(note, now)
      }

      return {
        color: 'success',
        message: isPublic ? '已启用分享' : '已取消分享',
        note,
        ok: true,
      }
    }
    catch (error) {
      console.error('分享操作异常:', error)

      return {
        color: 'danger',
        message: '操作失败，请重试',
        note,
        ok: false,
      }
    }
  }

  return {
    toggleShare,
  }
}
