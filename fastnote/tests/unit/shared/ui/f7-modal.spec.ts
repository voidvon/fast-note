import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'
import { F7Modal } from '@/shared/ui/f7'

describe('f7 modal', () => {
  it('does not render a closed sheet by default', () => {
    const wrapper = shallowMount(F7Modal, {
      props: { isOpen: false },
    })

    expect(wrapper.findComponent({ name: 'f7-sheet' }).exists()).toBe(false)
  })

  it('mounts before opening and unmounts after the close transition', async () => {
    const wrapper = shallowMount(F7Modal, {
      props: { isOpen: false },
    })

    await wrapper.setProps({ isOpen: true })
    await nextTick()
    await nextTick()
    expect(wrapper.getComponent({ name: 'f7-sheet' }).props('opened')).toBe(true)

    const openedSheet = wrapper.getComponent({ name: 'f7-sheet' })
    openedSheet.vm.$emit('update:opened', false)
    await wrapper.setProps({ isOpen: false })
    const closingSheet = wrapper.getComponent({ name: 'f7-sheet' })
    expect(closingSheet.props('opened')).toBe(false)

    closingSheet.vm.$emit('sheet:closed')
    await nextTick()
    expect(wrapper.findComponent({ name: 'f7-sheet' }).exists()).toBe(false)
  })

  it('does not leave a sheet mounted when opening is cancelled immediately', async () => {
    const wrapper = shallowMount(F7Modal, {
      props: { isOpen: false },
    })

    const opening = wrapper.setProps({ isOpen: true })
    const closing = wrapper.setProps({ isOpen: false })
    await Promise.all([opening, closing])
    await nextTick()

    expect(wrapper.findComponent({ name: 'f7-sheet' }).exists()).toBe(false)
  })

  it('can keep a closed sheet mounted when explicitly requested', () => {
    const wrapper = shallowMount(F7Modal, {
      props: {
        isOpen: false,
        keepMounted: true,
      },
    })

    expect(wrapper.getComponent({ name: 'f7-sheet' }).props('opened')).toBe(false)
  })

  it('supports a non-modal sheet without a backdrop', () => {
    const wrapper = shallowMount(F7Modal, {
      props: {
        isOpen: true,
        backdrop: false,
      },
    })
    const sheet = wrapper.getComponent({ name: 'f7-sheet' })

    expect(sheet.props('backdrop')).toBe(false)
    expect(sheet.props('closeByBackdropClick')).toBe(false)
  })

  it('passes push mode to the underlying sheet', () => {
    const wrapper = shallowMount(F7Modal, {
      props: {
        isOpen: true,
        push: true,
      },
    })
    const sheet = wrapper.getComponent({ name: 'f7-sheet' })

    expect(sheet.props('push')).toBe(true)
    expect(sheet.props('closeByBackdropClick')).toBe(true)
  })

  it('forwards fixed content to the underlying sheet fixed slot', () => {
    const wrapper = shallowMount(F7Modal, {
      props: { isOpen: true },
      slots: {
        fixed: () => h('header', 'Fixed header'),
      },
    })
    const fixedContent = wrapper.getComponent({ name: 'f7-sheet' }).vm.$slots.fixed?.()

    expect(fixedContent?.[0].children).toBe('Fixed header')
  })
})
