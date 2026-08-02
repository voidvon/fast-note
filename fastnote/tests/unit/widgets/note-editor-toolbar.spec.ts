import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createButtonStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { attrs, slots, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, slots.default ? slots.default() : [])
    },
  })
}

describe('note-editor-toolbar widget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('opens the table format modal and notifies page state', async () => {
    vi.doMock('@/shared/ui/f7', () => ({
      F7Footer: createF7Stub('F7Footer'),
      F7Icon: createF7Stub('F7Icon'),
      F7Link: createButtonStub('F7Link'),
      F7ToolbarPane: createF7Stub('F7ToolbarPane'),
    }))
    vi.doMock('@/shared/ui/icon', () => ({
      default: createF7Stub('Icon'),
    }))
    vi.doMock('@/widgets/note-editor-toolbar/ui/table-format-modal.vue', () => ({
      default: createF7Stub('TableFormatModal'),
    }))
    vi.doMock('@/widgets/note-editor-toolbar/ui/text-format-modal.vue', () => ({
      default: createF7Stub('TextFormatModal'),
    }))

    const focusSpy = vi.fn(() => ({ run: vi.fn() }))
    const host = {
      setInputMode: vi.fn(),
      editor: {
        chain: () => ({
          focus: focusSpy,
          blur: () => ({ focus: () => ({ run: vi.fn() }) }),
          toggleTaskList: () => ({ run: vi.fn() }),
        }),
      },
    }

    const Toolbar = (await import('@/widgets/note-editor-toolbar')).default
    const wrapper = mount(Toolbar, {
      props: {
        editorHost: host,
      },
    })

    const tabbar = wrapper.getComponent({ name: 'F7Footer' })
    expect(tabbar.attributes()).toHaveProperty('native')
    expect(tabbar.attributes()).toHaveProperty('tabbar')
    expect(tabbar.attributes()).toHaveProperty('icons')
    expect(tabbar.attributes()).toHaveProperty('scrollable')
    expect(wrapper.getComponent({ name: 'F7ToolbarPane' }).exists()).toBe(true)
    expect(wrapper.findAll('[icon-only]')).toHaveLength(5)
    expect(wrapper.findAll('[tab-link]')).toHaveLength(0)

    await wrapper.get('[data-testid="note-editor-toolbar-table"]').trigger('click')
    expect(host.setInputMode).toHaveBeenCalledWith('none')

    vi.advanceTimersByTime(300)
    await nextTick()

    expect(wrapper.emitted('update:isFormatModalOpen')).toContainEqual([true])

    vi.advanceTimersByTime(500)
    expect(focusSpy).toHaveBeenCalled()
  })

  it('closes open panels through exposed api and restores text input mode', async () => {
    vi.doMock('@/shared/ui/f7', () => ({
      F7Footer: createF7Stub('F7Footer'),
      F7Icon: createF7Stub('F7Icon'),
      F7Link: createButtonStub('F7Link'),
      F7ToolbarPane: createF7Stub('F7ToolbarPane'),
    }))
    vi.doMock('@/shared/ui/icon', () => ({
      default: createF7Stub('Icon'),
    }))
    vi.doMock('@/widgets/note-editor-toolbar/ui/table-format-modal.vue', () => ({
      default: createF7Stub('TableFormatModal'),
    }))
    vi.doMock('@/widgets/note-editor-toolbar/ui/text-format-modal.vue', () => ({
      default: createF7Stub('TextFormatModal'),
    }))

    const blurChain = { focus: () => ({ run: vi.fn() }) }
    const host = {
      setInputMode: vi.fn(),
      editor: {
        chain: () => ({
          focus: () => ({ run: vi.fn() }),
          blur: () => blurChain,
          toggleTaskList: () => ({ run: vi.fn() }),
        }),
      },
    }

    const Toolbar = (await import('@/widgets/note-editor-toolbar')).default
    const wrapper = mount(Toolbar, {
      props: {
        editorHost: host,
      },
    })

    await wrapper.get('[data-testid="note-editor-toolbar-text"]').trigger('click')
    vi.advanceTimersByTime(300)
    await nextTick()

    ;(wrapper.vm as { closePanels: () => void }).closePanels()
    await nextTick()

    expect(wrapper.emitted('update:isFormatModalOpen')).toContainEqual([false])
    expect(host.setInputMode).toHaveBeenLastCalledWith('text')
  })
})
