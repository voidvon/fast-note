import type { FolderTreeNode, Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'
import { normalizeParentIdKey } from './note-rules'

function isActiveFolder(note: Note) {
  return note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1
}

function isActiveNote(note: Note) {
  return note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1
}

export function buildFolderTree(notes: Note[], parentId = ''): FolderTreeNode[] {
  const allFolders = notes.filter(isActiveFolder)
  const childFolders = allFolders.filter(note => normalizeParentIdKey(note.parent_id) === normalizeParentIdKey(parentId))

  const buildTreeNode = (currentFolder: Note): FolderTreeNode => {
    const children = allFolders
      .filter(note => note.parent_id === currentFolder.id)
      .map(buildTreeNode)

    return {
      children,
      originNote: currentFolder,
    }
  }

  return childFolders.map(buildTreeNode)
}

export function countNotesWithinChildren(notes: Note[]) {
  let count = 0

  for (const note of notes) {
    if (note.is_deleted === 1)
      continue

    if (note.item_type === NOTE_TYPE.NOTE) {
      count++
      continue
    }

    if (note.item_type === NOTE_TYPE.FOLDER) {
      count += note.note_count
    }
  }

  return count
}

export function countUnfiledNotes(notes: Note[]) {
  return notes.filter(note => isActiveNote(note) && !note.parent_id).length
}

export function createsCircularFolderMove(notes: Note[], noteId: string, targetFolderId: string) {
  if (!noteId || !targetFolderId || targetFolderId === 'root') {
    return false
  }

  let currentParentId: string | undefined = targetFolderId

  while (currentParentId) {
    if (currentParentId === noteId) {
      return true
    }

    const currentFolder = notes.find(note => note.id === currentParentId)
    currentParentId = currentFolder?.parent_id
  }

  return false
}
