import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PaneSplitter from '@/shared/ui/pane-splitter'

function mountSplitter() {
  return mount(PaneSplitter, {
    props: {
      controls: 'left-pane right-pane',
      label: '调整栏宽',
      max: 420,
      min: 240,
      modelValue: 300,
    },
  })
}

afterEach(() => {
  document.body.classList.remove('pane-splitter-resizing')
})

describe('paneSplitter', () => {
  it('exposes separator semantics and supports keyboard resizing', async () => {
    const wrapper = mountSplitter()

    expect(wrapper.attributes()).toMatchObject({
      'aria-controls': 'left-pane right-pane',
      'aria-label': '调整栏宽',
      'aria-orientation': 'vertical',
      'aria-valuemax': '420',
      'aria-valuemin': '240',
      'aria-valuenow': '300',
      'role': 'separator',
      'tabindex': '0',
    })

    await wrapper.trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([308])
    expect(wrapper.emitted('resizeEnd')).toHaveLength(1)

    await wrapper.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([268])
  })

  it('requests a reset on double click', async () => {
    const wrapper = mountSplitter()

    await wrapper.trigger('dblclick')

    expect(wrapper.emitted('reset')).toHaveLength(1)
  })

  it('cancels an active pointer drag with Escape', async () => {
    const wrapper = mountSplitter()
    const element = wrapper.element as HTMLElement
    Object.assign(element, {
      hasPointerCapture: () => true,
      releasePointerCapture: () => undefined,
      setPointerCapture: () => undefined,
    })

    await wrapper.trigger('pointerdown', { button: 0, clientX: 300, pointerId: 1 })
    await wrapper.trigger('pointermove', { clientX: 340, pointerId: 1 })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([300])
    expect(wrapper.emitted('resizeCancel')).toHaveLength(1)
    expect(document.body.classList.contains('pane-splitter-resizing')).toBe(false)
  })
})
