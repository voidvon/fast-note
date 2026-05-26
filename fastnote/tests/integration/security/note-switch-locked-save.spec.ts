import type { Note } from '@/shared/types'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note switch save regression', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not clear the previous note when switching to a locked note after blur', async () => {
    const notesById: Record<string, Note> = {
      'note-1': {
        id: 'note-1',
        title: '普通备忘录',
        summary: '原摘要',
        content: '<p>原内容</p>',
        created: '2026-03-11 10:00:00',
        updated: '2026-03-11 10:00:00',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      },
      'locked-note': {
        id: 'locked-note',
        title: '已锁定备忘录',
        summary: '锁定摘要',
        content: '<p>锁定内容</p>',
        created: '2026-03-11 10:00:00',
        updated: '2026-03-11 10:00:00',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 1,
        note_count: 0,
        version: 1,
        files: [],
      },
    }

    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      notesById,
      getLockViewStateImpl: async (noteId: string) => ({
        viewState: noteId === 'locked-note' ? 'locked' : 'unlocked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: false,
        deviceSupportsBiometric: false,
        session: null,
      }),
    })

    let currentContent = '<p>已编辑内容</p>'
    editorApi.getContent.mockImplementation(() => currentContent)
    editorApi.setContent.mockImplementation((content: string) => {
      currentContent = content
    })
    editorApi.getTitle.mockImplementation(() => ({
      title: '普通备忘录',
      summary: '已编辑摘要',
    }))

    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    await wrapper.setProps({
      noteId: 'locked-note',
    })
    await flushPromises()
    await nextTick()

    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      content: '<p>已编辑内容</p>',
      summary: '已编辑摘要',
    }))
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
  })

  it('does not save empty content after locking the current note', async () => {
    const notesById: Record<string, Note> = {
      'note-1': {
        id: 'note-1',
        title: '普通备忘录',
        summary: '原摘要',
        content: '<p>原内容</p>',
        created: '2026-03-11 10:00:00',
        updated: '2026-03-11 10:00:00',
        item_type: 2,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
        files: [],
      },
    }
    const lockedNote = {
      ...notesById['note-1'],
      is_locked: 1,
    }

    const { wrapper, editorApi, mocks } = await mountNoteDetailForSaveTest({
      noteId: 'note-1',
      isDesktop: true,
      notesById,
      getLockViewStateImpl: async (_noteId: string, note) => ({
        viewState: note?.is_locked === 1 ? 'locked' : 'unlocked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled: false,
        deviceSupportsBiometric: false,
        session: null,
      }),
    })

    let currentContent = '<p>原内容</p>'
    editorApi.getContent.mockImplementation(() => currentContent)
    editorApi.setContent.mockImplementation((content: string) => {
      currentContent = content
    })
    editorApi.getTitle.mockImplementation(() => ({
      title: '普通备忘录',
      summary: '已编辑摘要',
    }))

    currentContent = '<p>已编辑内容</p>'

    wrapper.findComponent({ name: 'YYEditor' }).vm.$emit('blur')
    notesById['note-1'] = lockedNote
    wrapper.findComponent({ name: 'NoteMore' }).vm.$emit('note-lock-updated', lockedNote)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      content: '<p>已编辑内容</p>',
      summary: '已编辑摘要',
    }))

    vi.advanceTimersByTime(800)
    await flushPromises()
    await nextTick()

    expect(mocks.updateNoteMock).toHaveBeenCalledTimes(1)
    expect(mocks.updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      content: '<p>已编辑内容</p>',
      summary: '已编辑摘要',
    }))
    expect(wrapper.find('[data-testid="note-unlock-panel"]').exists()).toBe(true)
  })
})
