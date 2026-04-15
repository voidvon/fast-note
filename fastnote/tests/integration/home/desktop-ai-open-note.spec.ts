import type { Note } from '@/shared/types'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { makeNote } from '../../factories/note.factory'

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

function createPlainStub(name: string) {
  return defineComponent({
    name,
    template: `<div class="${name}-stub" />`,
  })
}

const folderPageStub = defineComponent({
  name: 'FolderPage',
  props: {
    currentFolder: { type: String, default: '' },
    selectedNoteId: { type: String, default: '' },
  },
  template: '<div class="folder-page-stub" />',
})

const noteDetailStub = defineComponent({
  name: 'NoteDetail',
  props: {
    noteId: { type: String, default: '' },
    parentId: { type: String, default: '' },
  },
  template: '<div class="note-detail-stub" />',
})

const globalSearchStub = defineComponent({
  name: 'GlobalSearch',
  emits: ['open-folder', 'open-note'],
  setup(_, { emit, slots }) {
    return () => h('div', { class: 'global-search-stub' }, [
      slots.leading ? slots.leading({ panelVisible: false }) : null,
      h('button', {
        class: 'global-search-open-folder',
        type: 'button',
        onClick: () => emit('open-folder', {
          folderId: 'folder-1',
          parentId: '',
        }),
      }, 'open-folder'),
      h('button', {
        class: 'global-search-open-note',
        type: 'button',
        onClick: () => emit('open-note', {
          noteId: 'note-b',
          parentId: 'folder-1',
          isDeleted: false,
        }),
      }, 'open-note'),
      slots.trailing ? slots.trailing({ panelVisible: false }) : null,
    ])
  },
})

