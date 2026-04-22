import { describe, expect, it } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop note route context restore', () => {
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
