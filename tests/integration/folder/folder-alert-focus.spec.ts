import type { Note } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { NOTE_TYPE } from '@/types'

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
    useRoute: () => route,
  }))

  vi.doMock('@/hooks/useDeviceType', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(isDesktop),
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

  vi.doMock('@/hooks/useDesktopActiveNote', () => ({
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

  vi.doMock('@/stores', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref(notes),
        addNote: addNoteMock,
        getFolderTreeByParentId: getFolderTreeByParentIdMock,
      }),
    }
  })

  vi.doMock('@/components/DarkModeToggle.vue', () => ({ default: genericStub }))
  vi.doMock('@/components/ExtensionRenderer.vue', () => ({ default: genericStub }))
  vi.doMock('@/components/GlobalSearch/GlobalSearch.vue', () => ({ default: genericStub }))
  vi.doMock('@/components/NoteList.vue', () => ({ default: noteListStub }))
  vi.doMock('@/components/UserProfile.vue', () => ({ default: genericStub }))
  vi.doMock('@/views/DeletedPage.vue', () => ({ default: genericStub }))
  vi.doMock('@/views/FolderPage.vue', () => ({ default: genericStub }))
  vi.doMock('@/views/NoteDetail.vue', () => ({ default: genericStub }))

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

  const HomePage = (await import('@/views/HomePage.vue')).default
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
  vi.doUnmock('@/views/FolderPage.vue')

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
    useRoute: () => route,
  }))

  vi.doMock('@/hooks/useDeviceType', async () => {
    const { ref } = await import('vue')
    return {
      useDeviceType: () => ({
        isDesktop: ref(true),
      }),
    }
  })

  vi.doMock('@/hooks/useSmartBackButton', () => ({
    useFolderBackButton: () => ({
      backButtonProps: {},
    }),
  }))

  vi.doMock('@/stores', async () => {
    const { ref } = await import('vue')
    return {
      useNote: () => ({
        notes: ref([]),
        addNote: addNoteMock,
        getNote: getNoteMock,
        getFolderTreeByParentId: getFolderTreeByParentIdMock,
      }),
      useUserPublicNotes: () => ({
        getPublicNote: vi.fn(() => null),
      }),
    }
  })

  vi.doMock('@/components/NoteList.vue', () => ({ default: noteListStub }))

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

  const FolderPage = (await import('@/views/FolderPage.vue')).default
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
    expect(alert.props('trigger')).toBe('add-folder')
    expect(alert.props('keyboardClose')).toBe(false)

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
