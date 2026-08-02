import { describe, expect, it } from 'vitest'
import { mountNoteDetailForSaveTest } from '../../helpers/note-detail-save-test-utils'

describe('note detail header navigation', () => {
  it('hides the back button in the desktop detail pane', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: true,
    })

    expect(wrapper.find('[data-testid="note-detail-back-button"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="note-more-trigger"]').exists()).toBe(true)
  })

  it('keeps the back button on mobile detail pages', async () => {
    const { wrapper } = await mountNoteDetailForSaveTest({
      isDesktop: false,
    })

    expect(wrapper.find('[data-testid="note-detail-back-button"]').exists()).toBe(true)
  })
})
