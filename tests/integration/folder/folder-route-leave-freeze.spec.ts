import type { Note } from '@/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, ref } from 'vue'
import { NOTE_TYPE } from '@/types'

function createGenericStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

describe('folderPage route leave freeze', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('keeps folder data stable when route changes to note detail before unmount', async () => {
    const route = ref({
      params: {
        pathMatch: 'folder-a',
      },
      path: '/f/folder-a',
      fullPath: '/f/folder-a',
    })
    const isDesktop = ref(false)
    const notes = ref<Note[]>([
      {
        id: 'folder-a',
        title: '文件夹 A',
        created: '2026-03-13 10:00:00',
        updated: '2026-03-13 10:00:00',
        content: '',
        summary: '',
        item_type: NOTE_TYPE.FOLDER,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 1,
        version: 1,
      },
      {
        id: 'note-1',
        title: '测试备忘录',
        created: '2026-03-13 10:00:00',
        updated: '2026-03-13 10:00:00',
        content: '',
        summary: '',
        item_type: NOTE_TYPE.NOTE,
        parent_id: 'folder-a',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
      },
    ])
    const scrollElement = document.createElement('div')

    vi.doMock('vue-router', () => ({
      onBeforeRouteLeave: vi.fn(),
      useRoute: () => route.value,
    }))

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop,
      }),
    }))

    vi.doMock('@/processes/navigation', () => ({
      useFolderBackButton: () => ({
        backButtonProps: {},
      }),
      useRouteStateRestore: () => ({
        resolveFolderEnterMode: vi.fn(() => 'restore'),
        shouldSaveFolderLeave: vi.fn(() => true),
      }),
    }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        notes,
        addNote: vi.fn(),
        getNote: vi.fn(async (id: string) => notes.value.find(note => note.id === id)),
        getFolderTreeByParentId: vi.fn(() => []),
      }),
    }))

    vi.doMock('@/entities/public-note', () => ({
      useUserPublicNotes: () => ({
        getPublicNote: vi.fn(),
      }),
    }))

    vi.doMock('@/widgets/note-list', () => ({
      default: createGenericStub('NoteList'),
    }))

    vi.doMock('@ionic/vue', async () => {
      const IonContent = defineComponent({
        name: 'IonContent',
        inheritAttrs: false,
        setup(_, { attrs, slots, expose }) {
          const elementRef = ref<HTMLElement>()

          onMounted(() => {
            if (elementRef.value) {
              ;(elementRef.value as HTMLElement & { getScrollElement?: () => Promise<HTMLElement> }).getScrollElement = async () => scrollElement
            }
          })

          expose({
            getScrollElement: async () => scrollElement,
          })

          return () => h('div', {
            ...attrs,
            ref: elementRef,
          }, slots.default ? slots.default() : [])
        },
      })

      return {
        IonAlert: createGenericStub('IonAlert'),
        IonBackButton: createGenericStub('IonBackButton'),
        IonButton: createGenericStub('IonButton'),
        IonButtons: createGenericStub('IonButtons'),
        IonContent,
        IonFooter: createGenericStub('IonFooter'),
        IonHeader: createGenericStub('IonHeader'),
        IonIcon: createGenericStub('IonIcon'),
        IonPage: createGenericStub('IonPage'),
        IonTitle: createGenericStub('IonTitle'),
        IonToolbar: createGenericStub('IonToolbar'),
        onIonViewDidEnter: vi.fn(),
        onIonViewWillEnter: vi.fn(),
        onIonViewWillLeave: vi.fn(),
      }
    })

    const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
    const wrapper = mount(FolderPage)
    await flushPromises()

    expect(wrapper.text()).toContain('1个备忘录')

    route.value = {
      params: {},
      path: '/n/note-1',
      fullPath: '/n/note-1',
    }
    await flushPromises()

    expect(wrapper.text()).toContain('1个备忘录')
    expect(wrapper.text()).not.toContain('无备忘录')
  })
})
