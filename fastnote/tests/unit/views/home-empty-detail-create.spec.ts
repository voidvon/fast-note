import { describe, expect, it } from 'vitest'
import { makeNote } from '../../factories/note.factory'
import { mountHomePageForDesktopRestore } from '../../integration/home/home-page-test-utils'

describe('home empty detail quick create (t-fn-022 / tc-fn-014, tc-fn-017)', () => {
  it('shows a clickable empty detail overlay and enters new note mode on click', async () => {
    const { wrapper, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [],
    })

    const trigger = wrapper.get('[data-testid="home-empty-detail-create"]')

    expect(trigger.text()).toContain('点击开始新建备忘录')

    await trigger.trigger('click')

    expect(getNoteDetail().props('noteId')).toBe('0')
    expect(wrapper.find('[data-testid="home-empty-detail-create"]').exists()).toBe(false)
  })

  it('does not show the empty detail overlay when a note is already selected', async () => {
    const note = makeNote({ id: 'note-1' })
    const { wrapper, getNoteDetail } = await mountHomePageForDesktopRestore({
      notes: [note],
      snapshot: {
        folderId: 'allnotes',
        noteId: 'note-1',
      },
    })

    expect(wrapper.find('[data-testid="home-empty-detail-create"]').exists()).toBe(false)
    expect(getNoteDetail().props('noteId')).toBe('note-1')
  })
})
