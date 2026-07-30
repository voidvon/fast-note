import type { Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'

export interface PublicAncestorAccess {
  getNote: (id: string) => Note | null | undefined
  updateNote: (id: string, updates: Partial<Note>) => void | Promise<void>
}

export interface PublicTreeAccess extends PublicAncestorAccess {
  getNotesByParentId: (parentId: string) => Note[] | Promise<Note[]>
}

export async function ensurePublicAncestorFolders(
  note: Note,
  updated: string,
  access: PublicAncestorAccess,
) {
  let currentParentId = note.parent_id

  while (currentParentId) {
    const parent = access.getNote(currentParentId)
    if (!parent || parent.item_type !== NOTE_TYPE.FOLDER) {
      break
    }

    if (!parent.is_public) {
      await access.updateNote(parent.id, {
        is_public: true,
        updated,
      })
    }

    currentParentId = parent.parent_id
  }
}

export async function clearUnusedPublicAncestorFolders(
  parentId: string,
  updated: string,
  access: PublicTreeAccess,
) {
  let currentParentId = parentId

  while (currentParentId) {
    const parent = access.getNote(currentParentId)
    if (!parent || parent.item_type !== NOTE_TYPE.FOLDER) {
      break
    }

    const children = await access.getNotesByParentId(currentParentId)
    const hasPublicChildren = children.some(child => child.is_deleted !== 1 && child.is_public)
    if (hasPublicChildren) {
      break
    }

    if (parent.is_public) {
      await access.updateNote(parent.id, {
        is_public: false,
        updated,
      })
    }

    currentParentId = parent.parent_id
  }
}
