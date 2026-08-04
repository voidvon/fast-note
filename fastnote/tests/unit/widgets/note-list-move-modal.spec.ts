import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

function passthrough(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.list?.() || slots.default?.())
    },
  })
}

describe('note list move modal orchestration', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('waits for the actions menu to close before opening the move sheet', async () => {
    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(false) }),
    }))
    vi.doMock('@/shared/lib/framework7', () => ({
      useLongPressList: vi.fn(),
    }))
    vi.doMock('@/features/global-search', () => ({
      useGlobalSearch: () => ({ showGlobalSearch: ref(false) }),
    }))
    vi.doMock('@/features/note-lock', () => ({
      useNoteLockIndicatorState: () => ({ indicatorStateMap: ref({}) }),
    }))
    vi.doMock('@/features/note-actions-menu', () => ({
      default: defineComponent({
        name: 'NoteActionsMenu',
        emits: ['did-dismiss', 'move'],
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        props: {
          isOpen: Boolean,
        },
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/widgets/note-list/ui/note-list-item.vue', () => ({
      default: passthrough('NoteListItem'),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7List: passthrough('F7List'),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default
    const wrapper = mount(NoteList, {
      props: {
        dataList: [],
      },
    })
    await flushPromises()

    const actions = wrapper.getComponent({ name: 'NoteActionsMenu' })
    const moveModal = wrapper.getComponent({ name: 'NoteMoveModal' })

    actions.vm.$emit('move', 'note-1')
    await nextTick()
    expect(moveModal.props('isOpen')).toBe(false)

    actions.vm.$emit('did-dismiss')
    await flushPromises()
    expect(moveModal.props('isOpen')).toBe(true)
  })
})
