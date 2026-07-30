import type { FolderTreeNode } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
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

function createNoteListStub() {
  return defineComponent({
    name: 'NoteList',
    props: {
      noteUuid: { type: String, default: '' },
      dataList: { type: Array, default: () => [] },
      expandedStateKey: { type: String, default: '' },
      showUnfiledNotes: { type: Boolean, default: false },
      unfiledNotesCount: { type: Number, default: 0 },
      presentingElement: { type: Object, default: undefined },
      disabledRoute: { type: Boolean, default: false },
    },
    emits: ['refresh', 'selected'],
    template: '<div class="note-list-stub" />',
  })
}

function createFolderPageStub() {
  return defineComponent({
    name: 'FolderPage',
    props: {
      currentFolder: { type: String, default: '' },
      selectedNoteId: { type: String, default: '' },
    },
    emits: ['selected'],
    template: '<div class="folder-page-stub" />',
  })
}

function createNoteDetailStub() {
  return defineComponent({
    name: 'NoteDetail',
    props: {
      noteId: { type: String, default: '' },
    },
    template: '<div class="note-detail-stub" />',
  })
}

describe('user public notes page', () => {
  it('places a root public-note deep link under the unfiled notes entry', async () => {
    vi.resetModules()
    window.history.replaceState(window.history.state, '', '/alice/n/note-1')

    const noteListStub = createNoteListStub()
    const folderPageStub = createFolderPageStub()
    const noteDetailStub = createNoteDetailStub()

    const publicFolders: FolderTreeNode[] = [
      {
        originNote: {
          id: 'folder-1',
          title: '公开文件夹',
          item_type: NOTE_TYPE.FOLDER,
          parent_id: '',
          note_count: 1,
          created: '',
          updated: '',
          content: '',
          is_deleted: 0,
          is_locked: 0,
          summary: '',
        },
        children: [],
      },
    ]

    const getPublicFolderTreeByPUuid = vi.fn(() => publicFolders)
    const getPublicNote = vi.fn(() => ({
      id: 'note-1',
      parent_id: '',
    }))
    const routerPush = vi.fn()
    const ionRouterBack = vi.fn()
    const ionRouterNavigate = vi.fn()
    const ionRouterCanGoBack = vi.fn(() => false)
    const ensurePublicNotesReady = vi.fn(async () => ({
      unfiledNotesCount: 2,
      userInfo: {
        username: 'alice',
      },
    }))

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          params: { noteId: 'note-1', username: 'alice' },
          path: '/alice/n/note-1',
          fullPath: '/alice/n/note-1',
        }),
        useRouter: () => ({ push: routerPush }),
      }
    })

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop: ref(true),
      }),
    }))

    vi.doMock('@/entities/public-note', () => ({
      useUserPublicNotes: () => ({
        getPublicNote,
        getPublicFolderTreeByPUuid,
      }),
    }))

    vi.doMock('@/processes/public-notes', () => ({
      ensurePublicNotesReady,
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

    vi.doMock('@/widgets/note-list', () => ({
      default: noteListStub,
    }))

    vi.doMock('@ionic/vue', () => {
      return {
        IonButton: createIonicStub('IonButton'),
        IonButtons: createIonicStub('IonButtons'),
        IonContent: createIonicStub('IonContent'),
        IonHeader: createIonicStub('IonHeader'),
        IonIcon: createIonicStub('IonIcon'),
        IonPage: createIonicStub('IonPage'),
        IonRefresher: createIonicStub('IonRefresher'),
        IonRefresherContent: createIonicStub('IonRefresherContent'),
        IonSpinner: createIonicStub('IonSpinner'),
        IonTitle: createIonicStub('IonTitle'),
        IonToolbar: createIonicStub('IonToolbar'),
        onIonViewWillEnter: vi.fn(),
        useIonRouter: () => ({
          back: ionRouterBack,
          canGoBack: ionRouterCanGoBack,
          navigate: ionRouterNavigate,
        }),
      }
    })

    const UserPublicNotesPage = (await import('@/pages/user-public-notes/ui/user-public-notes-page.vue')).default
    const wrapper = mount(UserPublicNotesPage, {
      global: {
        stubs: {
          NoteList: noteListStub,
          FolderPage: folderPageStub,
          NoteDetail: noteDetailStub,
        },
      },
    })

    await flushPromises()

    const noteList = wrapper.findComponent(noteListStub)
    const folderPage = () => wrapper.findComponent(folderPageStub)
    const noteDetail = () => wrapper.findComponent(noteDetailStub)

    expect(ensurePublicNotesReady).toHaveBeenCalledWith('alice', {
      force: false,
      noteId: 'note-1',
    })
    expect(wrapper.text()).not.toContain('加载中...')
    expect(noteList.props('noteUuid')).toBe('unfilednotes')
    expect(noteList.props('showUnfiledNotes')).toBe(true)
    expect(noteList.props('unfiledNotesCount')).toBe(2)
    expect(folderPage().props('currentFolder')).toBe('unfilednotes')
    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
    expect(wrapper.find('#public-navigation-pane').exists()).toBe(true)
    expect(wrapper.find('#public-note-list-pane').exists()).toBe(true)
    expect(wrapper.find('#public-note-detail-pane').exists()).toBe(true)

    await wrapper.get('[aria-label="返回备忘录"]').trigger('click')
    expect(ionRouterCanGoBack).toHaveBeenCalled()
    expect(ionRouterNavigate).toHaveBeenCalledWith('/home', 'back', 'replace')
    expect(ionRouterBack).not.toHaveBeenCalled()

    ionRouterCanGoBack.mockReturnValue(true)
    await wrapper.get('[aria-label="返回备忘录"]').trigger('click')
    expect(ionRouterBack).toHaveBeenCalledOnce()
    expect(ionRouterNavigate).toHaveBeenCalledOnce()

    noteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(noteList.props('noteUuid')).toBe('folder-1')
    expect(folderPage().props('currentFolder')).toBe('folder-1')
    expect(window.location.pathname).toBe('/alice/f/folder-1')
    expect(routerPush).not.toHaveBeenCalled()

    folderPage().vm.$emit('selected', 'note-1')
    await nextTick()

    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
    expect(window.location.pathname).toBe('/alice/n/note-1')
    expect(routerPush).not.toHaveBeenCalled()
  })
})
