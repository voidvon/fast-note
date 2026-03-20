import type { Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

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

const NoteUnlockPanelStub = defineComponent({
  name: 'NoteUnlockPanel',
  props: {
    biometricEnabled: {
      type: Boolean,
      default: false,
    },
    cooldownUntil: {
      type: Number,
      default: null,
    },
    deviceSupportsBiometric: {
      type: Boolean,
      default: false,
    },
    errorMessage: {
      type: String,
      default: '',
    },
    failedAttempts: {
      type: Number,
      default: 0,
    },
    isSubmitting: {
      type: Boolean,
      default: false,
    },
    lockViewState: {
      type: String,
      default: 'locked',
    },
  },
  emits: ['submit-pin', 'try-biometric'],
  setup(props, { emit }) {
    const pin = ref('')

    return () => h('div', { 'data-testid': 'note-unlock-panel' }, [
      h('h2', '备忘录已锁定'),
      h('p', '输入备忘录密码以查看'),
      props.biometricEnabled && props.deviceSupportsBiometric
        ? h('button', {
            'disabled': props.isSubmitting,
            'data-testid': 'note-unlock-panel-biometric',
            'type': 'button',
            'onClick': () => emit('try-biometric'),
          }, '尝试生物识别')
        : null,
      h('input', {
        'data-testid': 'note-unlock-panel-pin',
        'placeholder': '输入密码',
        'type': 'password',
        'value': pin.value,
        'onInput': (event: Event) => {
          pin.value = (event.target as HTMLInputElement).value
        },
      }),
      props.errorMessage || props.failedAttempts
        ? h('div', { 'data-testid': 'note-unlock-panel-message' }, props.errorMessage || `已连续失败 ${props.failedAttempts} 次`)
        : null,
      h('button', {
        'data-testid': 'note-unlock-panel-submit',
        'type': 'button',
        'onClick': () => emit('submit-pin', pin.value),
      }, '解锁'),
    ])
  },
})

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
  lockViewState?: 'unlocked' | 'locked' | 'unlocking' | 'cooldown'
  isPinLockNote?: boolean
  route?: {
    params?: Record<string, unknown>
    query?: Record<string, unknown>
  }
  notesById?: Record<string, Note | null>
  getNoteImpl?: (id: string) => Promise<Note | null>
  updateNoteImpl?: (id: string, note: Note) => Promise<unknown>
  addNoteImpl?: (note: Note) => Promise<unknown>
  deleteNoteImpl?: (id: string) => Promise<unknown>
  getLockViewStateImpl?: (noteId: string, note?: Note | null) => Promise<{
    viewState: 'unlocked' | 'locked' | 'unlocking' | 'cooldown'
    failedAttempts: number
    cooldownUntil: number | null
    biometricEnabled: boolean
    deviceSupportsBiometric: boolean
    session: null
  }>
  syncImpl?: (silent?: boolean) => Promise<unknown>
  manualSyncImpl?: () => Promise<unknown>
  verifyPinImpl?: (noteId: string, pin: string) => Promise<{
    ok: boolean
    code: string
    message: string | null
    failedAttempts: number
    cooldownUntil: number | null
  }>
  tryBiometricUnlockImpl?: (noteId: string, note?: Note | null) => Promise<{
    ok: boolean
    code: string
    message: string | null
    failedAttempts: number
    cooldownUntil: number | null
  }>
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
  const getLockViewStateMock = vi.fn(options.getLockViewStateImpl ?? (async () => ({
    viewState: options.lockViewState ?? 'unlocked',
    failedAttempts: 0,
    cooldownUntil: null,
    biometricEnabled: false,
    deviceSupportsBiometric: false,
    session: null,
  })))
  const toastDismissMock = vi.fn(async () => undefined)
  const verifyPinMock = vi.fn(options.verifyPinImpl ?? (async () => ({
    ok: true,
    code: 'ok',
    message: null,
    failedAttempts: 0,
    cooldownUntil: null,
  })))
  const tryBiometricUnlockMock = vi.fn(options.tryBiometricUnlockImpl ?? (async () => ({
    ok: true,
    code: 'ok',
    message: null,
    failedAttempts: 0,
    cooldownUntil: null,
  })))
  let ionViewWillLeaveCallback: (() => void | Promise<void>) | null = null
  let ionViewDidLeaveCallback: (() => void | Promise<void>) | null = null
  const toastPresentMock = vi.fn(async () => undefined)
  const toastCreateMock = vi.fn(async () => ({
    present: toastPresentMock,
  }))

  const editorApi = {
    applyDefaultNewNoteHeading: vi.fn(() => true),
    isMeaningfulContent: vi.fn(() => true),
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

  vi.doMock('@/entities/note', async () => {
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
    }
  })

  vi.doMock('@/entities/public-note', () => ({
    useUserPublicNotes: () => ({
      getPublicNote: vi.fn(() => null),
    }),
  }))

  vi.doMock('@/shared/lib/device', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(options.isDesktop ?? false),
      }),
    }
  })

  vi.doMock('@/processes/navigation', () => ({
    useNoteBackButton: () => ({ backButtonProps: {} }),
  }))

  vi.doMock('@/processes/sync-notes', () => ({
    useSync: () => ({
      sync: syncMock,
    }),
  }))

  vi.doMock('@/shared/lib/viewport', () => ({
    useVisualViewport: () => ({
      restoreHeight: restoreHeightMock,
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

  vi.doMock('@/features/note-lock', async () => {
    const actual = await vi.importActual<typeof import('@/features/note-lock')>('@/features/note-lock')

    return {
      ...actual,
      NoteUnlockPanel: NoteUnlockPanelStub,
      useNoteLock: () => ({
        getLockViewState: getLockViewStateMock,
        isBiometricSupported: vi.fn(() => false),
        isPinLockNote: vi.fn((note?: Note | null) => {
          if (typeof options.isPinLockNote === 'boolean')
            return options.isPinLockNote
          return note?.is_locked === 1
        }),
        tryBiometricUnlock: tryBiometricUnlockMock,
        verifyPin: verifyPinMock,
      }),
    }
  })

  vi.doMock('vue-router', () => ({
    useRoute: () => route,
    useRouter: () => ({
      replace: routerReplaceMock,
    }),
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
    onIonViewDidLeave: (callback: () => void | Promise<void>) => {
      ionViewDidLeaveCallback = callback
    },
    onIonViewWillLeave: (callback: () => void | Promise<void>) => {
      ionViewWillLeaveCallback = callback
    },
    toastController: {
      dismiss: toastDismissMock,
      create: toastCreateMock,
    },
  }))

  const NoteDetail = (await import('@/pages/note-detail/ui/note-detail-page.vue')).default
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
      getLockViewStateMock,
      toastCreateMock,
      toastDismissMock,
      toastPresentMock,
      updateNoteMock,
      updateParentFolderSubcountMock,
      tryBiometricUnlockMock,
      verifyPinMock,
    },
    noteFactory: makeNote,
    triggerIonViewWillLeave: async () => {
      await ionViewWillLeaveCallback?.()
      await flushPromises()
      await nextTick()
    },
    triggerIonViewDidLeave: async () => {
      await ionViewDidLeaveCallback?.()
      await flushPromises()
      await nextTick()
    },
  }
}
