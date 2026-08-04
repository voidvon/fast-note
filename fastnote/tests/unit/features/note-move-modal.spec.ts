import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

describe('note move modal', () => {
  it('initializes the folder list when will-present fires before slot content mounts', async () => {
    vi.resetModules()

    const setExpandedItems = vi.fn()
    const moveTree = [{
      originNote: {
        id: 'root',
        title: '根目录',
        item_type: 1,
      },
      children: [],
    }]

    vi.doMock('@/features/note-move/model/use-note-move', () => ({
      useNoteMove: () => ({
        createMoveTree: () => moveTree,
        findFoldersWithChildren: () => ['root'],
        getNote: vi.fn(),
        moveNote: vi.fn(),
      }),
    }))
    vi.doMock('@/widgets/note-list/ui/note-list.vue', () => ({
      default: defineComponent({
        name: 'NoteList',
        setup(_, { expose }) {
          expose({ setExpandedItems })
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => {
      const passthrough = (name: string) => defineComponent({
        name,
        setup(_, { slots }) {
          return () => h('div', slots.default?.())
        },
      })
      const F7Modal = defineComponent({
        name: 'F7Modal',
        emits: ['will-present'],
        setup(_, { emit, slots }) {
          emit('will-present')
          return () => h('div', slots.default?.())
        },
      })

      return {
        F7Button: passthrough('F7Button'),
        F7Buttons: passthrough('F7Buttons'),
        F7Content: passthrough('F7Content'),
        F7Header: passthrough('F7Header'),
        F7Modal,
        F7Title: passthrough('F7Title'),
        F7Toolbar: passthrough('F7Toolbar'),
      }
    })

    const NoteMoveModal = (await import('@/features/note-move/ui/note-move-modal.vue')).default
    mount(NoteMoveModal, {
      props: {
        id: 'note-1',
        isOpen: true,
      },
    })

    await nextTick()

    expect(setExpandedItems).toHaveBeenCalledWith(['root'])
  })
})
