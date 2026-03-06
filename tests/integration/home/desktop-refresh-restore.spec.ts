import { describe, expect, it } from 'vitest'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop refresh restore in allnotes (t-fn-020 / tc-fn-011)', () => {
  it('restores the previously opened note in allnotes after refresh', async () => {
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', updated: '2026-03-06 09:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [noteA, noteB],
      snapshot: {
        folderId: 'allnotes',
        noteId: 'note-a',
      },
    })

    expect(getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-a')
    expect(getNoteDetail().props('noteId')).toBe('note-a')
  })
})
