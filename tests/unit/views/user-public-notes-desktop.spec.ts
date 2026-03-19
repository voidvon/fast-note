import type { FolderTreeNode } from '@/shared/types'
import { mount } from '@vue/test-utils'
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

describe('UserPublicNotesPage', () => {
  it('passes desktop public selection through FolderPage and NoteDetail with noteId contract', async () => {
    vi.resetModules()

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
    const getPublicUserInfo = vi.fn(async () => ({ username: 'alice' }))
    const ensurePublicNotesReady = vi.fn(async () => {})

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          params: { username: 'alice' },
          path: '/alice',
          fullPath: '/alice',
        }),
      }
    })

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop: ref(true),
      }),
    }))

    vi.doMock('@/entities/public-note', () => ({
      useUserPublicNotes: () => ({
        getPublicFolderTreeByPUuid,
      }),
    }))

    vi.doMock('@/processes/navigation', () => ({
      useSimpleBackButton: () => ({
        backButtonProps: {},
      }),
    }))

    vi.doMock('@/processes/public-notes', () => ({
      ensurePublicNotesReady,
      usePublicUserCache: () => ({
        getPublicUserInfo,
      }),
    }))

    vi.doMock('@/pages/folder/ui/folder-page.vue', () => ({
      default: folderPageStub,
    }))

    vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({
      default: noteDetailStub,
    }))

    vi.doMock('@/widgets/note-list', () => ({
      default: noteListStub,
    }))

    vi.doMock('@ionic/vue', async () => {
      const { onMounted } = await import('vue')
      return {
        IonBackButton: createIonicStub('IonBackButton'),
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
        onIonViewWillEnter: (callback: () => void) => onMounted(callback),
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

    await nextTick()
    await nextTick()

    const noteList = wrapper.findComponent(noteListStub)
    const folderPage = () => wrapper.findComponent(folderPageStub)
    const noteDetail = () => wrapper.findComponent(noteDetailStub)

    expect(getPublicUserInfo).toHaveBeenCalledWith('alice')
    expect(ensurePublicNotesReady).toHaveBeenCalledWith('alice')
    expect(noteList.props('noteUuid')).toBe('')
    expect(folderPage().props('currentFolder')).toBe('')
    expect(folderPage().props('selectedNoteId')).toBe('')
    expect(noteDetail().props('noteId')).toBe('')

    noteList.vm.$emit('selected', 'folder-1')
    await nextTick()

    expect(noteList.props('noteUuid')).toBe('folder-1')
    expect(folderPage().props('currentFolder')).toBe('folder-1')

    folderPage().vm.$emit('selected', 'note-1')
    await nextTick()

    expect(folderPage().props('selectedNoteId')).toBe('note-1')
    expect(noteDetail().props('noteId')).toBe('note-1')
  })
})
