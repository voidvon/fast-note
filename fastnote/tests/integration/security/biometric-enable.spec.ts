import { describe, expect, it } from 'vitest'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('biometric quick unlock entry integration (t-fn-039 / tc-fn-029)', () => {
  it('shows the biometric quick unlock action when the device state enables it', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      noteId: 'locked-note',
      isPinLockNote: true,
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
      getLockViewStateImpl: async () => ({
        viewState: 'locked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: true,
        deviceSupportsBiometric: true,
        session: null,
      }),
    })

    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="note-unlock-panel-biometric"]').exists()).toBe(true)
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)
  })
})
