import { describe, expect, it, vi } from 'vitest'
import { useNoteDetailPrivate } from '@/features/note-detail-private'
import { makeNote } from '../../../factories/note.factory'

describe('useNoteDetailPrivate', () => {
  it('loads an existing private note without triggering repair', async () => {
    const note = makeNote({
      id: 'note-1',
      content: '<p>existing</p>',
    })
    const onLoaded = vi.fn(async () => undefined)
    const onMissing = vi.fn(async () => undefined)
    const repairMissingPrivateNoteIfNeeded = vi.fn(async () => false)

    const flow = useNoteDetailPrivate({
      getNote: vi.fn(async () => note),
      onLoaded,
      onMissing,
      repairMissingPrivateNoteIfNeeded,
    })

    const result = await flow.loadPrivateNote('note-1')

    expect(result).toBe(note)
    expect(onLoaded).toHaveBeenCalledWith(note)
    expect(onMissing).not.toHaveBeenCalled()
    expect(repairMissingPrivateNoteIfNeeded).not.toHaveBeenCalled()
  })

  it('marks missing notes and retries repair through sync flow', async () => {
    const repairedNote = makeNote({
      id: 'missing-note',
      content: '<p>repaired</p>',
    })
    const getNote = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(repairedNote)
    const onLoaded = vi.fn(async () => undefined)
    const onMissing = vi.fn(async () => undefined)
    const repairMissingPrivateNoteIfNeeded = vi.fn(async () => true)

    const flow = useNoteDetailPrivate({
      getNote,
      onLoaded,
      onMissing,
      repairMissingPrivateNoteIfNeeded,
    })

    const result = await flow.loadPrivateNote('missing-note')
    await Promise.resolve()

    expect(result).toBeNull()
    expect(onMissing).toHaveBeenCalledTimes(1)
    expect(repairMissingPrivateNoteIfNeeded).toHaveBeenCalledWith('missing-note')
    expect(onLoaded).toHaveBeenCalledWith(repairedNote)
  })

  it('deduplicates repeated repair attempts for the same note id', async () => {
    let resolveRepair: ((value: boolean) => void) | null = null
    const repairPromise = new Promise<boolean>((resolve) => {
      resolveRepair = resolve
    })
    const repairMissingPrivateNoteIfNeeded = vi.fn(() => repairPromise)

    const flow = useNoteDetailPrivate({
      getNote: vi.fn(async () => null),
      onLoaded: vi.fn(async () => undefined),
      onMissing: vi.fn(async () => undefined),
      repairMissingPrivateNoteIfNeeded,
    })

    const first = flow.repairMissingPrivateNote('missing-note')
    const second = flow.repairMissingPrivateNote('missing-note')

    expect(repairMissingPrivateNoteIfNeeded).toHaveBeenCalledTimes(1)
    expect(flow.repairingNoteId.value).toBe('missing-note')

    resolveRepair?.(false)
    await first
    await second
  })
})
