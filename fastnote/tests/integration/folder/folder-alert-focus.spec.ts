import type { Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
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

function createPlainStub(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default ? slots.default() : [])
    },
  })
}

function createNoteListStub() {
  return defineComponent({
    name: 'NoteList',
    setup() {
      return () => h('div', { 'data-testid': 'note-list' })
    },
  })
}

function createAlertStub() {
  return defineComponent({
    name: 'IonAlert',
    props: {
      isOpen: {
        type: Boolean,
        default: false,
      },
      trigger: {
        type: String,
        default: '',
      },
      keyboardClose: {
        type: Boolean,
        default: true,
      },
    },
    emits: ['didPresent', 'didDismiss'],
    setup(props) {
      return () => h('div', {
        'data-testid': 'folder-alert',
        'data-open': String(props.isOpen),
        'data-trigger': props.trigger,
        'data-keyboard-close': String(props.keyboardClose),
      })
    },
  })
}

function makeFolderNote(id: string): Note {
  return {
    id,
    title: '测试文件夹',
    created: '2026-03-08 10:00:00',
    updated: '2026-03-08 10:00:00',
    content: '',
    item_type: NOTE_TYPE.FOLDER,
    parent_id: '',
    is_deleted: 0,
    is_locked: 0,
    note_count: 0,
  }
}

function createAlertInput(initialValue = '') {
  const input = document.createElement('input')
  input.className = 'alert-input'
  input.value = initialValue

  const focusSpy = vi.spyOn(input, 'focus')
  const selectionSpy = vi.spyOn(input, 'setSelectionRange')
  const alert = document.createElement('div')
  alert.appendChild(input)

  return {
    alert,
    focusSpy,
    selectionSpy,
  }
}

async function mountHomePageForFolderAlert() {
  vi.resetModules()

  const route = {
    params: {},
    path: '/home',
  }
  const isDesktop = false
  const notes = [] as Note[]
  const addNoteMock = vi.fn(async () => undefined)
  const getFolderTreeByParentIdMock = vi.fn(() => [])
  const saveSnapshotMock = vi.fn()
  const clearSnapshotMock = vi.fn()
  const noteListStub = createNoteListStub()
  const genericStub = createPlainStub('GenericStub')
  const ionAlertStub = createAlertStub()

  vi.doMock('vue-router', () => ({
    onBeforeRouteLeave: vi.fn(),
    useRoute: () => route,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
    }),
  }))

  vi.doMock('@/shared/lib/device', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(isDesktop),
      }),
    }
  })

  vi.doMock('@/features/global-search', async () => {
    const { ref } = await import('vue')
    return {
      default: genericStub,
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
    getDesktopNotesForFolder: () => [],
    isDesktopFolderAvailable: () => true,
    resolveDesktopActiveNoteSelection: () => ({
      folderId: 'allnotes',
      noteId: '',
      parentId: '',
    }),
    useDesktopActiveNote: () => ({
      getSnapshot: () => null,
      saveSnapshot: saveSnapshotMock,
      clearSnapshot: clearSnapshotMock,
    }),
  }))

  vi.doMock('@/entities/note', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(notes),
        addNote: addNoteMock,
        getFolderTreeByParentId: getFolderTreeByParentIdMock,
      }),
    }
  })

  vi.doMock('@/entities/public-note', () => ({
    useUserPublicNotes: () => ({
      getPublicNote: vi.fn(() => null),
    }),
  }))

  vi.doMock('@/features/theme-switch', () => ({ default: genericStub }))
  vi.doMock('@/widgets/extension-renderer', () => ({ default: genericStub }))
  vi.doMock('@/widgets/note-list', () => ({ default: noteListStub }))
  vi.doMock('@/widgets/user-profile', () => ({ default: genericStub }))
  vi.doMock('@/pages/deleted/ui/deleted-page.vue', () => ({ default: genericStub }))
  vi.doMock('@/pages/folder/ui/folder-page.vue', () => ({ default: genericStub }))
  vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({ default: genericStub }))

  vi.doMock('@ionic/vue', async () => {
    const { onMounted } = await import('vue')
    return {
      IonAlert: ionAlertStub,
      IonButton: createButtonStub('IonButton'),
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
      },
    },
  })

  await flushPromises()

  return {
    wrapper,
    ionAlertStub,
  }
}

