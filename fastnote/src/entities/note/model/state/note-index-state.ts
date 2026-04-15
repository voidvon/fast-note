import type { Note } from '@/shared/types'
import { ref } from 'vue'
import { normalizeParentIdKey } from '../domain/note-rules'

export type NoteIndexOperation = 'add' | 'update' | 'delete'

const notesMap = ref<Map<string, Note>>(new Map())
const parentIdMap = ref<Map<string, Note[]>>(new Map())

function removeNoteFromParentGroups(noteId: string, nextParentId?: string | null) {
  for (const [parentId, noteList] of parentIdMap.value.entries()) {
    const index = noteList.findIndex(note => note.id === noteId)
    if (index === -1 || parentId === normalizeParentIdKey(nextParentId)) {
      continue
    }

    noteList.splice(index, 1)
    if (noteList.length === 0) {
      parentIdMap.value.delete(parentId)
    }
  }
}

function ensureParentGroup(parentId?: string | null) {
  const normalizedParentId = normalizeParentIdKey(parentId)

  if (!parentIdMap.value.has(normalizedParentId)) {
    parentIdMap.value.set(normalizedParentId, [])
  }

  return parentIdMap.value.get(normalizedParentId)!
}

function rebuildNoteIndexes(notes: Note[]) {
  const nextNotesMap = new Map<string, Note>()
  const nextParentIdMap = new Map<string, Note[]>()

  for (const note of notes) {
    if (note.id) {
      nextNotesMap.set(note.id, note)
    }

    const parentId = normalizeParentIdKey(note.parent_id)
    if (!nextParentIdMap.has(parentId)) {
      nextParentIdMap.set(parentId, [])
    }
    nextParentIdMap.get(parentId)!.push(note)
  }

  notesMap.value = nextNotesMap
  parentIdMap.value = nextParentIdMap
}

function updateNoteIndexes(note: Note, operation: NoteIndexOperation) {
  if (!note.id) {
    return
  }

  switch (operation) {
    case 'add':
    case 'update': {
      notesMap.value.set(note.id, note)

      removeNoteFromParentGroups(note.id, note.parent_id)

      const parentNotes = ensureParentGroup(note.parent_id)
      const existingIndex = parentNotes.findIndex(item => item.id === note.id)
      if (existingIndex > -1) {
        parentNotes[existingIndex] = note
      }
      else {
        parentNotes.push(note)
      }
      break
    }

    case 'delete': {
      notesMap.value.delete(note.id)
      removeNoteFromParentGroups(note.id)
      break
    }
  }
}

function getIndexedNote(noteId: string) {
  return notesMap.value.get(noteId) || null
}

function getIndexedNotesByParentId(parentId?: string | null) {
  return parentIdMap.value.get(normalizeParentIdKey(parentId)) || []
}

export function useNoteIndexState() {
  return {
    getIndexedNote,
    getIndexedNotesByParentId,
    rebuildNoteIndexes,
    updateNoteIndexes,
  }
}
