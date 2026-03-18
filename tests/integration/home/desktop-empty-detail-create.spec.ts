import type { Note } from '@/shared/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, watch } from 'vue'
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
    localStorage.setItem(getDesktopActiveNoteStorageKey(), JSON.stringify({
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
  const NoteDetailStub = defineComponent({
    name: 'NoteDetailPage',
    props: {
      noteId: { type: String, default: '' },
      parentId: { type: String, default: '' },
    },
    setup(props) {
      async function syncDraftFocus(noteId: string) {
        if (noteId !== '0') {
          return
        }

        await nextTick()
        editorApi.applyDefaultNewNoteHeading()
        editorApi.focus()
      }

      void syncDraftFocus(props.noteId)
      watch(() => props.noteId, noteId => void syncDraftFocus(noteId))

      return () => h('div', { class: 'note-detail-page-stub' }, [
        h(YYEditorStub),
      ])
    },
  })

  vi.doMock('@/entities/note', async () => {
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
      useNoteRepository: () => ({
        getNote: vi.fn(async () => null),
        updateNote: vi.fn(async () => undefined),
        updateParentFolderSubcount: vi.fn(async () => undefined),
      }),
      useUserPublicNotes: () => ({
        getPublicNote: vi.fn(() => null),
      }),
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

  vi.doMock('@/processes/navigation', () => ({
    getDesktopNotesForFolder: () => options.notes,
    isDesktopFolderAvailable: () => true,
    resolveDesktopActiveNoteSelection: () => {
      if (!options.snapshot) {
        return null
      }

      return {
        folderId: options.snapshot.folderId,
        noteId: options.snapshot.noteId,
        parentId: options.snapshot.parentId || '',
      }
    },
    useDesktopActiveNote: () => ({
      getSnapshot: () => options.snapshot
        ? {
            folderId: options.snapshot.folderId,
            noteId: options.snapshot.noteId,
            parentId: options.snapshot.parentId || '',
            savedAt: Date.now(),
          }
        : null,
      saveSnapshot: vi.fn(),
      clearSnapshot: vi.fn(),
    }),
    useNoteBackButton: () => ({ backButtonProps: {} }),
  }))

  vi.doMock('@/processes/sync-notes', () => ({
    useSync: () => ({
      sync: vi.fn(async () => null),
    }),
  }))

  vi.doMock('@/shared/lib/viewport', () => ({
    useVisualViewport: () => ({
      restoreHeight: vi.fn(),
    }),
  }))

  vi.doMock('@/shared/lib/security', () => ({
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
  vi.doMock('@/shared/ui/icon', () => ({
    default: createPlainStub('Icon'),
  }))
  vi.doMock('@/widgets/note-more', () => ({
    default: createPlainStub('NoteMore'),
  }))
  vi.doMock('@/widgets/note-editor-toolbar', () => ({
    default: createPlainStub('NoteEditorToolbar'),
  }))
  vi.doMock('@/widgets/note-editor-toolbar/ui/table-format-modal.vue', () => ({
    default: createPlainStub('TableFormatModal'),
  }))
  vi.doMock('@/widgets/note-editor-toolbar/ui/text-format-modal.vue', () => ({
    default: createPlainStub('TextFormatModal'),
  }))
  vi.doMock('@/widgets/editor', () => ({
    default: YYEditorStub,
  }))
  vi.doMock('@/pages/deleted/ui/deleted-page.vue', () => ({
    default: createPlainStub('DeletedPage'),
  }))
  vi.doMock('@/pages/folder/ui/folder-page.vue', () => ({
    default: folderPageStub,
  }))
  vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({
    default: NoteDetailStub,
  }))

  vi.doMock('@ionic/vue', async () => {
    const { onMounted, onUnmounted } = await import('vue')

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
      onIonViewDidLeave: (callback: () => void) => onUnmounted(callback),
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
