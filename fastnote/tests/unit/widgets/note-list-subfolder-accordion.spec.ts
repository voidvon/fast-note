import type { FolderTreeNode } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

function createF7Stub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      value: String,
      expandable: {
        type: Boolean,
        default: true,
      },
    },
    emits: ['leaf-click'],
    setup(props, { attrs, emit, slots }) {
      const isOpened = ref(false)
      const toggle = () => {
        if (!props.expandable) {
          emit('leaf-click')
          return
        }
        isOpened.value = !isOpened.value
      }

      return () => {
        const openedClass = isOpened.value ? 'accordion-item-opened' : ''
        return h(
          tag,
          {
            ...attrs,
            class: [
              name === 'F7Accordion' ? 'accordion-item' : '',
              openedClass,
              attrs.class,
            ],
          },
          [
            h('div', { class: 'item-content' }, [
              h('div', { class: 'item-inner' }, [
                slots.media?.(),
                h('div', { class: 'item-title' }, slots.title?.() || slots.default?.()),
                slots.after?.(),
                name === 'F7Accordion'
                  ? h('span', {
                      class: 'folder-accordion-toggle',
                      role: 'button',
                      onClick: (e: MouseEvent) => {
                        e.stopPropagation()
                        toggle()
                      },
                    })
                  : null,
              ]),
            ]),
            name === 'F7Accordion'
              ? h(
                  'div',
                  {
                    class: 'accordion-item-content',
                    style: { display: isOpened.value ? 'block' : 'none' },
                  },
                  slots.content?.(),
                )
              : slots.default?.(),
          ],
        )
      }
    },
  })
}

function passthrough(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', { class: name.toLowerCase() }, slots.list?.() || slots.default?.())
    },
  })
}

function createFolderNode(id: string, title: string, children: FolderTreeNode[] = []): FolderTreeNode {
  return {
    originNote: {
      id,
      title,
      item_type: NOTE_TYPE.FOLDER,
      content: '',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
      is_deleted: 0,
      is_locked: 0,
      parent_id: '',
      summary: '',
      note_count: children.length,
      version: 1,
    },
    children,
  }
}

function createNoteNode(id: string, title: string): FolderTreeNode {
  return {
    originNote: {
      id,
      title,
      item_type: NOTE_TYPE.NOTE,
      content: 'Note content',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
      is_deleted: 0,
      is_locked: 0,
      parent_id: '',
      summary: 'Note summary',
      note_count: 0,
      version: 1,
    },
    children: [],
  }
}

