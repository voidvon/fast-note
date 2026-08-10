import type { FolderTreeNode } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

function createF7Stub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(
        'div',
        { ...attrs, 'data-f7-stub': name },
        Object.values(slots).flatMap(slot => slot?.() || []),
      )
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
      allNotesCount: { type: Number, default: 0 },
      presentingElement: { type: Object, default: undefined },
      disabledRoute: { type: Boolean, default: false },
      showAllNotes: { type: Boolean, default: false },
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
    const publicNotes = ref([
      {
        id: 'note-1',
        item_type: NOTE_TYPE.NOTE,
        is_deleted: 0,
        parent_id: '',
        updated: '2026-08-10 12:00:00',
      },
    ])
    const isDesktop = ref(true)
    const appRouterPush = vi.fn()
    let triggerF7ViewWillEnter: (() => void) | undefined
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

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop,
      }),
    }))

    vi.doMock('@/entities/public-note', () => ({
      useUserPublicNotes: () => ({
        getPublicNote,
        getPublicFolderTreeByPUuid,
        publicNotes,
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

    vi.doMock('@/shared/ui/f7', () => {
      return {
        F7Button: createF7Stub('F7Button'),
        F7BackButton: createF7Stub('F7BackButton'),
        F7Icon: createF7Stub('F7Icon'),
        F7Navbar: createF7Stub('F7Navbar'),
        F7Page: createF7Stub('F7Page'),
        F7PageContent: createF7Stub('F7PageContent'),
        F7Refresher: createF7Stub('F7Refresher'),
        F7RefresherContent: createF7Stub('F7RefresherContent'),
        F7SkeletonText: createF7Stub('F7SkeletonText'),
        F7Spinner: createF7Stub('F7Spinner'),
        onF7ViewWillEnter: (callback: () => void) => {
          triggerF7ViewWillEnter = callback
        },
        useAppRoute: () => ({
          params: { noteId: 'note-1', username: 'alice' },
          path: '/alice/n/note-1',
          fullPath: '/alice/n/note-1',
        }),
        useAppRouter: () => ({
          push: appRouterPush,
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
      folderId: 'allnotes',
      noteId: 'note-1',
    })
    expect(wrapper.find('.public-home-skeleton').exists()).toBe(false)
    expect(ensurePublicNotesReady).toHaveBeenCalledTimes(1)

    triggerF7ViewWillEnter?.()
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

    const backButton = wrapper.findComponent({ name: 'F7BackButton' })
    expect(backButton.attributes('default-href')).toBe('/home')
    expect(backButton.attributes()).toHaveProperty('deterministic')

    noteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(noteList.props('noteUuid')).toBe('folder-1')
    expect(folderPage().props('currentFolder')).toBe('folder-1')
    expect(window.location.pathname).toBe('/alice/f/folder-1')
    expect(appRouterPush).not.toHaveBeenCalled()

    folderPage().vm.$emit('selected', 'note-1')
    await flushPromises()

    expect(loadPublicNote).toHaveBeenCalledWith('alice', 'note-1')
    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
    expect(window.location.pathname).toBe('/alice/n/note-1')
    expect(appRouterPush).not.toHaveBeenCalled()

    isDesktop.value = false
    await nextTick()

    expect(wrapper.find('#public-navigation-pane').exists()).toBe(true)
    const mobilePageChildren = Array.from(wrapper.find('[data-f7-stub="F7Page"]').element.children)
    expect(mobilePageChildren[0]?.id).toBe('public-navigation-pane')
    expect(wrapper.find('[data-f7-stub="F7Navbar"]').exists()).toBe(true)
    expect(wrapper.find('[data-f7-stub="F7PageContent"]').exists()).toBe(true)
    expect(wrapper.find('#public-note-list-pane').exists()).toBe(false)
    expect(wrapper.find('#public-note-detail-pane').exists()).toBe(false)

    const mobileNoteList = wrapper.findComponent(noteListStub)
    expect(mobileNoteList.props('disabledRoute')).toBe(true)
    mobileNoteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(appRouterPush).toHaveBeenCalledOnce()
    expect(appRouterPush).toHaveBeenCalledWith('/alice/f/folder-1')
  })

  it('hides public-note navigation and panes when the user does not exist', async () => {
    vi.resetModules()

    const isDesktop = ref(true)
    const publicNotes = ref([])
    const noteListStub = createNoteListStub()
    const folderPageStub = createFolderPageStub()
    const noteDetailStub = createNoteDetailStub()

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop }),
    }))
    vi.doMock('@/entities/public-note', () => ({
      useUserPublicNotes: () => ({
        getPublicFolderTreeByPUuid: () => [],
        getPublicNote: () => null,
        publicNotes,
      }),
    }))
    vi.doMock('@/processes/public-notes', () => ({
      ensurePublicNotesReady: vi.fn(async () => ({
        notes: [],
        synced: 0,
        unfiledNotesCount: 0,
        userInfo: null,
      })),
      loadPublicNote: vi.fn(),
    }))
    vi.doMock('@/widgets/folder-browser', () => ({ default: folderPageStub }))
    vi.doMock('@/widgets/note-detail-pane', () => ({ default: noteDetailStub }))
    vi.doMock('@/widgets/note-list', () => ({ default: noteListStub }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7Button: createF7Stub('F7Button'),
      F7BackButton: createF7Stub('F7BackButton'),
      F7Icon: createF7Stub('F7Icon'),
      F7Navbar: createF7Stub('F7Navbar'),
      F7Page: createF7Stub('F7Page'),
      F7PageContent: createF7Stub('F7PageContent'),
      F7SkeletonText: createF7Stub('F7SkeletonText'),
      F7Spinner: createF7Stub('F7Spinner'),
      onF7ViewWillEnter: vi.fn(),
      useAppRoute: () => ({
        params: { username: 'missing-user' },
        path: '/missing-user',
        fullPath: '/missing-user',
      }),
      useAppRouter: () => ({ push: vi.fn() }),
    }))

    const UserPublicNotesPage = (await import('@/pages/user-public-notes/ui/user-public-notes-page.vue')).default
    const wrapper = mount(UserPublicNotesPage)
    await flushPromises()

    expect(wrapper.find('.error-container').text()).toContain('用户不存在')
    expect(wrapper.findComponent(noteListStub).exists()).toBe(false)
    expect(wrapper.find('#public-note-list-pane').exists()).toBe(false)
    expect(wrapper.find('#public-note-detail-pane').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('全部备忘录')
  })
})
