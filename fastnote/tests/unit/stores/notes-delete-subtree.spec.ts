import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'

describe('t-FN-002 / TC-FN-002 notes subtree delete', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('deletes a folder and marks all descendants as is_deleted = 1', async () => {
    const { useNote } = await import('@/entities/note')
    type NoteStore = ReturnType<typeof useNote>
    let noteStore: NoteStore | null = null

    const wrapper = mount(defineComponent({
      setup() {
        noteStore = useNote()
        return () => null
      },
    }))

    const { addNote, getNote, setNoteDeletedState } = noteStore!

    addNote(makeNote({
      id: 'folder-root',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
    }))
    addNote(makeNote({
      id: 'folder-child',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: 'folder-root',
    }))
    addNote(makeNote({
      id: 'note-child',
      parent_id: 'folder-root',
    }))
    addNote(makeNote({
      id: 'note-grandchild',
      parent_id: 'folder-child',
    }))
    addNote(makeNote({
      id: 'note-sibling',
      parent_id: '',
    }))

    await setNoteDeletedState(getNote('folder-root')!, 1)

    expect(getNote('folder-root')?.is_deleted).toBe(1)
    expect(getNote('folder-child')?.is_deleted).toBe(1)
    expect(getNote('note-child')?.is_deleted).toBe(1)
    expect(getNote('note-grandchild')?.is_deleted).toBe(1)
    expect(getNote('note-sibling')?.is_deleted).toBe(0)

    wrapper.unmount()
  })

  it('keeps recycle bin query results consistent after subtree delete and descendant restore', async () => {
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-03-19 10:00:00.000Z',
    }))

    const { useNote } = await import('@/entities/note')
    type NoteStore = ReturnType<typeof useNote>
    let noteStore: NoteStore | null = null

    const wrapper = mount(defineComponent({
      setup() {
        noteStore = useNote()
        return () => null
      },
    }))

    const { addNote, getDeletedNotes, getNote, setNoteDeletedState } = noteStore!

    addNote(makeNote({
      id: 'folder-root',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
    }))
    addNote(makeNote({
      id: 'folder-child',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: 'folder-root',
    }))
    addNote(makeNote({
      id: 'note-active',
      parent_id: 'folder-child',
    }))
    addNote(makeNote({
      id: 'note-older-deleted',
      parent_id: 'folder-child',
      is_deleted: 1,
      updated: '2026-03-01 09:00:00.000Z',
    }))

    await setNoteDeletedState(getNote('folder-root')!, 1)

    expect((await getDeletedNotes()).map(note => note.id).sort()).toEqual([
      'folder-child',
      'folder-root',
      'note-active',
      'note-older-deleted',
    ])

    await setNoteDeletedState(getNote('note-active')!, 0)

    expect(getNote('folder-root')?.is_deleted).toBe(0)
    expect(getNote('folder-child')?.is_deleted).toBe(0)
    expect(getNote('note-active')?.is_deleted).toBe(0)
    expect(getNote('note-older-deleted')?.is_deleted).toBe(1)
    expect((await getDeletedNotes()).map(note => note.id)).toEqual(['note-older-deleted'])

    wrapper.unmount()
  })
})
