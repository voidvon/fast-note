import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../../factories/note.factory'

describe('noteActionsMenu feature', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('useNoteActionsMenu.createFolder creates and saves a new folder', async () => {
    const addNote = vi.fn(async () => undefined)
    const mockFolder = makeNote({ title: '子文件夹', item_type: NOTE_TYPE.FOLDER, parent_id: 'parent-1' })
    const getNote = vi.fn((_id: string) => mockFolder)

    vi.doMock('@/entities/note', () => ({
      NOTE_TYPE,
      useNote: () => ({
        addNote,
        getNote,
        setNoteDeletedState: vi.fn(),
        updateNote: vi.fn(),
      }),
    }))
    vi.doMock('@/entities/note/model/note-purge-service', () => ({
      useNotePurgeService: () => ({ queueNotePurge: vi.fn() }),
    }))
    vi.doMock('@/shared/lib/date', () => ({
      getTime: () => '2026-04-01 10:00:00',
    }))

    const { useNoteActionsMenu } = await import('@/features/note-actions-menu')
    const { createFolder } = useNoteActionsMenu()

    const result = await createFolder('parent-1', '子文件夹')

    expect(addNote).toHaveBeenCalledWith(expect.objectContaining({
      title: '子文件夹',
      parent_id: 'parent-1',
      item_type: NOTE_TYPE.FOLDER,
      created: '2026-04-01 10:00:00',
    }))
    expect(result).toBe(mockFolder)
  })

  it('displays createNote and createFolder options for folders, and emits createNote on click', async () => {
    const folderNote = makeNote({
      id: 'folder-1',
      title: '我的文件夹',
      item_type: NOTE_TYPE.FOLDER,
    })

    vi.doMock('@/entities/note', () => ({
      NOTE_TYPE,
      useNote: () => ({
        getNote: (id: string) => (id === 'folder-1' ? folderNote : null),
        addNote: vi.fn(),
        setNoteDeletedState: vi.fn(),
        updateNote: vi.fn(),
      }),
    }))
    vi.doMock('@/entities/note/model/note-purge-service', () => ({
      useNotePurgeService: () => ({ queueNotePurge: vi.fn() }),
    }))
    vi.doMock('@/shared/ui/dropdown', () => ({
      default: defineComponent({
        name: 'Dropdown',
        props: { isOpen: Boolean },
        setup(_, { slots }) {
          return () => h('div', { class: 'mock-dropdown' }, slots.default?.())
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7List: defineComponent({
        setup(_, { slots }) {
          return () => h('ul', { class: 'mock-f7-list' }, slots.default?.())
        },
      }),
      F7Actions: defineComponent({ setup: () => () => h('div') }),
      F7ActionsGroup: defineComponent({ setup: () => () => h('div') }),
      F7ActionsLabel: defineComponent({ setup: () => () => h('div') }),
      F7ActionsButton: defineComponent({ setup: () => () => h('div') }),
      dialogController: { prompt: vi.fn() },
      alertController: { create: vi.fn() },
    }))
    vi.doMock('framework7-vue', () => ({
      f7ListItem: defineComponent({
        name: 'F7ListItem',
        props: { title: String },
        emits: ['click'],
        setup(props, { emit }) {
          return () => h('li', {
            class: 'mock-f7-list-item',
            onClick: () => emit('click'),
          }, props.title)
        },
      }),
    }))

    const NoteActionsMenu = (await import('@/features/note-actions-menu/ui/note-actions-menu.vue')).default

    const wrapper = mount(NoteActionsMenu, {
      props: {
        id: 'folder-1',
        isOpen: true,
        presentation: 'popover',
      },
    })
    await flushPromises()

    const itemTitles = wrapper.findAll('.mock-f7-list-item').map(item => item.text())
    expect(itemTitles).toContain('新建备忘录')
    expect(itemTitles).toContain('新建文件夹')
    expect(itemTitles).toContain('重命名')
    expect(itemTitles).toContain('移动')
    expect(itemTitles).toContain('删除')

    // Click "新建备忘录"
    const createNoteItem = wrapper.findAll('.mock-f7-list-item').find(item => item.text() === '新建备忘录')
    expect(createNoteItem).toBeDefined()
    await createNoteItem!.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('createNote')).toEqual([['folder-1']])
  })

  it('filters out createNote and createFolder for notes', async () => {
    const regularNote = makeNote({
      id: 'note-1',
      title: '常规备忘录',
      item_type: NOTE_TYPE.NOTE,
    })

    vi.doMock('@/entities/note', () => ({
      NOTE_TYPE,
      useNote: () => ({
        getNote: (id: string) => (id === 'note-1' ? regularNote : null),
        addNote: vi.fn(),
        setNoteDeletedState: vi.fn(),
        updateNote: vi.fn(),
      }),
    }))
    vi.doMock('@/entities/note/model/note-purge-service', () => ({
      useNotePurgeService: () => ({ queueNotePurge: vi.fn() }),
    }))
    vi.doMock('@/shared/ui/dropdown', () => ({
      default: defineComponent({
        name: 'Dropdown',
        props: { isOpen: Boolean },
        setup(_, { slots }) {
          return () => h('div', { class: 'mock-dropdown' }, slots.default?.())
        },
      }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7List: defineComponent({
        setup(_, { slots }) {
          return () => h('ul', { class: 'mock-f7-list' }, slots.default?.())
        },
      }),
      F7Actions: defineComponent({ setup: () => () => h('div') }),
      F7ActionsGroup: defineComponent({ setup: () => () => h('div') }),
      F7ActionsLabel: defineComponent({ setup: () => () => h('div') }),
      F7ActionsButton: defineComponent({ setup: () => () => h('div') }),
      dialogController: { prompt: vi.fn() },
      alertController: { create: vi.fn() },
    }))
    vi.doMock('framework7-vue', () => ({
      f7ListItem: defineComponent({
        name: 'F7ListItem',
        props: { title: String },
        emits: ['click'],
        setup(props, { emit }) {
          return () => h('li', {
            class: 'mock-f7-list-item',
            onClick: () => emit('click'),
          }, props.title)
        },
      }),
    }))

    const NoteActionsMenu = (await import('@/features/note-actions-menu/ui/note-actions-menu.vue')).default

    const wrapper = mount(NoteActionsMenu, {
      props: {
        id: 'note-1',
        isOpen: true,
        presentation: 'popover',
      },
    })
    await flushPromises()

    const itemTitles = wrapper.findAll('.mock-f7-list-item').map(item => item.text())
    expect(itemTitles).not.toContain('新建备忘录')
    expect(itemTitles).not.toContain('新建文件夹')
    expect(itemTitles).toContain('重命名')
    expect(itemTitles).toContain('移动')
    expect(itemTitles).toContain('删除')
  })
})
