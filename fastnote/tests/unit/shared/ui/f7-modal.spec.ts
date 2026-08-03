import { shallowMount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { F7Modal } from '@/shared/ui/f7'

describe('f7 modal', () => {
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
})