async function mountFolderPageForAlert() {
  vi.resetModules()
  vi.doUnmock('@/pages/folder/ui/folder-page.vue')

  const route = {
    params: {},
    path: '/home',
  }
  const addNoteMock = vi.fn(async () => undefined)
  const getFolderTreeByParentIdMock = vi.fn(() => [])
  const getNoteMock = vi.fn(async () => makeFolderNote('folder-1'))
  const noteListStub = createNoteListStub()
  const genericStub = createPlainStub('GenericStub')
  const ionAlertStub = createAlertStub()

  vi.doMock('vue-router', () => ({
    onBeforeRouteLeave: vi.fn(),
    useRoute: () => route,
  }))

  vi.doMock('@/shared/lib/device', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(true),
      }),
    }
  })

  vi.doMock('@/processes/navigation', () => ({
    useFolderBackButton: () => ({
      backButtonProps: {},
    }),
    useRouteStateRestore: () => ({
      resolveFolderEnterMode: vi.fn(() => 'restore'),
      shouldSaveFolderLeave: vi.fn(() => true),
    }),
  }))

  vi.doMock('@/entities/note', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref([]),
        addNote: addNoteMock,
        getNote: getNoteMock,
        getFolderTreeByParentId: getFolderTreeByParentIdMock,
      }),
    }
  })

  vi.doMock('@/entities/public-note', () => ({
    useUserPublicNotes: () => ({
      getPublicNote: vi.fn(() => null),
    }),
  }))

  vi.doMock('@/widgets/note-list', () => ({ default: noteListStub }))

  vi.doMock('@ionic/vue', async () => {
    const { onMounted } = await import('vue')
    return {
      IonAlert: ionAlertStub,
      IonBackButton: genericStub,
      IonButton: createButtonStub('IonButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonContent: createIonicStub('IonContent'),
      IonFooter: createIonicStub('IonFooter'),
      IonHeader: createIonicStub('IonHeader'),
      IonIcon: createIonicStub('IonIcon'),
      IonPage: createIonicStub('IonPage'),
      IonTitle: createIonicStub('IonTitle'),
      IonToolbar: createIonicStub('IonToolbar'),
      onIonViewDidEnter: (callback: () => void) => onMounted(callback),
      onIonViewWillEnter: (callback: () => void) => onMounted(callback),
    }
  })

  const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
  const wrapper = mount(FolderPage, {
    props: {
      currentFolder: 'folder-1',
      selectedNoteId: '',
    },
  })

  await flushPromises()

  return {
    wrapper,
    ionAlertStub,
  }
}

describe('folder alert focus regression (t-fn-028 / tc-fn-018, tc-fn-019)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps home add-folder alert keyboard open and focuses the input on present', async () => {
    const { wrapper, ionAlertStub } = await mountHomePageForFolderAlert()
    const alert = wrapper.getComponent(ionAlertStub)

    expect(wrapper.get('#add-folder').exists()).toBe(true)
    expect(alert.props('isOpen')).toBe(false)
    expect(alert.props('keyboardClose')).toBe(false)

    await wrapper.get('#add-folder').trigger('click')
    await nextTick()

    expect(alert.props('isOpen')).toBe(true)

    const { alert: alertElement, focusSpy, selectionSpy } = createAlertInput('首页文件夹')

    alert.vm.$emit('didPresent', { target: alertElement } as CustomEvent)
    vi.advanceTimersByTime(60)
    await nextTick()

    expect(focusSpy).toHaveBeenCalledTimes(1)
    expect(selectionSpy).toHaveBeenCalledWith(5, 5)
  })

  it('keeps folder add-folder alert focus stable across repeated openings', async () => {
    const { wrapper, ionAlertStub } = await mountFolderPageForAlert()
    const alert = wrapper.getComponent(ionAlertStub)
    expect(alert.props('keyboardClose')).toBe(false)
    expect(alert.props('isOpen')).toBe(false)

    const firstOpen = createAlertInput('第一次')
    alert.vm.$emit('didPresent', { target: firstOpen.alert } as CustomEvent)
    vi.advanceTimersByTime(60)
    await nextTick()

    expect(firstOpen.focusSpy).toHaveBeenCalledTimes(1)
    expect(firstOpen.selectionSpy).toHaveBeenCalledWith(3, 3)

    alert.vm.$emit('didDismiss')
    await nextTick()
    expect(alert.props('isOpen')).toBe(false)

    const secondOpen = createAlertInput('第二次打开')
    alert.vm.$emit('didPresent', { target: secondOpen.alert } as CustomEvent)
    vi.advanceTimersByTime(60)
    await nextTick()

    expect(secondOpen.focusSpy).toHaveBeenCalledTimes(1)
    expect(secondOpen.selectionSpy).toHaveBeenCalledWith(5, 5)
  })
})
