export {
  createDesktopActiveNoteSnapshot,
  DESKTOP_ACTIVE_NOTE_STORAGE_PREFIX,
  getDesktopActiveNoteStorageKey,
  getDesktopNotesForFolder,
  isDesktopFolderAvailable,
  isPersistableDesktopNoteId,
  normalizeDesktopActiveNoteSnapshot,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from '@/processes/navigation'
export type {
  DesktopActiveNoteSelection,
  DesktopActiveNoteSnapshot,
} from '@/processes/navigation'
