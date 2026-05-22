import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('desktop special folder route selection', () => {
  it('navigates directly to special folder routes instead of /home', async () => {
    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteInFolder = makeNote({ id: 'note-a', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })
    const unfiledNote = makeNote({ id: 'note-b', updated: '2026-03-06 09:00:00' })

    const { wrapper, getFolderPage } = await mountHomePageForDesktopRestore({
      currentPath: '/f/folder-1',
      notes: [folder, noteInFolder, unfiledNote],
    })

    const noteList = wrapper.findComponent({ name: 'NoteList' })

    noteList.vm.$emit('selected', 'allnotes')
    await nextTick()
    await nextTick()

    expect(window.location.pathname).toBe('/f/allnotes')
    expect(getFolderPage().props('currentFolder')).toBe('allnotes')

    noteList.vm.$emit('selected', 'unfilednotes')
    await nextTick()
    await nextTick()

    expect(window.location.pathname).toBe('/f/unfilednotes')
    expect(getFolderPage().props('currentFolder')).toBe('unfilednotes')
  })
})
