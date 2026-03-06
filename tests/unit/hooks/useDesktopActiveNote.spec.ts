import { describe, expect, it } from 'vitest'
import {
  DESKTOP_ACTIVE_NOTE_STORAGE_KEY,
  getDesktopNotesForFolder,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from '@/hooks/useDesktopActiveNote'
import { NOTE_TYPE } from '@/types'
import { makeNote } from '../../factories/note.factory'

describe('useDesktopActiveNote (t-fn-019 / tc-fn-013)', () => {
  it('saves, reads and clears desktop snapshot', () => {
    const { saveSnapshot, getSnapshot, clearSnapshot } = useDesktopActiveNote(localStorage)

    const saved = saveSnapshot({
      folderId: 'allnotes',
      noteId: 'note-1',
      parentId: '',
    })

    expect(saved).toBe(true)
    expect(getSnapshot()).toMatchObject({
      folderId: 'allnotes',
      noteId: 'note-1',
      parentId: '',
    })

    clearSnapshot()
    expect(getSnapshot()).toBeNull()
  })

  it('rejects empty and new-note snapshots', () => {
    const { saveSnapshot, getSnapshot } = useDesktopActiveNote(localStorage)

    expect(saveSnapshot({ folderId: 'allnotes', noteId: '', parentId: '' })).toBe(false)
    expect(saveSnapshot({ folderId: 'allnotes', noteId: '0', parentId: '' })).toBe(false)
    expect(getSnapshot()).toBeNull()
  })

  it('clears corrupted snapshot payloads while reading', () => {
    localStorage.setItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY, '{bad-json')

    const { getSnapshot } = useDesktopActiveNote(localStorage)

    expect(getSnapshot()).toBeNull()
    expect(localStorage.getItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY)).toBeNull()
  })

  it('falls back to the first available note in the recorded folder', () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 11:00:00' })

    const selection = resolveDesktopActiveNoteSelection({
      folderId: 'folder-1',
      noteId: 'missing-note',
      parentId: '',
      savedAt: Date.now(),
    }, [folder, noteA, noteB], [])

    expect(selection).toEqual({
      folderId: 'folder-1',
      noteId: 'note-b',
      parentId: '',
    })
  })

  it('returns folder-scoped note lists in updated-desc order', () => {
    const noteA = makeNote({ id: 'note-a', parent_id: '', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: '', updated: '2026-03-06 11:00:00' })
    const deleted = makeNote({ id: 'note-c', is_deleted: 1, updated: '2026-03-06 12:00:00' })

    expect(getDesktopNotesForFolder('allnotes', [noteA, noteB, deleted], []).map(note => note.id)).toEqual(['note-b', 'note-a'])
  })
})
