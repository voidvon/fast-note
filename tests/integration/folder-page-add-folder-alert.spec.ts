import type { Note } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { NOTE_TYPE } from '@/types'
import FolderPage from '@/views/FolderPage.vue'

const routeMock = ref({
  params: {},
  path: '/home',
})

const isDesktopMock = ref(true)
const getNoteMock = vi.fn()
const getFolderTreeByParentIdMock = vi.fn(() => [])
const addNoteMock = vi.fn()

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
  useRoute: () => routeMock.value,
}))

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({
    isDesktop: isDesktopMock,
  }),
}))

vi.mock('@/hooks/useSmartBackButton', () => ({
  useFolderBackButton: () => ({
    backButtonProps: {},
  }),
}))

vi.mock('@/stores', () => ({
  useNote: () => ({
    notes: ref<Note[]>([]),
    addNote: addNoteMock,
    getNote: getNoteMock,
    getFolderTreeByParentId: getFolderTreeByParentIdMock,
  }),
  useUserPublicNotes: () => ({
    getPublicNote: vi.fn(),
  }),
}))

const IonButtonStub = defineComponent({
  name: 'IonButton',
  emits: ['click'],
  setup(_, { emit, slots, attrs }) {
    return () => h('button', {
      ...attrs,
      type: 'button',
      onClick: (event: MouseEvent) => emit('click', event),
    }, slots.default?.())
  },
})

const IonAlertStub = defineComponent({
  name: 'IonAlert',
  props: {
    isOpen: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['did-dismiss'],
  setup(props) {
    return () => h('div', {
      'data-testid': 'folder-add-alert',
      'data-open': String(props.isOpen),
    })
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
        IonAlert: IonAlertStub,
        IonBackButton: genericStub,
        IonButton: IonButtonStub,
        IonButtons: genericStub,
        IonContent: genericStub,
        IonFooter: genericStub,
        IonHeader: genericStub,
        IonIcon: genericStub,
        IonPage: genericStub,
        IonTitle: genericStub,
        IonToolbar: genericStub,
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

  it('opens add-folder alert when desktop footer button is clicked', async () => {
    const wrapper = mountFolderPage()
    await flushPromises()

    const alert = wrapper.get('[data-testid="folder-add-alert"]')
    expect(alert.attributes('data-open')).toBe('false')

    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBeGreaterThan(0)

    await buttons[0].trigger('click')
    await nextTick()

    expect(alert.attributes('data-open')).toBe('true')
  })
})
