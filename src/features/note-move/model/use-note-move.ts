import type { FolderTreeNode } from '@/entities/note'
import { NOTE_TYPE, useNoteRepository } from '@/entities/note'
import { getTime } from '@/shared/lib/date'

function createRootFolderNode(): FolderTreeNode {
  const now = getTime()

  return {
    originNote: {
      id: 'root',
      title: '根目录',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      version: 1,
      updated: now,
      summary: '',
      created: now,
      content: '',
      note_count: 0,
    },
    children: [],
  }
}

export function useNoteMove() {
  const { getFolderTreeByParentId, getNote, getNoteCountByParentId, updateNote } = useNoteRepository()

  function findFoldersWithChildren(notes: FolderTreeNode[]): string[] {
    const ids: string[] = []

    function traverse(node: FolderTreeNode) {
      if (node.children?.length) {
        ids.push(node.originNote.id)
        node.children.forEach(traverse)
      }
    }

    notes.forEach(traverse)
    return ids
  }

  function createMoveTree() {
    const rootNode = createRootFolderNode()
    const validChildren = getFolderTreeByParentId().filter(node => node?.originNote)
    rootNode.children = validChildren

    return [rootNode]
  }

  async function refreshFolderBranchCounts(folderId: string) {
    let currentFolderId: string | null = folderId

    while (currentFolderId) {
      const folder = getNote(currentFolderId)
      if (!folder || folder.item_type !== NOTE_TYPE.FOLDER) {
        break
      }

      const noteCount = await getNoteCountByParentId(currentFolderId)
      await updateNote(currentFolderId, {
        note_count: noteCount,
        updated: getTime(),
      })

      currentFolderId = folder.parent_id || null
    }
  }

  async function moveNote(noteId: string, targetFolderId: string) {
    const currentNote = getNote(noteId)
    if (!currentNote) {
      return {
        moved: false,
        note: null,
      }
    }

    const oldParentId = currentNote.parent_id || ''
    const newParentId = targetFolderId === 'root' ? '' : targetFolderId

    if (oldParentId === newParentId) {
      return {
        moved: false,
        note: currentNote,
      }
    }

    const updatedAt = getTime()
    await updateNote(noteId, {
      parent_id: newParentId,
      updated: updatedAt,
    })

    if (oldParentId) {
      await refreshFolderBranchCounts(oldParentId)
    }

    if (newParentId) {
      await refreshFolderBranchCounts(newParentId)
    }

    return {
      moved: true,
      note: getNote(noteId),
    }
  }

  return {
    createMoveTree,
    findFoldersWithChildren,
    getNote,
    moveNote,
  }
}
