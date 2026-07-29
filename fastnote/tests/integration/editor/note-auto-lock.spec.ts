import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail auto lock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-29T04:00:00.000Z'))
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('saves the latest editor content before relocking an idle protected note', async () => {
    const noteId = 'locked-note'
    const { editorApi, mocks, wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: true,
      isPinLockNote: true,
      lockViewState: 'unlocked',
      noteId,
      notesById: {
        [noteId]: {
          id: noteId,
          title: '已锁定备忘录',
          summary: '锁定摘要',
          content: '<p>锁定前内容</p>',
          created: '2026-07-29 12:00:00',
          updated: '2026-07-29 12:00:00',
          item_type: 2,
          parent_id: '',
          is_deleted: 0,
          is_locked: 1,
          note_count: 0,
          version: 1,
          files: [],
        },
      },
    })
    editorApi.getContent.mockReturnValue('<p>自动锁定前的最新内容</p>')

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 20)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledWith(noteId, expect.objectContaining({
      content: '<p>自动锁定前的最新内容</p>',
    }))
    expect(mocks.manualSyncMock).toHaveBeenCalledOnce()
    expect(mocks.relockMock).toHaveBeenCalledWith(noteId)
    expect(mocks.updateNoteMock.mock.invocationCallOrder[0]).toBeLessThan(mocks.relockMock.mock.invocationCallOrder[0]!)
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)
    wrapper.unmount()
  })
})
