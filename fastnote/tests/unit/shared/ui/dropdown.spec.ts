import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const F7PopoverStub = defineComponent({
  name: 'F7Popover',
  inheritAttrs: false,
  props: {
    isOpen: Boolean,
    targetEl: [String, Object],
    verticalPosition: String,
  },
  emits: ['did-dismiss', 'update:isOpen'],
  setup(_, { attrs, emit, slots }) {
    return () => h('div', {
      ...attrs,
      onClick: () => emit('update:isOpen', false),
      onKeydown: () => emit('did-dismiss'),
    }, slots.default?.())
  },
})

vi.mock('@/shared/ui/f7', () => ({
  F7Popover: F7PopoverStub,
}))

describe('app dropdown', () => {
  it('anchors the popover and exposes a controlled open state', async () => {
    const Dropdown = (await import('@/shared/ui/dropdown')).default
    const wrapper = mount(Dropdown, {
      props: {
        isOpen: true,
        size: 'compact',
        targetEl: '#menu-trigger',
        verticalPosition: 'bottom',
      },
      slots: {
        default: '<button>菜单项</button>',
      },
    })
    const popover = wrapper.getComponent(F7PopoverStub)

    expect(popover.props()).toMatchObject({
      isOpen: true,
      targetEl: '#menu-trigger',
      verticalPosition: 'bottom',
    })
    expect(wrapper.text()).toContain('菜单项')
    expect(popover.classes()).toContain('app-dropdown--compact')

    await popover.trigger('click')
    await popover.trigger('keydown')

    expect(wrapper.emitted('update:isOpen')).toEqual([[false]])
    expect(wrapper.emitted('didDismiss')).toHaveLength(1)

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })

    expect(wrapper.getComponent(F7PopoverStub).props('isOpen')).toBe(true)
  })
})
