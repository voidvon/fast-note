import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

function createLockedNote() {
  return {
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
  }
}

describe('biometric fallback integration (t-fn-039 / tc-fn-031, tc-fn-037)', () => {
  it('keeps the unlock panel visible after biometric cancellation and still allows pin unlock', async () => {
    const { wrapper, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'locked-note',
      isPinLockNote: true,
      notesById: {
        'locked-note': createLockedNote(),
      },
      getLockViewStateImpl: async () => ({
        viewState: 'locked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: true,
        deviceSupportsBiometric: true,
        session: null,
      }),
      tryBiometricUnlockImpl: async () => ({
        ok: false,
        code: 'cancelled',
        message: '已取消生物识别验证，请输入 PIN 解锁',
        failedAttempts: 0,
        cooldownUntil: null,
      }),
      verifyPinImpl: async () => ({
        ok: true,
        code: 'ok',
        message: null,
        failedAttempts: 0,
        cooldownUntil: null,
      }),
    })

    await wrapper.get('[data-testid="note-unlock-panel-biometric"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(mocks.tryBiometricUnlockMock).toHaveBeenCalledWith('locked-note', expect.objectContaining({
      id: 'locked-note',
    }))
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('已取消生物识别验证，请输入 PIN 解锁')
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

  it('shows a distinct unsupported message and keeps pin as the only remaining path', async () => {
    const { wrapper, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'locked-note',
      isPinLockNote: true,
      notesById: {
        'locked-note': createLockedNote(),
      },
      getLockViewStateImpl: async () => ({
        viewState: 'locked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: true,
        deviceSupportsBiometric: true,
        session: null,
      }),
      tryBiometricUnlockImpl: async () => ({
        ok: false,
        code: 'unsupported',
        message: '当前设备不支持生物识别，请输入 PIN 解锁',
        failedAttempts: 0,
        cooldownUntil: null,
      }),
    })

    await wrapper.get('[data-testid="note-unlock-panel-biometric"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(mocks.tryBiometricUnlockMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('当前设备不支持生物识别，请输入 PIN 解锁')
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(false)
  })
})
