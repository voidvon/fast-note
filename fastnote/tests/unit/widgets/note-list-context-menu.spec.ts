import type { FolderTreeNode } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

function passthrough(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.list?.() || slots.default?.())
    },
  })
}

function createNoteNode(id: string, title: string): FolderTreeNode {
  return {
    originNote: {
      id,
      title,
      item_type: NOTE_TYPE.NOTE,
      content: '',
      created: '2026-01-01T00:00:00Z',
      updated: '2026-01-01T00:00:00Z',
      is_deleted: 0,
      is_locked: 0,
      parent_id: '',
      summary: '',
      note_count: 0,
      version: 1,
    },
    children: [],
  }
}

describe('note-list context menu on desktop', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('triggers context menu popover on right click and supports folder switching and item switching', async () => {
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
        props: {
          id: String,
          isOpen: Boolean,
          presentation: String,
          targetEl: Object,
        },
        emits: ['did-dismiss', 'update:is-open'],
        setup(props, { emit }) {
          return () => h('div', {
            class: 'mock-actions-menu',
            onClick: () => emit('update:is-open', false),
          })
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        props: { isOpen: Boolean },
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/widgets/note-list/ui/note-list-item.vue', () => ({
      default: defineComponent({
        name: 'NoteListItem',
        props: {
          data: Object,
        },
        setup(props) {
          return () => h('div', {
            'class': 'app-list-item',
            'data-id': props.data?.originNote?.id,
          }, props.data?.originNote?.title)
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7List: passthrough('F7List'),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const note1 = createNoteNode('note-1', 'Note 1')
    const note2 = createNoteNode('note-2', 'Note 2')

    const wrapper = mount(NoteList, {
      props: {
        dataList: [note1, note2],
        virtualNotes: false,
      },
    })
    await flushPromises()

    const actionsMenu = wrapper.getComponent({ name: 'NoteActionsMenu' })
    const anchor = wrapper.get('.fastnote-note-list__context-menu-anchor')

    // Find note-1 item
    const note1Item = wrapper.find('[data-id="note-1"]')
    expect(note1Item.exists()).toBe(true)

    // 1. Right click on note-1
    await note1Item.trigger('contextmenu', { clientX: 100, clientY: 200 })
    await flushPromises()

    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-1')
    expect(actionsMenu.props('presentation')).toBe('popover')
    expect(anchor.attributes('style')).toContain('left: 100px')
    expect(anchor.attributes('style')).toContain('top: 200px')

    // 2. Right click on note-2 while actions menu is already open
    const note2Item = wrapper.find('[data-id="note-2"]')
    await note2Item.trigger('contextmenu', { clientX: 150, clientY: 250 })
    await flushPromises()

    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-2')
    expect(anchor.attributes('style')).toContain('left: 150px')
    expect(anchor.attributes('style')).toContain('top: 250px')

    // 3. Switch folder: update dataList to a new folder's notes
    const note3 = createNoteNode('note-3', 'Note 3 in new folder')
    await wrapper.setProps({
      dataList: [note3],
    })
    await flushPromises()

    const note3Item = wrapper.find('[data-id="note-3"]')
    expect(note3Item.exists()).toBe(true)

    // Right click on note-3 after switching folders
    await note3Item.trigger('contextmenu', { clientX: 300, clientY: 400 })
    await flushPromises()

    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-3')
    expect(anchor.attributes('style')).toContain('left: 300px')
    expect(anchor.attributes('style')).toContain('top: 400px')
  })

  it('keeps right-click working when switching between allnotes and subfolders with virtual list re-keying', async () => {
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
        props: {
          id: String,
          isOpen: Boolean,
          presentation: String,
          targetEl: Object,
        },
        setup() {
          return () => h('div', { class: 'mock-actions-menu' })
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        props: { isOpen: Boolean },
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/widgets/note-list/ui/note-list-item.vue', () => ({
      default: defineComponent({
        name: 'NoteListItem',
        props: {
          data: Object,
        },
        setup(props) {
          return () => h('div', {
            'class': 'app-list-item',
            'data-id': props.data?.originNote?.id,
          }, props.data?.originNote?.title)
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7List: defineComponent({
        name: 'F7List',
        props: {
          virtualListParams: Object,
        },
        setup(props, { slots }) {
          // Immediately simulate virtual list render external callback
          props.virtualListParams?.renderExternal?.(null, {
            fromIndex: 0,
            items: props.virtualListParams.items || [],
            topPosition: 0,
          })
          return () => h('div', { class: 'mock-f7-list' }, slots.default?.())
        },
      }),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const noteA = createNoteNode('note-a', 'All Notes item')
    const wrapper = mount(NoteList, {
      props: {
        dataList: [noteA],
        virtualNotes: true,
        showParentFolder: true, // allnotes row height 84
      },
    })
    await flushPromises()

    const actionsMenu = wrapper.getComponent({ name: 'NoteActionsMenu' })
    const noteAItem = wrapper.find('[data-id="note-a"]')
    expect(noteAItem.exists()).toBe(true)

    // 1. Right click noteA in allnotes
    await noteAItem.trigger('contextmenu', { clientX: 120, clientY: 220 })
    await flushPromises()
    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-a')

    // 2. Switch to subfolder: showParentFolder changes to false (row height 68, re-keying F7List)
    const noteB = createNoteNode('note-b', 'Subfolder item')
    await wrapper.setProps({
      dataList: [noteB],
      showParentFolder: false,
    })
    await flushPromises()

    const noteBItem = wrapper.find('[data-id="note-b"]')
    expect(noteBItem.exists()).toBe(true)

    // 3. Right click noteB in subfolder
    await noteBItem.trigger('contextmenu', { clientX: 160, clientY: 260 })
    await flushPromises()
    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-b')

    // 4. Switch to empty folder
    await wrapper.setProps({
      dataList: [],
      showParentFolder: false,
    })
    await flushPromises()

    // 5. Switch back to a folder with noteC
    const noteC = createNoteNode('note-c', 'Another folder item')
    await wrapper.setProps({
      dataList: [noteC],
      showParentFolder: false,
    })
    await flushPromises()

    const noteCItem = wrapper.find('[data-id="note-c"]')
    expect(noteCItem.exists()).toBe(true)

    await noteCItem.trigger('contextmenu', { clientX: 200, clientY: 300 })
    await flushPromises()
    expect(actionsMenu.props('isOpen')).toBe(true)
    expect(actionsMenu.props('id')).toBe('note-c')
  })

  it('expands folder and forwards createNote and createFolder events when triggered from actions menu', async () => {
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
        props: {
          id: String,
          isOpen: Boolean,
          items: Array,
        },
        emits: ['createNote', 'createFolder', 'refresh'],
        setup(props, { emit }) {
          return () => h('div', {
            class: 'mock-actions-menu',
            onClick: () => {
              emit('createNote', props.id)
              emit('createFolder', { parentId: props.id })
            },
          })
        },
      }),
    }))
    vi.doMock('@/features/note-move/ui/note-move-modal.vue', () => ({
      default: defineComponent({
        name: 'NoteMoveModal',
        props: { isOpen: Boolean },
        setup() {
          return () => h('div')
        },
      }),
    }))
    vi.doMock('@/widgets/note-list/ui/note-list-item.vue', () => ({
      default: defineComponent({
        name: 'NoteListItem',
        props: { data: Object },
        setup(props) {
          return () => h('div', {
            'class': 'app-list-item',
            'data-id': props.data?.originNote?.id,
          }, props.data?.originNote?.title)
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7AccordionGroup: passthrough('F7AccordionGroup'),
      F7List: passthrough('F7List'),
    }))

    const NoteList = (await import('@/widgets/note-list/ui/note-list.vue')).default

    const folder1: FolderTreeNode = {
      originNote: {
        id: 'folder-1',
        title: 'Folder 1',
        item_type: NOTE_TYPE.FOLDER,
        content: '',
        created: '2026-01-01T00:00:00Z',
        updated: '2026-01-01T00:00:00Z',
        is_deleted: 0,
        is_locked: 0,
        parent_id: '',
        summary: '',
        note_count: 0,
        version: 1,
      },
      children: [],
    }

    const wrapper = mount(NoteList, {
      props: {
        dataList: [folder1],
        virtualNotes: false,
      },
    })
    await flushPromises()

    const actionsMenu = wrapper.getComponent({ name: 'NoteActionsMenu' })
    expect(actionsMenu.props('items')).toEqual([
      { type: 'createNote' },
      { type: 'createFolder' },
      { type: 'rename' },
      { type: 'move' },
      { type: 'delete' },
    ])

    // Trigger action menu events
    actionsMenu.vm.$emit('createNote', 'folder-1')
    await flushPromises()

    expect(wrapper.emitted('createNote')).toEqual([['folder-1']])

    actionsMenu.vm.$emit('createFolder', { parentId: 'folder-1' })
    await flushPromises()

    expect(wrapper.emitted('createFolder')).toEqual([[{ parentId: 'folder-1' }]])
    expect(wrapper.emitted('refresh')).toBeDefined()
  })
})
