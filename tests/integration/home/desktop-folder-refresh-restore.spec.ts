import { describe, expect, it } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop refresh restore in folder (t-fn-020 / tc-fn-012)', () => {
  it('restores the previously opened note inside a folder after refresh', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', parent_id: 'folder-1', updated: '2026-03-06 08:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [folder, noteA, noteB],
      snapshot: {
        folderId: 'folder-1',
        noteId: 'note-b',
      },
    })

    expect(getFolderPage().props('currentFolder')).toBe('folder-1')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(getNoteDetail().props('noteId')).toBe('note-b')
  })
})
