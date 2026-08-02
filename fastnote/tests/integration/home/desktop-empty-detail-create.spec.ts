import type { Note } from '@/shared/types'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, watch } from 'vue'
import { getDesktopActiveNoteStorageKey } from '@/processes/navigation'

function createF7Stub(name: string) {
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
    getDesktopNoteRoutePath: (noteId: string, parentId = '') => {
      return parentId ? `/n/${noteId}?parent_id=${parentId}` : `/n/${noteId}`
    },
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
    useLastVisitedRoute: () => ({
      saveVisitedRoute: vi.fn(),
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
  vi.doMock('@/widgets/folder-browser', () => ({
    default: folderPageStub,
  }))
  vi.doMock('@/widgets/note-detail-pane', () => ({
    default: NoteDetailStub,
  }))

  vi.doMock('@/shared/ui/f7', async () => {
    const { onMounted, onUnmounted } = await import('vue')

    return {
      F7Alert: createF7Stub('F7Alert'),
      F7BackButton: createF7Stub('F7BackButton'),
      F7Button: createF7Stub('F7Button'),
      F7Buttons: createF7Stub('F7Buttons'),
      F7Footer: createF7Stub('F7Footer'),
      F7Icon: createF7Stub('F7Icon'),
      F7Navbar: createF7Stub('F7Navbar'),
      F7Page: createF7Stub('F7Page'),
      F7PageContent: createF7Stub('F7PageContent'),
      F7Refresher: createF7Stub('F7Refresher'),
      F7RefresherContent: createF7Stub('F7RefresherContent'),
      F7Toast: createF7Stub('F7Toast'),
      isPlatform: () => false,
      onF7ViewWillEnter: (callback: () => void) => onMounted(callback),
      onF7ViewWillLeave: () => {},
      onF7ViewDidLeave: (callback: () => void) => onUnmounted(callback),
      useAppRouter: () => ({
        back: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
      }),
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
