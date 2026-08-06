import { describe, expect, it } from 'vitest'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail header navigation', () => {
  it('hides the back button in the desktop detail pane', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: true,
    })

    expect(wrapper.find('[data-testid="note-detail-back-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="note-more-trigger"]').exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'NoteMore' }).props('presentation')).toBe('popover')
  })

  it('keeps the more button disabled and hides the editor toolbar in the desktop empty state', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: true,
      noteId: '',
    })

    const moreTrigger = wrapper.get('[data-testid="note-more-trigger"]')

    expect(moreTrigger.classes()).toContain('disabled')
    expect(moreTrigger.attributes('aria-disabled')).toBe('true')
    expect(moreTrigger.attributes('tabindex')).toBe('-1')
    expect(wrapper.find('.NoteEditorToolbar-stub').exists()).toBe(false)
    expect(wrapper.find('.NoteMore-stub').exists()).toBe(false)
  })

  it('keeps the back button on mobile detail pages', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: false,
    })

    expect(wrapper.find('[data-testid="note-detail-back-button"]').exists()).toBe(true)
    expect(wrapper.getComponent({ name: 'NoteMore' }).props('presentation')).toBe('popover')
  })
})
