import type { Note } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { NOTE_TYPE } from '@/types'

function createIonicStub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createPlainStub(name: string) {
  return defineComponent({
    name,
    template: `<div class="${name}-stub" />`,
  })
}

function createButtonStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { attrs, slots, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, slots.default ? slots.default() : [])
    },
  })
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    resolve,
    reject,
  }
}

function makeNote(id: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title: '测试备忘录',
    summary: '测试摘要',
    content: '<p>旧内容</p>',
    created: '2026-03-08 10:00:00',
    updated: '2026-03-08 10:00:00',
    item_type: NOTE_TYPE.NOTE,
    parent_id: '',
    is_deleted: 0,
    is_locked: 0,
    note_count: 0,
    version: 1,
    files: [],
    ...overrides,
  }
}

export async function mountNoteDetailForSaveTest(options: {
  noteId?: string
  parentId?: string
  isDesktop?: boolean
  route?: {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
  }
  notesById?: Record<string, Note | null>
  getNoteImpl?: (id: string) => Promise<Note | null>
  updateNoteImpl?: (id: string, note: Note) => Promise<unknown>
  addNoteImpl?: (note: Note) => Promise<unknown>
  deleteNoteImpl?: (id: string) => Promise<unknown>
  syncImpl?: (silent?: boolean) => Promise<unknown>
  manualSyncImpl?: () => Promise<unknown>
} = {}) {
  vi.resetModules()

  const noteId = options.noteId ?? 'note-1'
  const notesById = options.notesById ?? {
    [noteId]: makeNote(noteId),
  }

  const route = {
    params: options.route?.params ?? {},
    query: options.route?.query ?? {},
  }

  const addNoteMock = vi.fn(options.addNoteImpl ?? (async (note: Note) => note))
  const deleteNoteMock = vi.fn(options.deleteNoteImpl ?? (async () => undefined))
  const updateParentFolderSubcountMock = vi.fn()
  const getNoteMock = vi.fn(options.getNoteImpl ?? (async (id: string) => notesById[id] ?? null))
  const updateNoteMock = vi.fn(options.updateNoteImpl ?? (async () => undefined))
  const syncMock = vi.fn(options.syncImpl ?? (async () => null))
  const manualSyncMock = vi.fn(options.manualSyncImpl ?? (async () => null))
  const restoreHeightMock = vi.fn()
  const routerReplaceMock = vi.fn()
  const toastDismissMock = vi.fn(async () => undefined)
  let ionViewWillLeaveCallback: (() => void | Promise<void>) | null = null
  const toastPresentMock = vi.fn(async () => undefined)
  const toastCreateMock = vi.fn(async () => ({
    present: toastPresentMock,
  }))

  const editorApi = {
    setContent: vi.fn(),
    setEditable: vi.fn(),
    focus: vi.fn(),
    getContent: vi.fn(() => notesById[noteId]?.content || ''),
    getTitle: vi.fn(() => ({
      title: notesById[noteId]?.title || '测试备忘录',
      summary: notesById[noteId]?.summary || '测试摘要',
    })),
    insertFiles: vi.fn(),
    setInputMode: vi.fn(),
    editor: {
      chain: () => ({
        focus: () => ({ run: vi.fn() }),
        blur: () => ({ focus: () => ({ run: vi.fn() }) }),
        toggleTaskList: () => ({ run: vi.fn() }),
      }),
    },
  }

  const YYEditorStub = defineComponent({
    name: 'YYEditor',
    emits: ['blur'],
    setup(_, { expose }) {
      expose(editorApi)
      return () => h('div', {
        class: 'yy-editor-stub',
        tabindex: '-1',
      })
    },
  })

  vi.doMock('@/stores', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(Object.values(notesById).filter(Boolean)),
        addNote: addNoteMock,
        getNote: getNoteMock,
        updateNote: updateNoteMock,
        deleteNote: deleteNoteMock,
        updateParentFolderSubcount: updateParentFolderSubcountMock,
        getNotesSync: () => ({
          manualSync: manualSyncMock,
        }),
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
        isDesktop: ref(options.isDesktop ?? false),
      }),
    }
  })

  vi.doMock('@/hooks/useSmartBackButton', () => ({
    useNoteBackButton: () => ({ backButtonProps: {} }),
  }))

  vi.doMock('@/hooks/useSync', () => ({
    useSync: () => ({
      sync: syncMock,
    }),
  }))

  vi.doMock('@/hooks/useVisualViewport', () => ({
    useVisualViewport: () => ({
      restoreHeight: restoreHeightMock,
    }),
  }))

  vi.doMock('@/hooks/useWebAuthn', () => ({
    useWebAuthn: () => ({
      state: { isRegistered: false },
      verify: vi.fn(async () => true),
      register: vi.fn(async () => true),
    }),
  }))

  vi.doMock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
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

  vi.doMock('@ionic/vue', async () => ({
    IonBackButton: createIonicStub('IonBackButton'),
    IonButton: createButtonStub('IonButton'),
    IonButtons: createIonicStub('IonButtons'),
    IonContent: createIonicStub('IonContent'),
    IonFooter: createIonicStub('IonFooter'),
    IonHeader: createIonicStub('IonHeader'),
    IonIcon: createIonicStub('IonIcon'),
    IonPage: createIonicStub('IonPage'),
    IonSpinner: createIonicStub('IonSpinner'),
    IonToolbar: createIonicStub('IonToolbar'),
    isPlatform: () => false,
    onIonViewWillLeave: (callback: () => void | Promise<void>) => {
      ionViewWillLeaveCallback = callback
    },
    toastController: {
      dismiss: toastDismissMock,
      create: toastCreateMock,
    },
  }))

  const NoteDetail = (await import('@/views/NoteDetail.vue')).default
  const wrapper = mount(NoteDetail, {
    props: {
      noteId,
      parentId: options.parentId ?? '',
    },
    global: {
      stubs: {
        Transition: false,
      },
    },
  })

  await flushPromises()
  await nextTick()
  await nextTick()

  return {
    wrapper,
    editorApi,
    mocks: {
      addNoteMock,
      deleteNoteMock,
      getNoteMock,
      routerReplaceMock,
      restoreHeightMock,
      manualSyncMock,
      syncMock,
      toastCreateMock,
      toastDismissMock,
      toastPresentMock,
      updateNoteMock,
      updateParentFolderSubcountMock,
    },
    noteFactory: makeNote,
    triggerIonViewWillLeave: async () => {
      await ionViewWillLeaveCallback?.()
      await flushPromises()
      await nextTick()
    },
  }
}
