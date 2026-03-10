import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note unlock panel integration (t-fn-038 / tc-fn-030)', () => {
  it('shows unlock panel before rendering the editor and unlocks with a valid pin', async () => {
    const { wrapper, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'locked-note',
      isPinLockNote: true,
      lockViewState: 'locked',
      notesById: {
        'locked-note': {
          id: 'locked-note',
          title: '加锁备忘录',
          summary: '测试摘要',
          content: '<p>锁内内容</p>',
          created: '2026-03-10 10:00:00',
          updated: '2026-03-10 10:00:00',
          item_type: 2,
          parent_id: '',
          is_deleted: 0,
          is_locked: 1,
          note_count: 0,
          version: 1,
          files: [],
        },
      },
      verifyPinImpl: async () => ({
        ok: true,
        code: 'ok',
        message: null,
        failedAttempts: 0,
        cooldownUntil: null,
      }),
    })

    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('输入 PIN')
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)

    await wrapper.get('[data-testid="note-unlock-panel-pin"]').setValue('123456')
    await wrapper.get('[data-testid="note-unlock-panel-submit"]').trigger('click')
    await flushPromises()
    await nextTick()
    await nextTick()

    expect(mocks.verifyPinMock).toHaveBeenCalledWith('locked-note', '123456')
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(false)
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(true)
  })
})
