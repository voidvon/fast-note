import type { Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, onMounted, ref } from 'vue'
import { NOTE_TYPE } from '@/shared/types'

function createGenericStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

describe('folderPage mobile scroll restore', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetModules()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
  })

  it('restores previous scroll position when enter mode is restore', async () => {
    const route = ref({
      params: {},
      path: '/f/unfilednotes',
      fullPath: '/f/unfilednotes',
    })
    const isDesktop = ref(false)
    const notes = ref<Note[]>([
      {
        id: 'note-1',
        title: '测试备忘录',
        created: '2026-03-13 10:00:00',
        updated: '2026-03-13 10:00:00',
        content: '',
        summary: '',
        item_type: NOTE_TYPE.NOTE,
        parent_id: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        version: 1,
      },
    ])
    const ionViewDidEnterHandlers: Array<() => void> = []
    const beforeRouteLeaveGuards: Array<(to: { path: string, fullPath: string }, from: { path: string, fullPath: string }) => void | Promise<void>> = []
    const scrollElement = document.createElement('div')
    scrollElement.scrollTop = 0

    vi.doMock('vue-router', () => ({
      onBeforeRouteLeave: (guard: (to: { path: string, fullPath: string }, from: { path: string, fullPath: string }) => void | Promise<void>) => {
        beforeRouteLeaveGuards.push(guard)
      },
      useRoute: () => route.value,
    }))

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({
        isDesktop,
      }),
    }))

    vi.doMock('@/processes/navigation', () => ({
      useRouteStateRestore: () => ({
        resolveFolderEnterMode: vi.fn(() => 'restore'),
        shouldSaveFolderLeave: vi.fn(() => true),
      }),
      useFolderBackButton: () => ({
        backButtonProps: {},
      }),
    }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        notes,
        addNote: vi.fn(),
        getNote: vi.fn(),
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
        onIonViewDidEnter: (callback: () => void) => {
          ionViewDidEnterHandlers.push(callback)
        },
        onIonViewWillEnter: vi.fn(),
      }
    })

    const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
    mount(FolderPage)
    await flushPromises()

    scrollElement.scrollTop = 248
    await beforeRouteLeaveGuards[0](
      { path: '/n/note-1', fullPath: '/n/note-1' },
      { path: '/f/unfilednotes', fullPath: '/f/unfilednotes' },
    )
    await flushPromises()

    expect(sessionStorage.getItem('ion-content-scroll:private:/f/unfilednotes')).toBe('248')

    scrollElement.scrollTop = 0
    await ionViewDidEnterHandlers[0]()
    await flushPromises()

    expect(scrollElement.scrollTop).toBe(248)
  })

  it('scrolls to top when enter mode is reset', async () => {
    const route = ref({
      params: {},
      path: '/f/folder-b',
      fullPath: '/f/folder-b',
    })
    const isDesktop = ref(false)
    const notes = ref<Note[]>([])
    const ionViewDidEnterHandlers: Array<() => void> = []
    const scrollElement = document.createElement('div')
    scrollElement.scrollTop = 196

    sessionStorage.setItem('ion-content-scroll:private:/f/folder-b', '248')

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
      useRouteStateRestore: () => ({
        resolveFolderEnterMode: vi.fn(() => 'reset'),
        shouldSaveFolderLeave: vi.fn(() => true),
      }),
      useFolderBackButton: () => ({
        backButtonProps: {},
      }),
    }))

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        notes,
        addNote: vi.fn(),
        getNote: vi.fn(),
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
        onIonViewDidEnter: (callback: () => void) => {
          ionViewDidEnterHandlers.push(callback)
        },
        onIonViewWillEnter: vi.fn(),
      }
    })

    const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
    mount(FolderPage)
    await flushPromises()

    await ionViewDidEnterHandlers[0]()
    await flushPromises()

    expect(scrollElement.scrollTop).toBe(0)
  })
})
