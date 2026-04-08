import type { Note } from '@/shared/types'
import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { getDesktopActiveNoteStorageKey } from '@/processes/navigation'

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

function createFolderPageStub() {
  return defineComponent({
    name: 'FolderPage',
    props: {
      currentFolder: { type: String, default: '' },
      selectedNoteId: { type: String, default: '' },
    },
    template: '<div class="folder-page-stub" />',
  })
}

function createNoteDetailStub() {
  return defineComponent({
    name: 'NoteDetail',
    props: {
      noteId: { type: String, default: '' },
      parentId: { type: String, default: '' },
    },
    template: '<div class="note-detail-stub" />',
  })
}

export async function mountHomePageForDesktopRestore(options: {
  notes: Note[]
  userId?: string | null
  snapshot?: {
    folderId: string
    noteId: string
    parentId?: string
  }
  snapshots?: Array<{
    userId?: string | null
    folderId: string
    noteId: string
    parentId?: string
  }>
}) {
  vi.resetModules()
  localStorage.clear()

  const scopedSnapshots = options.snapshots ?? (options.snapshot
    ? [{
        userId: options.userId ?? null,
        ...options.snapshot,
      }]
    : [])

  for (const snapshot of scopedSnapshots) {
    localStorage.setItem(getDesktopActiveNoteStorageKey(snapshot.userId), JSON.stringify({
      folderId: snapshot.folderId,
      noteId: snapshot.noteId,
      parentId: snapshot.parentId || '',
      savedAt: Date.now(),
    }))
  }

  const folderPageStub = createFolderPageStub()
  const noteDetailStub = createNoteDetailStub()

  vi.doMock('@/entities/note', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(options.notes),
        addNote: vi.fn(async (note: Note) => note),
        getFolderTreeByParentId: vi.fn(() => []),
      }),
    }
  })

  vi.doMock('@/processes/session/model/auth-manager', async () => {
    const { computed, ref } = await import('vue')
    const currentUser = ref(options.userId ? { id: options.userId } : null)

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
      default: createPlainStub('GlobalSearch'),
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
  vi.doMock('@/pages/deleted/ui/deleted-page.vue', () => ({
    default: createPlainStub('DeletedPage'),
  }))
  vi.doMock('@/pages/folder/ui/folder-page.vue', () => ({
    default: folderPageStub,
  }))
  vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({
    default: noteDetailStub,
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
      IonButton: createIonicStub('IonButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonContent: createIonicStub('IonContent'),
      IonFooter: createIonicStub('IonFooter'),
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
        ExtensionRenderer: true,
        GlobalSearch: true,
        NoteList: true,
        UserProfile: true,
        DeletedPage: true,
        FolderPage: folderPageStub,
        NoteDetail: noteDetailStub,
      },
    },
  })

  await nextTick()
  await nextTick()

  return {
    wrapper,
    getFolderPage: () => wrapper.findComponent(folderPageStub),
    getNoteDetail: () => wrapper.findComponent(noteDetailStub),
  }
}
