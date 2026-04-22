import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop allnotes note selection', () => {
  it('keeps the allnotes context when opening a note from the aggregate list', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 10:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 09:00:00' })

    const { getFolderPage, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [folder, noteA, noteB],
    })

    expect(getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-a')

    getFolderPage().vm.$emit('selected', 'note-b')
    await nextTick()
    await nextTick()

    expect(getFolderPage().props('currentFolder')).toBe('allnotes')
    expect(getFolderPage().props('selectedNoteId')).toBe('note-b')
    expect(getNoteDetail().props('noteId')).toBe('note-b')
  })
})
