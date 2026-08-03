import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

function createStub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, [slots.default?.(), slots.after?.()])
    },
  })
}

describe('table format modal', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('renders all table actions in a scrollable content area', async () => {
    vi.doMock('@/shared/ui/f7', () => ({
      F7Icon: createStub('F7Icon'),
      F7Item: createStub('F7Item', 'button'),
      F7Label: createStub('F7Label', 'span'),
      F7List: createStub('F7List'),
      F7Popover: createStub('F7Popover'),
    }))
    vi.doMock('@/shared/ui/icon', () => ({
      default: createStub('Icon'),
    }))

    const chain = {
      focus: vi.fn(),
      insertTable: vi.fn(),
      deleteTable: vi.fn(),
      addColumnAfter: vi.fn(),
      deleteColumn: vi.fn(),
      addRowAfter: vi.fn(),
      deleteRow: vi.fn(),
      run: vi.fn(),
    }
    Object.values(chain).forEach(method => method.mockReturnValue(chain))
    const editor = { chain: vi.fn(() => chain) }

    const TableFormatModal = (await import(
      '@/widgets/note-editor-toolbar/ui/table-format-modal.vue',
    )).default
    const wrapper = mount(TableFormatModal, {
      props: {
        isOpen: true,
        editor: editor as never,
        targetEl: '#table-trigger',
      },
    })

    expect(wrapper.get('.table-format-popover-content').exists()).toBe(true)
    expect(wrapper.get('.table-format-popover').exists()).toBe(true)
    expect(wrapper.findAll('.table-format-modal-list')).toHaveLength(1)

    const actions = [
      ['插入表格', 'insertTable'],
      ['删除表格', 'deleteTable'],
      ['插入列', 'addColumnAfter'],
      ['删除列', 'deleteColumn'],
      ['插入行', 'addRowAfter'],
      ['删除行', 'deleteRow'],
    ] as const

    for (const [label, command] of actions) {
      const item = wrapper.findAll('button').find(button => button.text().includes(label))
      expect(item, `${label} should be rendered`).toBeDefined()
      await item!.trigger('click')
      expect(chain[command]).toHaveBeenCalledTimes(1)
    }

    expect(chain.insertTable).toHaveBeenCalledWith({
      rows: 2,
      cols: 2,
      withHeaderRow: false,
    })
    expect(chain.focus).toHaveBeenCalledTimes(actions.length)
    expect(chain.run).toHaveBeenCalledTimes(actions.length)
    expect(wrapper.emitted('update:isOpen')).toEqual(actions.map(() => [false]))
  })
})
