import { describe, expect, it, vi } from 'vitest'
import { useNoteDetailEntry } from '@/features/note-detail-entry'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteDetailEntry', () => {
  it('routes public detail loading through the public note reader', async () => {
    const publicNote = makeNote({
      id: 'public-note',
      content: '<p>public</p>',
    })
    const applyPublicNote = vi.fn(async () => undefined)
    const getPublicNote = vi.fn(() => publicNote)
    const flow = useNoteDetailEntry({
      applyPublicNote,
      clearSelection: vi.fn(async () => undefined),
      createDraftId: vi.fn(() => 'draft-1'),
      enterNewDraft: vi.fn(async () => undefined),
      getPublicNote,
      loadPrivateNote: vi.fn(async () => undefined),
      resetLockView: vi.fn(async () => undefined),
      resetMissingPrivateNote: vi.fn(async () => undefined),
    })

    await flow.openExisting('public-note', true)

    expect(getPublicNote).toHaveBeenCalledWith('public-note')
    expect(applyPublicNote).toHaveBeenCalledWith(publicNote)
  })

  it('prepares a new draft by resetting state and delegating draft setup', async () => {
    const resetMissingPrivateNote = vi.fn(async () => undefined)
    const resetLockView = vi.fn(async () => undefined)
    const enterNewDraft = vi.fn(async () => undefined)
    const flow = useNoteDetailEntry({
      applyPublicNote: vi.fn(async () => undefined),
      clearSelection: vi.fn(async () => undefined),
      createDraftId: vi.fn(() => 'draft-2'),
      enterNewDraft,
      getPublicNote: vi.fn(),
      loadPrivateNote: vi.fn(async () => undefined),
      resetLockView,
      resetMissingPrivateNote,
    })

    const draftId = await flow.openNewDraft()

    expect(draftId).toBe('draft-2')
    expect(resetMissingPrivateNote).toHaveBeenCalledTimes(1)
    expect(resetLockView).toHaveBeenCalledTimes(1)
    expect(enterNewDraft).toHaveBeenCalledWith('draft-2')
  })

  it('clears current detail selection by resetting guards and editor state', async () => {
    const clearSelection = vi.fn(async () => undefined)
    const flow = useNoteDetailEntry({
      applyPublicNote: vi.fn(async () => undefined),
      clearSelection,
      createDraftId: vi.fn(() => 'draft-3'),
      enterNewDraft: vi.fn(async () => undefined),
      getPublicNote: vi.fn(),
      loadPrivateNote: vi.fn(async () => undefined),
      resetLockView: vi.fn(async () => undefined),
      resetMissingPrivateNote: vi.fn(async () => undefined),
    })

    await flow.clearDetailSelection()

    expect(clearSelection).toHaveBeenCalledTimes(1)
  })
})
