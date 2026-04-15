import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNoteDetailLeave } from '@/features/note-detail-leave'

describe('useNoteDetailLeave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves previous desktop selection before switching to another detail target', async () => {
    const onSave = vi.fn(async () => undefined)
    const flow = useNoteDetailLeave({
      getDraftId: () => 'draft-1',
      getEffectiveUuid: () => 'note-2',
      getNotesSync: () => null,
      isDesktop: () => true,
      isRouteDraftCreated: () => false,
      onSave,
    })

    const transition = await flow.handleRouteTransition('note-1', 'note-2')

    expect(transition).toMatchObject({
      previousEffectiveId: 'note-1',
      previousWasNewNote: false,
      shouldSavePreviousDesktopSelection: true,
    })
    expect(onSave).toHaveBeenCalledWith(true, null, {
      noteId: 'note-1',
      wasNewNote: false,
    })
  })

  it('retains mobile detail content during leave transitions without saving desktop selection', () => {
    const flow = useNoteDetailLeave({
      getDraftId: () => 'draft-2',
      getEffectiveUuid: () => null,
      getNotesSync: () => null,
      isDesktop: () => false,
      isRouteDraftCreated: () => false,
      onSave: vi.fn(async () => undefined),
    })

    const transition = flow.analyzeRouteTransition('note-1', '')

    expect(transition).toMatchObject({
      isMobileLeavingDetailPage: true,
      previousEffectiveId: 'note-1',
      shouldSavePreviousDesktopSelection: false,
    })
  })

  it('debounces blur save and flushes manual sync on leave', async () => {
    const onSave = vi.fn(async () => undefined)
    const manualSync = vi.fn(async () => undefined)
    const flow = useNoteDetailLeave({
      getDraftId: () => 'draft-3',
      getEffectiveUuid: () => 'note-3',
      getNotesSync: () => ({
        manualSync,
      }),
      isDesktop: () => false,
      isRouteDraftCreated: () => false,
      onSave,
    })

    flow.debouncedSave()
    vi.advanceTimersByTime(800)

    expect(onSave).toHaveBeenCalledWith(false)

    onSave.mockClear()
    flow.triggerLeavePageLocalFlush('pagehide')
    expect(onSave).toHaveBeenCalledWith(true, 'pagehide')

    await flow.flushNotesToLocal('view-leave')
    expect(manualSync).toHaveBeenCalledTimes(1)
  })
})
