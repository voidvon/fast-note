import { describe, expect, it } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from '../../integration/home/home-page-test-utils'

describe('home desktop restore fallback (t-fn-020 / tc-fn-013)', () => {
  it('falls back to the first available note when snapshot note no longer exists', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const olderNote = makeNote({ id: 'note-1', parent_id: 'folder-1', updated: '2026-03-06 09:00:00' })
    const newerNote = makeNote({ id: 'note-2', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [folder, olderNote, newerNote],
      snapshot: {
        folderId: 'folder-1',
        noteId: 'missing-note',
      },
    })

    expect(getFolderPage().props('currentFolder')).toBe('folder-1')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-2')
    expect(getNoteDetail().props('noteId')).toBe('note-2')
  })

  it('restores desktop snapshot from the current user scope', async () => {
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 09:00:00' })
    const noteB = makeNote({ id: 'note-b', updated: '2026-03-06 10:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [noteA, noteB],
      userId: 'user-b',
      snapshots: [
        { userId: 'user-a', folderId: 'allnotes', noteId: 'note-a' },
        { userId: 'user-b', folderId: 'allnotes', noteId: 'note-b' },
      ],
    })

    expect(getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(getNoteDetail().props('noteId')).toBe('note-b')
  })
})
