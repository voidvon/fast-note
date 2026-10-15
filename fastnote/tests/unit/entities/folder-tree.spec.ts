import type { Note } from '@/shared/types'
import { describe, expect, it } from 'vitest'
import { buildFolderTree } from '@/entities/note/model/domain/folder-tree'
import { NOTE_TYPE } from '@/shared/types'

function createFolder(id: string, parentId = '', title = 'Folder', updated = '2026-01-01T00:00:00Z'): Note {
  return {
    id,
    title,
    item_type: NOTE_TYPE.FOLDER,
    parent_id: parentId,
    content: '',
    created: '2026-01-01T00:00:00Z',
    updated,
    is_deleted: 0,
    is_locked: 0,
    summary: '',
    note_count: 0,
    version: 1,
  }
}

function createNote(id: string, parentId = '', title = 'Note', updated = '2026-01-01T00:00:00Z'): Note {
  return {
    id,
    title,
    item_type: NOTE_TYPE.NOTE,
    parent_id: parentId,
    content: '',
    created: '2026-01-01T00:00:00Z',
    updated,
    is_deleted: 0,
    is_locked: 0,
    summary: '',
    note_count: 0,
    version: 1,
  }
}

describe('buildFolderTree', () => {
  it('excludes notes by default', () => {
    const notes: Note[] = [
      createFolder('f1', '', 'Root Folder'),
      createFolder('f2', 'f1', 'Child Folder'),
      createNote('n1', 'f1', 'Note in root folder'),
      createNote('n2', 'f2', 'Note in child folder'),
    ]

    const tree = buildFolderTree(notes, 'f1')
    expect(tree).toHaveLength(1)
    expect(tree[0].originNote.id).toBe('f2')
    expect(tree[0].children).toHaveLength(0)
  })

  it('includes notes when includeNotes is true, sorted by updated date', () => {
    const notes: Note[] = [
      createFolder('f1', '', 'Root Folder'),
      createFolder('f2', 'f1', 'Child Folder'),
      createNote('n1', 'f2', 'Older Note', '2026-01-01T10:00:00Z'),
      createNote('n2', 'f2', 'Newer Note', '2026-01-02T10:00:00Z'),
      createNote('deleted_note', 'f2', 'Deleted Note', '2026-01-03T10:00:00Z'),
    ]
    notes[4].is_deleted = 1

    const tree = buildFolderTree(notes, 'f1', { includeNotes: true })
    expect(tree).toHaveLength(1)
    expect(tree[0].originNote.id).toBe('f2')
    // Children of f2 should contain only active notes, sorted newer first
    expect(tree[0].children).toHaveLength(2)
    expect(tree[0].children?.[0].originNote.id).toBe('n2')
    expect(tree[0].children?.[1].originNote.id).toBe('n1')
  })
})