describe('desktop ai open note', () => {
  it('opens the selected note from ai card action in desktop mode', async () => {
    vi.resetModules()
    localStorage.clear()

    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 08:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })
    const allNotes: Note[] = [folder, noteA, noteB]

    vi.doMock('@/entities/note', async () => {
      const { ref } = await import('vue')
      return {
        useNote: () => ({
          notes: ref(allNotes),
          addNote: vi.fn(async (note: Note) => note),
          getFolderTreeByParentId: vi.fn(() => []),
        }),
      }
    })

    vi.doMock('@/processes/session/model/auth-manager', async () => {
      const { computed, ref } = await import('vue')
      const currentUser = ref({ id: 'user-1' })

      return {
        authManager: {
          userInfo: computed(() => currentUser.value),
        },
      }
    })

    vi.doMock('@/shared/lib/device', async () => {
      const { ref } = await import('vue')
      return {
        useDeviceType: () => ({
          isDesktop: ref(true),
        }),
      }
    })

    vi.doMock('@/features/global-search', async () => {
      const { ref } = await import('vue')
      return {
        default: globalSearchStub,
        useGlobalSearch: () => ({
          showGlobalSearch: ref(false),
        }),
      }
    })

    vi.doMock('@/features/extension-manager', () => ({
      useExtensions: () => ({
        isExtensionEnabled: () => false,
        getExtensionModule: () => null,
      }),
    }))

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          path: '/home',
          fullPath: '/home',
          params: {},
          query: {},
        }),
        useRouter: () => ({
          replace: vi.fn(),
          push: vi.fn(),
        }),
      }
    })

    vi.doMock('@/features/theme-switch', () => ({
      default: createPlainStub('DarkModeToggle'),
    }))
    vi.doMock('@/widgets/extension-renderer', () => ({
      default: createPlainStub('ExtensionRenderer'),
    }))
    vi.doMock('@/widgets/note-list', () => ({
      default: createPlainStub('NoteList'),
    }))
    vi.doMock('@/widgets/user-profile', () => ({
      default: createPlainStub('UserProfile'),
    }))
    vi.doMock('@/widgets/deleted-note-list', () => ({
      default: createPlainStub('DeletedNoteList'),
    }))
    vi.doMock('@/widgets/folder-browser', () => ({
      default: folderPageStub,
    }))
    vi.doMock('@/widgets/note-detail-pane', () => ({
      default: noteDetailStub,
    }))

    vi.doMock('@ionic/vue', async () => {
      const { onMounted } = await import('vue')

      return {
        IonAlert: createIonicStub('IonAlert'),
        IonContent: createIonicStub('IonContent'),
        IonHeader: createIonicStub('IonHeader'),
        IonIcon: createIonicStub('IonIcon'),
        IonPage: createIonicStub('IonPage'),
        IonRefresher: createIonicStub('IonRefresher'),
        IonRefresherContent: createIonicStub('IonRefresherContent'),
        IonTitle: createIonicStub('IonTitle'),
        IonToolbar: createIonicStub('IonToolbar'),
        onIonViewWillEnter: (callback: () => void) => onMounted(callback),
      }
    })

    const HomePage = (await import('@/pages/home/ui/home-page.vue')).default
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await nextTick()
    await nextTick()

    await wrapper.get('button.global-search-open-note').trigger('click')
    await nextTick()
    await nextTick()

    const folderPage = wrapper.findComponent(folderPageStub)
    const noteDetail = wrapper.findComponent(noteDetailStub)

    expect(folderPage.props('currentFolder')).toBe('folder-1')
    expect(folderPage.props('selectedNoteId')).toBe('note-b')
    expect(noteDetail.props('noteId')).toBe('note-b')
  })

  it('switches to the selected folder from ai card action in desktop mode', async () => {
    vi.resetModules()
    localStorage.clear()

    const folder = makeNote({ id: 'folder-1', item_type: NOTE_TYPE.FOLDER })
    const noteA = makeNote({ id: 'note-a', updated: '2026-03-06 08:00:00' })
    const noteB = makeNote({ id: 'note-b', parent_id: 'folder-1', updated: '2026-03-06 10:00:00' })
    const allNotes: Note[] = [folder, noteA, noteB]

    vi.doMock('@/entities/note', async () => {
      const { ref } = await import('vue')
      return {
        useNote: () => ({
          notes: ref(allNotes),
          addNote: vi.fn(async (note: Note) => note),
          getFolderTreeByParentId: vi.fn(() => []),
        }),
      }
    })

    vi.doMock('@/processes/session/model/auth-manager', async () => {
      const { computed, ref } = await import('vue')
      const currentUser = ref({ id: 'user-1' })

      return {
        authManager: {
          userInfo: computed(() => currentUser.value),
        },
      }
    })

    vi.doMock('@/shared/lib/device', async () => {
      const { ref } = await import('vue')
      return {
        useDeviceType: () => ({
          isDesktop: ref(true),
        }),
      }
    })

    vi.doMock('@/features/global-search', async () => {
      const { ref } = await import('vue')
      return {
        default: globalSearchStub,
        useGlobalSearch: () => ({
          showGlobalSearch: ref(false),
        }),
      }
    })

    vi.doMock('@/features/extension-manager', () => ({
      useExtensions: () => ({
        isExtensionEnabled: () => false,
        getExtensionModule: () => null,
      }),
    }))

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          path: '/home',
          fullPath: '/home',
          params: {},
          query: {},
        }),
        useRouter: () => ({
          replace: vi.fn(),
          push: vi.fn(),
        }),
      }
    })

    vi.doMock('@/features/theme-switch', () => ({
      default: createPlainStub('DarkModeToggle'),
    }))
    vi.doMock('@/widgets/extension-renderer', () => ({
      default: createPlainStub('ExtensionRenderer'),
    }))
    vi.doMock('@/widgets/note-list', () => ({
      default: createPlainStub('NoteList'),
    }))
    vi.doMock('@/widgets/user-profile', () => ({
      default: createPlainStub('UserProfile'),
    }))
    vi.doMock('@/widgets/deleted-note-list', () => ({
      default: createPlainStub('DeletedNoteList'),
    }))
    vi.doMock('@/widgets/folder-browser', () => ({
      default: folderPageStub,
    }))
    vi.doMock('@/widgets/note-detail-pane', () => ({
      default: noteDetailStub,
    }))

    vi.doMock('@ionic/vue', async () => {
      const { onMounted } = await import('vue')

      return {
        IonAlert: createIonicStub('IonAlert'),
        IonContent: createIonicStub('IonContent'),
        IonHeader: createIonicStub('IonHeader'),
        IonIcon: createIonicStub('IonIcon'),
        IonPage: createIonicStub('IonPage'),
        IonRefresher: createIonicStub('IonRefresher'),
        IonRefresherContent: createIonicStub('IonRefresherContent'),
        IonTitle: createIonicStub('IonTitle'),
        IonToolbar: createIonicStub('IonToolbar'),
        onIonViewWillEnter: (callback: () => void) => onMounted(callback),
      }
    })

    const HomePage = (await import('@/pages/home/ui/home-page.vue')).default
    const wrapper = mount(HomePage, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    await nextTick()
    await nextTick()

    await wrapper.get('button.global-search-open-folder').trigger('click')
    await nextTick()
    await nextTick()

    const folderPage = wrapper.findComponent(folderPageStub)
    const noteDetail = wrapper.findComponent(noteDetailStub)

    expect(folderPage.props('currentFolder')).toBe('folder-1')
    expect(folderPage.props('selectedNoteId')).toBe('')
    expect(noteDetail.props('noteId')).toBe('')
  })
})
