import type { Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import FolderPage from '@/pages/folder/ui/folder-page.vue'
import { NOTE_TYPE } from '@/shared/types'

const {
  addNoteMock,
  getFolderTreeByParentIdMock,
  getNoteMock,
  isDesktopMock,
  promptFolderNameMock,
  routeMock,
} = vi.hoisted(() => ({
  addNoteMock: vi.fn(),
  getFolderTreeByParentIdMock: vi.fn(() => []),
  getNoteMock: vi.fn(),
  isDesktopMock: { value: true },
  promptFolderNameMock: vi.fn(),
  routeMock: { value: {
    params: {},
    path: '/home',
  } },
}))

vi.mock('@/features/note-write', () => ({
  promptFolderName: promptFolderNameMock,
}))

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRoute: () => routeMock.value,
}))

vi.mock('@/shared/lib/device', () => ({
  useDeviceType: () => ({
    isDesktop: isDesktopMock,
  }),
}))

vi.mock('@/processes/navigation', () => ({
  useFolderBackButton: () => ({
    backButtonProps: {},
  }),
  useRouteStateRestore: () => ({
    resolveFolderEnterMode: vi.fn(() => 'restore'),
    shouldSaveFolderLeave: vi.fn(() => true),
  }),
}))

vi.mock('@/entities/note', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/note')>()
  return {
    ...actual,
    useNote: () => ({
      notes: ref<Note[]>([]),
      addNote: addNoteMock,
      getNote: getNoteMock,
      getFolderTreeByParentId: getFolderTreeByParentIdMock,
    }),
  }
})

vi.mock('@/entities/public-note', () => ({
  useUserPublicNotes: () => ({
    getPublicNote: vi.fn(),
  }),
}))

const F7ButtonStub = defineComponent({
  name: 'F7Button',
  emits: ['click'],
  setup(_, { emit, slots, attrs }) {
    return () => h('button', {
      ...attrs,
      type: 'button',
      onClick: (event: MouseEvent) => emit('click', event),
    }, slots.default?.())
  },
})

const genericStub = defineComponent({
  name: 'GenericStub',
  setup(_, { slots }) {
    return () => h('div', slots.default?.())
  },
})

const NoteListStub = defineComponent({
  name: 'NoteList',
  setup() {
    return () => h('div', { 'data-testid': 'note-list' })
  },
})

function mountFolderPage() {
  return mount(FolderPage, {
    props: {
      currentFolder: 'folder-1',
      selectedNoteId: '',
    },
    global: {
      stubs: {
        F7BackButton: genericStub,
        F7Button: F7ButtonStub,
        F7Buttons: genericStub,
        F7Content: genericStub,
        F7Footer: genericStub,
        F7Header: genericStub,
        F7Icon: genericStub,
        F7Page: genericStub,
        F7Title: genericStub,
        F7Toolbar: genericStub,
        NoteList: NoteListStub,
      },
    },
  })
}

describe('folderPage desktop add-folder alert regression', () => {
  beforeEach(() => {
    routeMock.value = {
      params: {},
      path: '/home',
    }
    isDesktopMock.value = true
    addNoteMock.mockReset()
    promptFolderNameMock.mockReset()
    promptFolderNameMock.mockResolvedValue('项目资料')
    getFolderTreeByParentIdMock.mockClear()
    getNoteMock.mockReset()
    getNoteMock.mockResolvedValue({
      id: 'folder-1',
      title: '测试文件夹',
      created: '2026-03-06 17:00:00',
      updated: '2026-03-06 17:00:00',
      content: '',
      item_type: NOTE_TYPE.FOLDER,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
    } satisfies Note)
  })

  it('creates a folder from the Framework7 prompt dialog', async () => {
    const wrapper = mountFolderPage()
    await flushPromises()

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    await buttons[0].trigger('click')
    await flushPromises()

    expect(promptFolderNameMock).toHaveBeenCalledTimes(1)
    expect(addNoteMock).toHaveBeenCalledWith(expect.objectContaining({
      title: '项目资料',
      parent_id: 'folder-1',
      item_type: NOTE_TYPE.FOLDER,
    }))
  })
})
