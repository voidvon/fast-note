import type { FolderTreeNode, Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'
import { normalizeParentIdKey } from './note-rules'

function isActiveFolder(note: Note) {
  return note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1
}

function isActiveNote(note: Note) {
  return note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1
}

export function buildFolderTree(
  notes: Note[],
  parentId = '',
  options: { includeNotes?: boolean } = {},
): FolderTreeNode[] {
  const allFolders = notes.filter(isActiveFolder)
  const allNotes = options.includeNotes ? notes.filter(isActiveNote) : []
  const childFolders = allFolders.filter(
    note => normalizeParentIdKey(note.parent_id) === normalizeParentIdKey(parentId),
  )

  const buildTreeNode = (currentFolder: Note): FolderTreeNode => {
    const subFolders = allFolders
      .filter(note => note.parent_id === currentFolder.id)
      .toSorted((a, b) => new Date(b.updated!).getTime() - new Date(a.updated!).getTime())
      .map(buildTreeNode)

    const childNotes: FolderTreeNode[] = allNotes
      .filter(note => note.parent_id === currentFolder.id)
      .toSorted((a, b) => new Date(b.updated!).getTime() - new Date(a.updated!).getTime())
      .map(note => ({
        originNote: note,
        children: [],
      }))

    return {
      children: [...subFolders, ...childNotes],
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
