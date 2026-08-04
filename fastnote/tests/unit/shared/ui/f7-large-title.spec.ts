import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { F7Header, F7Title, F7Toolbar } from '@/shared/ui/f7'

describe('f7 large title adapter', () => {
  it('uses the native Framework7 large-title structure for condensed content titles', () => {
    const TestComponent = defineComponent({
      setup() {
        return () => h(F7Header, { collapse: 'condense' }, {
          default: () => h(F7Toolbar, null, {
            default: () => h(F7Title, { size: 'large' }, () => '子文件夹'),
          }),
        })
      },
    })
    const wrapper = mount(TestComponent)

    expect(wrapper.find('.app-large-title').exists()).toBe(false)
    expect(wrapper.findAll('.title-large')).toHaveLength(1)
    expect(wrapper.get('.title-large > .title-large-text').text()).toBe('子文件夹')
  })
})
