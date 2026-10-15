import { describe, expect, it } from 'vitest'
import {
  getDesktopActiveNoteStorageKey,
  getDesktopFolderRoutePath,
  getDesktopNoteRoutePath,
  getDesktopNotesForFolder,
  isFolderDescendantOf,
  isNoteInFolderOrDescendants,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from '@/processes/navigation'
import { NOTE_TYPE } from '@/shared/types'
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

  it('builds nested desktop folder routes from the folder parent chain', () => {
    const folderA = makeNote({ id: 'folder-a', item_type: NOTE_TYPE.FOLDER, parent_id: '' })
    const folderB = makeNote({ id: 'folder-b', item_type: NOTE_TYPE.FOLDER, parent_id: 'folder-a' })
    const folderC = makeNote({ id: 'folder-c', item_type: NOTE_TYPE.FOLDER, parent_id: 'folder-b' })

    expect(getDesktopFolderRoutePath('allnotes', [folderA, folderB, folderC])).toBe('/f/allnotes')
    expect(getDesktopFolderRoutePath('unfilednotes', [folderA, folderB, folderC])).toBe('/f/unfilednotes')
    expect(getDesktopFolderRoutePath('deleted', [folderA, folderB, folderC])).toBe('/deleted')
    expect(getDesktopFolderRoutePath('folder-c', [folderA, folderB, folderC])).toBe('/f/folder-a/folder-b/folder-c')
  })

  it('builds desktop note routes for drafts and existing notes', () => {
    expect(getDesktopNoteRoutePath('note-1')).toBe('/n/note-1')
    expect(getDesktopNoteRoutePath('0')).toBe('/n/0')
    expect(getDesktopNoteRoutePath('0', 'folder-1')).toBe('/n/0?parent_id=folder-1')
  })

  it('correctly detects folder descendants and notes in subfolders', () => {
    const rootFolder = makeNote({ id: 'root', item_type: NOTE_TYPE.FOLDER, parent_id: '' })
    const subFolder = makeNote({ id: 'sub', item_type: NOTE_TYPE.FOLDER, parent_id: 'root' })
    const grandFolder = makeNote({ id: 'grand', item_type: NOTE_TYPE.FOLDER, parent_id: 'sub' })
    const noteInGrand = makeNote({ id: 'note-g', parent_id: 'grand', item_type: NOTE_TYPE.NOTE })

    const all = [rootFolder, subFolder, grandFolder, noteInGrand]

    expect(isFolderDescendantOf('grand', 'root', all)).toBe(true)
    expect(isFolderDescendantOf('grand', 'sub', all)).toBe(true)
    expect(isFolderDescendantOf('root', 'grand', all)).toBe(false)

    expect(isNoteInFolderOrDescendants('note-g', 'root', all)).toBe(true)
    expect(isNoteInFolderOrDescendants('note-g', 'sub', all)).toBe(true)
    expect(isNoteInFolderOrDescendants('note-g', 'grand', all)).toBe(true)
  })

  it('preserves snapshot selection when note belongs to a subfolder of current folder', () => {
    const rootFolder = makeNote({ id: 'root', item_type: NOTE_TYPE.FOLDER, parent_id: '' })
    const subFolder = makeNote({ id: 'sub', item_type: NOTE_TYPE.FOLDER, parent_id: 'root' })
    const noteInSub = makeNote({ id: 'note-s', parent_id: 'sub', item_type: NOTE_TYPE.NOTE })

    const selection = resolveDesktopActiveNoteSelection({
      folderId: 'root',
      noteId: 'note-s',
      parentId: '',
      savedAt: Date.now(),
    }, [rootFolder, subFolder, noteInSub], [])

    expect(selection).toEqual({
      folderId: 'root',
      noteId: 'note-s',
      parentId: '',
    })
  })
})
