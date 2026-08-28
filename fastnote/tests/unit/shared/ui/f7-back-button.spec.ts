import { shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { F7BackButton } from '@/shared/ui/f7'

describe('f7 back button', () => {
  it('uses the native Framework7 icon-only back link and reports the back intent', async () => {
    const beforeBack = vi.fn()
    const wrapper = shallowMount(F7BackButton, {
      props: {
        beforeBack,
        defaultHref: '/home',
        text: '返回备忘录',
      },
    })

    const link = wrapper.findComponent({ name: 'f7-link' })

    expect(link.props('href')).toBe('/home')
    expect(link.props('back')).toBe(true)
    expect(link.props('icon')).toBe('icon-back')
    expect(link.props('iconOnly')).toBe(true)
    expect(link.props('text')).toBeUndefined()
    expect(link.attributes('aria-label')).toBe('返回备忘录')

    await link.trigger('pointerup')
    await link.trigger('click')
    expect(beforeBack).toHaveBeenCalledTimes(1)
  })

  it('disables native history back for deterministic destination links', () => {
    const wrapper = shallowMount(F7BackButton, {
      props: {
        defaultHref: '/f/parent-folder',
        deterministic: true,
        text: '返回',
      },
    })

    const link = wrapper.findComponent({ name: 'f7-link' })

    expect(link.props('href')).toBe(false)
    expect(link.props('back')).toBe(false)
  })
})
