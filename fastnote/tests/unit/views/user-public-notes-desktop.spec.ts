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
      return () => h('div', { ...attrs, 'data-ionic-stub': name }, slots.default ? slots.default() : [])
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
    const isDesktop = ref(true)
    const ionRouterPush = vi.fn()
    let triggerIonViewWillEnter: (() => void) | undefined
    const ensurePublicNotesReady = vi.fn(async () => ({
      unfiledNotesCount: 2,
      userInfo: {
        username: 'alice',
      },
    }))
    const loadPublicNote = vi.fn(async () => ({
      id: 'note-1',
      content: '<p>完整正文</p>',
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
      }
    })

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop,
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
      loadPublicNote,
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
        IonBackButton: createIonicStub('IonBackButton'),
        IonButtons: createIonicStub('IonButtons'),
        IonContent: createIonicStub('IonContent'),
        IonHeader: createIonicStub('IonHeader'),
        IonIcon: createIonicStub('IonIcon'),
        IonPage: createIonicStub('IonPage'),
        IonRefresher: createIonicStub('IonRefresher'),
        IonRefresherContent: createIonicStub('IonRefresherContent'),
        IonSkeletonText: createIonicStub('IonSkeletonText'),
        IonSpinner: createIonicStub('IonSpinner'),
        IonTitle: createIonicStub('IonTitle'),
        IonToolbar: createIonicStub('IonToolbar'),
        onIonViewWillEnter: (callback: () => void) => {
          triggerIonViewWillEnter = callback
        },
        useIonRouter: () => ({
          push: ionRouterPush,
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

    expect(wrapper.find('.public-home-skeleton').exists()).toBe(true)
    expect(wrapper.findAll('.public-home-skeleton__row')).toHaveLength(1)

    await flushPromises()

    const noteList = wrapper.findComponent(noteListStub)
    const folderPage = () => wrapper.findComponent(folderPageStub)
    const noteDetail = () => wrapper.findComponent(noteDetailStub)

    expect(ensurePublicNotesReady).toHaveBeenCalledWith('alice', {
      force: false,
      noteId: 'note-1',
    })
    expect(wrapper.find('.public-home-skeleton').exists()).toBe(false)
    expect(ensurePublicNotesReady).toHaveBeenCalledTimes(1)

    triggerIonViewWillEnter?.()
    await flushPromises()
    expect(ensurePublicNotesReady).toHaveBeenCalledTimes(1)

    expect(noteList.props('noteUuid')).toBe('unfilednotes')
    expect(noteList.props('showUnfiledNotes')).toBe(true)
    expect(noteList.props('unfiledNotesCount')).toBe(2)
    expect(folderPage().props('currentFolder')).toBe('unfilednotes')
    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
    expect(wrapper.find('#public-navigation-pane').exists()).toBe(true)
    expect(wrapper.find('#public-note-list-pane').exists()).toBe(true)
    expect(wrapper.find('#public-note-detail-pane').exists()).toBe(true)

    const backButton = wrapper.findComponent({ name: 'IonBackButton' })
    expect(backButton.attributes('default-href')).toBe('/home')

    noteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(noteList.props('noteUuid')).toBe('folder-1')
    expect(folderPage().props('currentFolder')).toBe('folder-1')
    expect(window.location.pathname).toBe('/alice/f/folder-1')
    expect(ionRouterPush).not.toHaveBeenCalled()

    folderPage().vm.$emit('selected', 'note-1')
    await flushPromises()

    expect(loadPublicNote).toHaveBeenCalledWith('alice', 'note-1')
    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
    expect(window.location.pathname).toBe('/alice/n/note-1')
    expect(ionRouterPush).not.toHaveBeenCalled()

    isDesktop.value = false
    await nextTick()

    expect(wrapper.find('#public-navigation-pane').exists()).toBe(false)
    const mobilePageChildren = Array.from(wrapper.find('[data-ionic-stub="IonPage"]').element.children)
    expect(mobilePageChildren[0]?.getAttribute('data-ionic-stub')).toBe('IonHeader')
    expect(mobilePageChildren[1]?.getAttribute('data-ionic-stub')).toBe('IonContent')

    const mobileNoteList = wrapper.findComponent(noteListStub)
    expect(mobileNoteList.props('disabledRoute')).toBe(true)
    mobileNoteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(ionRouterPush).toHaveBeenCalledOnce()
    expect(ionRouterPush).toHaveBeenCalledWith('/alice/f/folder-1')
  })
})