describe('note-list subfolder accordion behavior', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('on desktop: subfolder with notes is expandable, collapsed by default, and toggles on row click', async () => {
    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(true) }),
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
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7Accordion: createF7Stub('F7Accordion', 'li'),
      F7Item: createF7Stub('F7Item', 'li'),
      F7List: passthrough('F7List'),
      F7Icon: passthrough('F7Icon'),
      F7Note: passthrough('F7Note'),
      useAppRoute: () => ({ params: {}, path: '/home' }),
      useAppRouter: () => ({ navigate: vi.fn(), push: vi.fn() }),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const childNote = createNoteNode('child-note-1', 'Child Note 1')
    const subfolder = createFolderNode('subfolder-1', 'Subfolder 1', [childNote])
    const emptySubfolder = createFolderNode('empty-subfolder', 'Empty Subfolder', [])

    const wrapper = mount(NoteList, {
      props: {
        dataList: [subfolder, emptySubfolder],
        mediaList: true,
        virtualNotes: false,
      },
    })
    await flushPromises()

    const subfolderItem = wrapper.find('[data-id="subfolder-1"]')
    expect(subfolderItem.exists()).toBe(true)
    // Non-empty subfolder should NOT have no-children
    expect(subfolderItem.classes()).not.toContain('no-children')
    // Collapsed by default
    expect(subfolderItem.classes()).not.toContain('accordion-item-opened')

    const emptyItem = wrapper.find('[data-id="empty-subfolder"]')
    expect(emptyItem.exists()).toBe(true)
    // Empty subfolder should have no-children
    expect(emptyItem.classes()).toContain('no-children')

    // Click on subfolder row to expand
    await subfolderItem.trigger('click')
    await flushPromises()

    // Now it should be opened
    expect(subfolderItem.classes()).toContain('accordion-item-opened')

    // Child note is visible inside
    const childItem = wrapper.find('[data-id="child-note-1"]')
    expect(childItem.exists()).toBe(true)

    // Click child note
    await childItem.trigger('click')
    await flushPromises()

    // Should emit selected with child note's id
    const selectedEvents = wrapper.emitted('selected')
    expect(selectedEvents).toBeTruthy()
    expect(selectedEvents?.[selectedEvents.length - 1]).toEqual(['child-note-1'])
  })

  it('on mobile: folder row click triggers route navigation instead of in-place expand', async () => {
    const pushMock = vi.fn()
    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(false) }),
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
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7Accordion: createF7Stub('F7Accordion', 'li'),
      F7Item: createF7Stub('F7Item', 'li'),
      F7List: passthrough('F7List'),
      F7Icon: passthrough('F7Icon'),
      F7Note: passthrough('F7Note'),
      useAppRoute: () => ({ params: {}, path: '/home' }),
      useAppRouter: () => ({ navigate: vi.fn(), push: pushMock }),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const childNote = createNoteNode('child-note-1', 'Child Note 1')
    const subfolder = createFolderNode('subfolder-1', 'Subfolder 1', [childNote])

    const wrapper = mount(NoteList, {
      props: {
        dataList: [subfolder],
        mediaList: true,
        virtualNotes: false,
      },
    })
    await flushPromises()

    const subfolderItem = wrapper.find('[data-id="subfolder-1"]')
    await subfolderItem.trigger('click')
    await flushPromises()

    // Mobile should navigate via router
    expect(pushMock).toHaveBeenCalledWith('/f/subfolder-1')
  })

  it('on desktop: nested subfolder expands grandchild folder and clicking grandchild note selects it', async () => {
    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(true) }),
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
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7Accordion: createF7Stub('F7Accordion', 'li'),
      F7Item: createF7Stub('F7Item', 'li'),
      F7List: passthrough('F7List'),
      F7Icon: passthrough('F7Icon'),
      F7Note: passthrough('F7Note'),
      useAppRoute: () => ({ params: {}, path: '/home' }),
      useAppRouter: () => ({ navigate: vi.fn(), push: vi.fn() }),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const grandchildNote = createNoteNode('note-grandchild', 'Grandchild Note')
    const grandchildFolder = createFolderNode('folder-grandchild', 'Grandchild Folder', [grandchildNote])
    const childFolder = createFolderNode('folder-child', 'Child Folder', [grandchildFolder])
    const rootFolder = createFolderNode('folder-root', 'Root Folder', [childFolder])

    const wrapper = mount(NoteList, {
      props: {
        dataList: [rootFolder],
        mediaList: true,
        virtualNotes: false,
      },
    })
    await flushPromises()

    // 1. Expand root folder
    const rootItem = wrapper.find('[data-id="folder-root"]')
    await rootItem.trigger('click')
    await flushPromises()
    expect(rootItem.classes()).toContain('accordion-item-opened')

    // 2. Child folder is revealed and collapsed by default
    const childItem = wrapper.find('[data-id="folder-child"]')
    expect(childItem.exists()).toBe(true)
    expect(childItem.classes()).not.toContain('accordion-item-opened')

    // 3. Click child folder to expand
    await childItem.trigger('click')
    await flushPromises()
    expect(childItem.classes()).toContain('accordion-item-opened')

    // 4. Grandchild folder is revealed and collapsed
    const grandchildItem = wrapper.find('[data-id="folder-grandchild"]')
    expect(grandchildItem.exists()).toBe(true)
    expect(grandchildItem.classes()).not.toContain('accordion-item-opened')

    // 5. Click grandchild folder to expand
    await grandchildItem.trigger('click')
    await flushPromises()
    expect(grandchildItem.classes()).toContain('accordion-item-opened')

    // 6. Grandchild note is visible
    const noteItem = wrapper.find('[data-id="note-grandchild"]')
    expect(noteItem.exists()).toBe(true)

    // 7. Click grandchild note
    await noteItem.trigger('click')
    await flushPromises()

    // Emits selected with grandchild note id
    const selectedEvents = wrapper.emitted('selected')
    expect(selectedEvents).toBeTruthy()
    expect(selectedEvents?.[selectedEvents.length - 1]).toEqual(['note-grandchild'])
  })
})
