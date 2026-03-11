import type { Note } from '@/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { DESKTOP_ACTIVE_NOTE_STORAGE_KEY } from '@/hooks/useDesktopActiveNote'

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

async function mountHomePageForEmptyDetailCreate(options: {
  notes: Note[]
  snapshot?: {
    folderId: string
    noteId: string
    parentId?: string
  }
}) {
  vi.resetModules()
  vi.useFakeTimers()
  localStorage.clear()

  if (options.snapshot) {
    localStorage.setItem(DESKTOP_ACTIVE_NOTE_STORAGE_KEY, JSON.stringify({
      ...options.snapshot,
      parentId: options.snapshot.parentId || '',
      savedAt: Date.now(),
    }))
  }

  const folderPageStub = createFolderPageStub()
  const editorApi = {
    applyDefaultNewNoteHeading: vi.fn(() => true),
    isMeaningfulContent: vi.fn(() => true),
    setContent: vi.fn(),
    setEditable: vi.fn(),
    focus: vi.fn(),
    getContent: vi.fn(() => ''),
    getTitle: vi.fn(() => ({ title: '', summary: '' })),
    insertFiles: vi.fn(),
    setInputMode: vi.fn(),
    editor: {
      chain: () => ({
        focus: () => ({ run: vi.fn() }),
        blur: () => ({ focus: () => ({ run: vi.fn() }) }),
      }),
    },
  }

  const YYEditorStub = defineComponent({
    name: 'YYEditor',
    setup(_, { expose }) {
      expose(editorApi)
      return () => h('div', { class: 'yy-editor-stub', tabindex: '-1' })
    },
  })

  vi.doMock('@/stores', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(options.notes),
        addNote: vi.fn(async (note: Note) => note),
        getNote: vi.fn(async () => null),
        updateNote: vi.fn(async () => undefined),
        deleteNote: vi.fn(async () => undefined),
        updateParentFolderSubcount: vi.fn(),
        getFolderTreeByParentId: vi.fn(() => []),
      }),
      useUserPublicNotes: () => ({
        getPublicNote: vi.fn(() => null),
      }),
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

  vi.doMock('@/hooks/useSmartBackButton', () => ({
    useNoteBackButton: () => ({ backButtonProps: {} }),
  }))

  vi.doMock('@/hooks/useSync', () => ({
    useSync: () => ({
      sync: vi.fn(async () => null),
    }),
  }))

  vi.doMock('@/hooks/useVisualViewport', () => ({
    useVisualViewport: () => ({
      restoreHeight: vi.fn(),
    }),
  }))

  vi.doMock('@/hooks/useWebAuthn', () => ({
    useWebAuthn: () => ({
      state: { isRegistered: false },
      checkSupport: vi.fn(() => false),
      checkRegistrationStatus: vi.fn(() => false),
      clearLegacyCredential: vi.fn(),
      getLegacyCredential: vi.fn(() => null),
      verify: vi.fn(async () => ({
        ok: true,
        code: 'ok',
        message: null,
      })),
      register: vi.fn(async () => ({
        ok: true,
        code: 'ok',
        message: null,
        credentialId: 'credential-id',
      })),
    }),
  }))

  vi.doMock('vue-router', () => ({
    useRoute: () => ({
      params: {},
      query: {},
    }),
    useRouter: () => ({
      replace: vi.fn(),
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
  vi.doMock('@/components/Icon.vue', () => ({
    default: createPlainStub('Icon'),
  }))
  vi.doMock('@/components/NoteMore.vue', () => ({
    default: createPlainStub('NoteMore'),
  }))
  vi.doMock('@/components/TableFormatModal.vue', () => ({
    default: createPlainStub('TableFormatModal'),
  }))
  vi.doMock('@/components/TextFormatModal.vue', () => ({
    default: createPlainStub('TextFormatModal'),
  }))
  vi.doMock('@/components/YYEditor.vue', () => ({
    default: YYEditorStub,
  }))
  vi.doMock('@/views/DeletedPage.vue', () => ({
    default: createPlainStub('DeletedPage'),
  }))
  vi.doMock('@/views/FolderPage.vue', () => ({
    default: folderPageStub,
  }))

  vi.doMock('@ionic/vue', async () => {
    const { onMounted } = await import('vue')

    return {
      IonAlert: createIonicStub('IonAlert'),
      IonBackButton: createIonicStub('IonBackButton'),
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
      IonToast: createIonicStub('IonToast'),
      IonToolbar: createIonicStub('IonToolbar'),
      isPlatform: () => false,
      onIonViewWillEnter: (callback: () => void) => onMounted(callback),
      onIonViewWillLeave: () => {},
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
      },
    },
  })

  await nextTick()
  await nextTick()

  return {
    wrapper,
    editorApi,
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('desktop empty detail create focus (t-fn-023 / tc-fn-015, tc-fn-016)', () => {
  it('focuses the editor body after clicking the empty detail overlay', async () => {
    const { wrapper, editorApi } = await mountHomePageForEmptyDetailCreate({
      notes: [],
    })

    await wrapper.get('[data-testid="home-empty-detail-create"]').trigger('click')
    await nextTick()
    vi.advanceTimersByTime(120)
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="home-empty-detail-create"]').exists()).toBe(false)
    expect(wrapper.find('.yy-editor-stub').exists()).toBe(true)
    expect(editorApi.applyDefaultNewNoteHeading).toHaveBeenCalledTimes(1)
    expect(editorApi.focus).toHaveBeenCalledTimes(1)
  })

  it('does not render the empty detail overlay when a real note is already selected', async () => {
    const note = {
      id: 'note-a',
      title: 'A',
      summary: '',
      content: 'hello',
      created: '2026-03-06 10:00:00',
      updated: '2026-03-06 10:00:00',
      item_type: 2,
      parent_id: '',
      note_count: 0,
      is_deleted: 0,
      is_locked: 0,
      files: [],
    } as Note

    const { wrapper } = await mountHomePageForEmptyDetailCreate({
      notes: [note],
      snapshot: {
        folderId: 'allnotes',
        noteId: 'note-a',
      },
    })

    expect(wrapper.find('[data-testid="home-empty-detail-create"]').exists()).toBe(false)
  })
})
