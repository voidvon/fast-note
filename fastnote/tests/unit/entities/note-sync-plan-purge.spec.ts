import { describe, expect, it } from 'vitest'
import { buildNoteSyncOperations } from '@/entities/note'
import { NOTE_TYPE } from '@/shared/types'

function deletedNote(userId?: string) {
  return {
    id: 'deleted-note',
    user_id: userId,
    title: 'deleted',
    summary: '',
    content: '<file-upload url="remote.pdf"></file-upload>',
    created: '2026-01-01 00:00:00.000Z',
    updated: '2026-01-01 00:00:00.000Z',
    item_type: NOTE_TYPE.NOTE,
    parent_id: '',
    is_deleted: 1 as const,
    is_locked: 0 as const,
    note_count: 0,
    version: 1,
    files: ['remote.pdf'],
  }
}

describe('note purge planning', () => {
  it('uses one remote-first purge operation after the 30 day retention period', () => {
    const note = deletedNote('user-a')
    const operations = buildNoteSyncOperations({
      localNotes: [note],
      cloudNotes: [note],
      now: new Date('2026-03-01T00:00:00.000Z').getTime(),
    })

    expect(operations).toEqual([{ note, action: 'purge' }])
  })
})
