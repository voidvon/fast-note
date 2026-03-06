import type { FolderTreeNode, Note } from '@/types'

export function toSearchResultNodes(notes: Note[]): FolderTreeNode[] {
  return notes.map(note => ({
    originNote: note,
    children: [],
    folderName: note.folderName,
  }))
}
