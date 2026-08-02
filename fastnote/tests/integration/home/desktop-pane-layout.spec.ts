import { describe, expect, it } from 'vitest'
import { mountHomePageForDesktopRestore } from './home-page-test-utils'

describe('home pane layout', () => {
  it('renders two accessible splitters for the desktop three-pane workspace', async () => {
    const { wrapper } = await mountHomePageForDesktopRestore({
      notes: [],
      isDesktop: true,
    })

    expect(wrapper.findAll('[role="separator"]')).toHaveLength(2)
    expect(wrapper.find('#home-note-list-pane').exists()).toBe(true)
    expect(wrapper.find('#home-note-detail-pane').exists()).toBe(true)
  })

  it('keeps mobile as a single pane without splitters', async () => {
    const { wrapper } = await mountHomePageForDesktopRestore({
      notes: [],
      isDesktop: false,
    })

    expect(wrapper.find('.home-navigation').exists()).toBe(false)
    const mobilePageChildren = Array.from(wrapper.find('[data-f7-stub="F7Page"]').element.children)
    expect(mobilePageChildren[0]?.getAttribute('data-f7-stub')).toBe('F7Navbar')
    expect(mobilePageChildren[1]?.getAttribute('data-f7-stub')).toBe('F7PageContent')
    expect(wrapper.findAll('[role="separator"]')).toHaveLength(0)
    expect(wrapper.find('#home-note-list-pane').exists()).toBe(false)
    expect(wrapper.find('#home-note-detail-pane').exists()).toBe(false)
  })
})
