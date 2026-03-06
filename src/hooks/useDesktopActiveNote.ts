import type { Note } from '@/types'
import { NOTE_TYPE } from '@/types'

export const DESKTOP_ACTIVE_NOTE_STORAGE_KEY = 'flashnote_desktop_active_note_v1'

export interface DesktopActiveNoteSelection {
  folderId: string
  noteId: string
  parentId: string
}

export interface DesktopActiveNoteSnapshot extends DesktopActiveNoteSelection {
  savedAt: number
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

export function isPersistableDesktopNoteId(noteId: string) {
  return !!noteId && noteId !== '0'
}

export function createDesktopActiveNoteSnapshot(
  selection: DesktopActiveNoteSelection,
): DesktopActiveNoteSnapshot | null {
  if (!isNonEmptyString(selection.folderId) || !isPersistableDesktopNoteId(selection.noteId)) {
    return null
  }

  return {
    folderId: selection.folderId,
    noteId: selection.noteId,
    parentId: selection.parentId || '',
    savedAt: Date.now(),
  }
}

export function normalizeDesktopActiveNoteSnapshot(
  value: unknown,
): DesktopActiveNoteSnapshot | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as Partial<DesktopActiveNoteSnapshot>
  if (!isNonEmptyString(candidate.folderId) || !isPersistableDesktopNoteId(candidate.noteId || '')) {
    return null
  }

  return {
    folderId: candidate.folderId,
    noteId: candidate.noteId || '',
    parentId: typeof candidate.parentId === 'string' ? candidate.parentId : '',
    savedAt: typeof candidate.savedAt === 'number' && Number.isFinite(candidate.savedAt)
      ? candidate.savedAt
      : Date.now(),
  }
}

function sortNotesByUpdatedDesc(notes: Note[]) {
  return notes
    .slice()
    .sort((left, right) => new Date(right.updated).getTime() - new Date(left.updated).getTime())
}

export function getDesktopNotesForFolder(
  folderId: string,
  notes: Note[],
  deletedNotes: Note[],
) {
  switch (folderId) {
    case 'allnotes':
      return sortNotesByUpdatedDesc(
        notes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted === 0),
      )
    case 'unfilednotes':
      return sortNotesByUpdatedDesc(
        notes.filter(note => note.item_type === NOTE_TYPE.NOTE && !note.parent_id && note.is_deleted === 0),
      )
    case 'deleted':
      return sortNotesByUpdatedDesc(deletedNotes)
    default:
      return sortNotesByUpdatedDesc(
        notes.filter(note => note.item_type === NOTE_TYPE.NOTE && note.parent_id === folderId && note.is_deleted === 0),
      )
  }
}

export function isDesktopFolderAvailable(
  folderId: string,
  notes: Note[],
  deletedNotes: Note[],
) {
  if (folderId === 'allnotes' || folderId === 'unfilednotes') {
    return true
  }

  if (folderId === 'deleted') {
    return deletedNotes.length > 0
  }

  return notes.some(note =>
    note.id === folderId
    && note.item_type === NOTE_TYPE.FOLDER
    && note.is_deleted === 0,
  )
}

export function resolveDesktopActiveNoteSelection(
  snapshot: DesktopActiveNoteSnapshot | null,
  notes: Note[],
  deletedNotes: Note[],
): DesktopActiveNoteSelection | null {
  if (!snapshot) {
    return null
  }

  if (!isDesktopFolderAvailable(snapshot.folderId, notes, deletedNotes)) {
    return null
  }

  const folderNotes = getDesktopNotesForFolder(snapshot.folderId, notes, deletedNotes)
  const matchedNote = folderNotes.find(note => note.id === snapshot.noteId)

  if (matchedNote) {
    return {
      folderId: snapshot.folderId,
      noteId: matchedNote.id,
      parentId: snapshot.parentId || '',
    }
  }

  return {
    folderId: snapshot.folderId,
    noteId: folderNotes[0]?.id || '',
    parentId: '',
  }
}

export function useDesktopActiveNote(storage: Storage = localStorage) {
  function getSnapshot() {
    try {
      const rawValue = storage.getItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY)
      if (!rawValue) {
        return null
      }

      const parsedValue = JSON.parse(rawValue)
      const snapshot = normalizeDesktopActiveNoteSnapshot(parsedValue)
      if (!snapshot) {
        storage.removeItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY)
      }

      return snapshot
    }
    catch {
      storage.removeItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY)
      return null
    }
  }

  function saveSnapshot(selection: DesktopActiveNoteSelection) {
    const snapshot = createDesktopActiveNoteSnapshot(selection)
    if (!snapshot) {
      return false
    }

    try {
      storage.setItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY, JSON.stringify(snapshot))
      return true
    }
    catch {
      return false
    }
  }

  function clearSnapshot() {
    try {
      storage.removeItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY)
    }
    catch {
    }
  }

  return {
    getSnapshot,
    saveSnapshot,
    clearSnapshot,
  }
}
