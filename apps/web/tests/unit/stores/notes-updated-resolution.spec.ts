import { describe, expect, it } from 'vitest'
import { shouldRefreshNoteUpdated } from '@/entities/note'
import { makeNote } from '../../factories/note.factory'

describe('notes updated resolution', () => {
  it('refreshes updated when note content changes but payload reuses stale updated', () => {
    const existingNote = makeNote({
      updated: '2026-03-06 10:00:00.000Z',
      is_deleted: 0,
    })

    expect(shouldRefreshNoteUpdated(existingNote, {
      ...existingNote,
      is_deleted: 1,
    })).toBe(true)
  })

  it('keeps explicit remote updated when caller provides a different timestamp', () => {
    const existingNote = makeNote({
      updated: '2026-03-06 10:00:00.000Z',
      title: '旧标题',
    })

    expect(shouldRefreshNoteUpdated(existingNote, {
      ...existingNote,
      title: '新标题',
      updated: '2026-03-06 10:05:00.000Z',
    })).toBe(false)
  })

  it('does not refresh updated when payload is unchanged', () => {
    const existingNote = makeNote({
      updated: '2026-03-06 10:00:00.000Z',
    })

    expect(shouldRefreshNoteUpdated(existingNote, {
      id: existingNote.id,
      updated: existingNote.updated,
    })).toBe(false)
  })
})
