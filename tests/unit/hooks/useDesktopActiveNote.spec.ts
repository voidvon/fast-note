import { describe, expect, it } from 'vitest'
import {
  getDesktopActiveNoteStorageKey,
  getDesktopNotesForFolder,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from '@/processes/navigation'
import { NOTE_TYPE } from '@/types'
import { makeNote } from '../../factories/note.factory'

describe('useDesktopActiveNote (t-fn-019 / tc-fn-013)', () => {
  it('saves, reads and clears desktop snapshot', () => {
    const { saveSnapshot, getSnapshot, clearSnapshot } = useDesktopActiveNote(localStorage)

    const saved = saveSnapshot({
      folderId: 'allnotes',
      noteId: 'note-1',
      parentId: '',
    }, 'user-a')

    expect(saved).toBe(true)
    expect(getSnapshot('user-a')).toMatchObject({
      folderId: 'allnotes',
      noteId: 'note-1',
      parentId: '',
    })

    clearSnapshot('user-a')
    expect(getSnapshot('user-a')).toBeNull()
  })

  it('rejects empty and new-note snapshots', () => {
    const { saveSnapshot, getSnapshot } = useDesktopActiveNote(localStorage)

    expect(saveSnapshot({ folderId: 'allnotes', noteId: '', parentId: '' }, 'user-a')).toBe(false)
    expect(saveSnapshot({ folderId: 'allnotes', noteId: '0', parentId: '' }, 'user-a')).toBe(false)
    expect(getSnapshot('user-a')).toBeNull()
  })

  it('clears corrupted snapshot payloads while reading', () => {
    localStorage.setItem(getDesktopActiveNoteStorageKey('user-a'), '{bad-json')

    const { getSnapshot } = useDesktopActiveNote(localStorage)

    expect(getSnapshot('user-a')).toBeNull()
    expect(localStorage.getItem(getDesktopActiveNoteStorageKey('user-a'))).toBeNull()
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
