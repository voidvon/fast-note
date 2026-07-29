import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { getDesktopActiveNoteStorageKey } from '@/processes/navigation'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop note route context restore', () => {
  it('restores a folder note in the allnotes context after reopening the note route', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 09:00:00' })
    const notes = [folder, noteA, noteB]

    const firstVisit = await mountHomePageForDesktopRestore({ notes, userId: 'user-a' })
    firstVisit.getFolderPage().vm.$emit('selected', 'note-b')
    await nextTick()
    await nextTick()

    expect(JSON.parse(localStorage.getItem(getDesktopActiveNoteStorageKey('user-a')) || '{}')).toMatchObject({
      folderId: 'allnotes',
      noteId: 'note-b',
    })
    firstVisit.wrapper.unmount()

    const reopenedVisit = await mountHomePageForDesktopRestore({
      clearStorage: false,
      currentPath: '/n/note-b',
      notes,
      userId: 'user-a',
    })

    expect(reopenedVisit.getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(reopenedVisit.getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(reopenedVisit.getNoteDetail().props('noteId')).toBe('note-b')
  })

  it('restores the same note in its parent folder context when opened from that folder', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const note = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 09:00:00' })
    const notes = [folder, note]

    const firstVisit = await mountHomePageForDesktopRestore({
      currentPath: '/f/folder-1',
      notes,
      userId: 'user-a',
    })
    firstVisit.getFolderPage().vm.$emit('selected', 'note-b')
    await nextTick()
    await nextTick()

    expect(JSON.parse(localStorage.getItem(getDesktopActiveNoteStorageKey('user-a')) || '{}')).toMatchObject({
      folderId: 'folder-1',
      noteId: 'note-b',
    })
    firstVisit.wrapper.unmount()

    const reopenedVisit = await mountHomePageForDesktopRestore({
      clearStorage: false,
      currentPath: '/n/note-b',
      notes,
      userId: 'user-a',
    })

    expect(reopenedVisit.getFolderPage().props('currentFolder')).toBe('folder-1')
    expect(reopenedVisit.getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(reopenedVisit.getNoteDetail().props('noteId')).toBe('note-b')
  })

  it('keeps the allnotes context after refreshing a desktop note route when local snapshot matches', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 09:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      currentPath: '/n/note-b',
      notes: [folder, noteA, noteB],
      snapshot: {
        folderId: 'allnotes',
        noteId: 'note-b',
      },
    })

    expect(getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(getNoteDetail().props('noteId')).toBe('note-b')
  })
})
