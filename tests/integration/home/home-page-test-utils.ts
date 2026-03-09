import type { Note } from '@/types'
import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { getDesktopActiveNoteStorageKey } from '@/hooks/useDesktopActiveNote'

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

  vi.doMock('@/stores', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(options.notes),
        addNote: vi.fn(async (note: Note) => note),
        getFolderTreeByParentId: vi.fn(() => []),
      }),
    }
  })

  vi.doMock('@/core/auth-manager', async () => {
    const { computed, ref } = await import('vue')
    const currentUser = ref(options.userId ? { id: options.userId } : null)

    return {
      authManager: {
        userInfo: computed(() => currentUser.value),
      },
    }
  })

  vi.doMock('@/hooks/useDeviceType', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(true),
      }),
    }
  })

  vi.doMock('@/components/GlobalSearch/useGlobalSearch', async () => {
    const { ref } = await import('vue')
    return {
      useGlobalSearch: () => ({
        showGlobalSearch: ref(false),
      }),
    }
  })

  vi.doMock('@/hooks/useExtensions', () => ({
    useExtensions: () => ({
      isExtensionEnabled: () => false,
      getExtensionModule: () => null,
    }),
  }))

  vi.doMock('@/components/DarkModeToggle.vue', () => ({
    default: createPlainStub('DarkModeToggle'),
  }))
  vi.doMock('@/components/ExtensionRenderer.vue', () => ({
    default: createPlainStub('ExtensionRenderer'),
  }))
  vi.doMock('@/components/GlobalSearch/GlobalSearch.vue', () => ({
    default: createPlainStub('GlobalSearch'),
  }))
  vi.doMock('@/components/NoteList.vue', () => ({
    default: createPlainStub('NoteList'),
  }))
  vi.doMock('@/components/UserProfile.vue', () => ({
    default: createPlainStub('UserProfile'),
  }))
  vi.doMock('@/views/DeletedPage.vue', () => ({
    default: createPlainStub('DeletedPage'),
  }))
  vi.doMock('@/views/FolderPage.vue', () => ({
    default: folderPageStub,
  }))
  vi.doMock('@/views/NoteDetail.vue', () => ({
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

  const HomePage = (await import('@/views/HomePage.vue')).default
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
