import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

describe('chat message cards selected state', () => {
  it('passes selected state to the matched card item', async () => {
    const ChatMessageCards = (await import('@/shared/ui/chat-message/ui/chat-message-cards.vue')).default

    const wrapper = mount(ChatMessageCards, {
      props: {
        cards: [{
          id: 'card-1',
          items: [
            {
              id: 'note-1',
              title: '周报',
            },
            {
              id: 'note-2',
              title: '日报',
            },
          ],
          title: '备忘录建议',
        }],
        selectedItemId: 'note-2',
      },
    })

    const items = wrapper.findAll('.chat-message__card-item')
    expect(items).toHaveLength(2)
    expect(items[0].classes()).not.toContain('chat-message__card-item--selected')
    expect(items[1].classes()).toContain('chat-message__card-item--selected')
  })
})
