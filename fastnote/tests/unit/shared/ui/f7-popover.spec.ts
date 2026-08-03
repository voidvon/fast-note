import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { F7Popover } from '@/shared/ui/f7'

describe('f7 popover', () => {
  it('forwards its target and can reopen after Framework7 closes it', async () => {
    const wrapper = shallowMount(F7Popover, {
      props: {
        isOpen: true,
        targetEl: '#nearby-trigger',
      },
    })
    const popover = wrapper.getComponent({ name: 'f7-popover' })

    expect(popover.props('opened')).toBe(true)
    expect(popover.props('targetEl')).toBe('#nearby-trigger')

    popover.vm.$emit('update:opened', false)
    popover.vm.$emit('popover:closed')
    await nextTick()

    expect(wrapper.emitted('update:isOpen')).toEqual([[false]])
    expect(wrapper.emitted('did-dismiss')).toHaveLength(1)

    await wrapper.setProps({ isOpen: false })
    await wrapper.setProps({ isOpen: true })

    expect(wrapper.getComponent({ name: 'f7-popover' }).props('opened')).toBe(true)
  })
})
