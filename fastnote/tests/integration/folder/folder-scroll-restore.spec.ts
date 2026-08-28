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
    const scrollElement = document.createElement('div')
    scrollElement.scrollTop = 0
    sessionStorage.setItem('page-scroll:private:/f/unfilednotes', '248')

    vi.doMock('@/shared/lib/framework7', async () => {
      const actual = await vi.importActual<typeof import('@/shared/lib/framework7')>('@/shared/lib/framework7')
      return {
        ...actual,
        useAppRoute: () => route.value,
      }
    })

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

    vi.doMock('@/shared/ui/f7', async () => {
      const F7Content = defineComponent({
        name: 'F7Content',
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
        F7Alert: createGenericStub('F7Alert'),
        F7BackButton: createGenericStub('F7BackButton'),
        F7Button: createGenericStub('F7Button'),
        F7Buttons: createGenericStub('F7Buttons'),
        F7Content,
        F7Footer: createGenericStub('F7Footer'),
        F7Header: createGenericStub('F7Header'),
        F7Icon: createGenericStub('F7Icon'),
        F7Navbar: createGenericStub('F7Navbar'),
        F7Page: createGenericStub('F7Page'),
        F7Title: createGenericStub('F7Title'),
        F7Toolbar: createGenericStub('F7Toolbar'),
      }
    })

    const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
    const wrapper = mount(FolderPage)
    await flushPromises()

    expect(scrollElement.scrollTop).toBe(248)

    const contentElement = wrapper.get('.folder-page-content').element as HTMLElement
    contentElement.scrollTop = 312
    await wrapper.get('.folder-page-content').trigger('scroll')
    expect(sessionStorage.getItem('page-scroll:private:/f/unfilednotes')).toBe('312')
  })

  it('scrolls to top when enter mode is reset', async () => {
    const route = ref({
      params: {},
      path: '/f/folder-b',
      fullPath: '/f/folder-b',
    })
    const isDesktop = ref(false)
    const notes = ref<Note[]>([])
    const scrollElement = document.createElement('div')
    scrollElement.scrollTop = 196

    sessionStorage.setItem('page-scroll:private:/f/folder-b', '248')

    vi.doMock('@/shared/lib/framework7', async () => {
      const actual = await vi.importActual<typeof import('@/shared/lib/framework7')>('@/shared/lib/framework7')
      return {
        ...actual,
        useAppRoute: () => route.value,
        useAppRouter: () => ({
          afterEach: vi.fn(() => vi.fn()),
        }),
      }
    })

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

    vi.doMock('@/shared/ui/f7', async () => {
      const F7Content = defineComponent({
        name: 'F7Content',
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
        F7Alert: createGenericStub('F7Alert'),
        F7BackButton: createGenericStub('F7BackButton'),
        F7Button: createGenericStub('F7Button'),
        F7Buttons: createGenericStub('F7Buttons'),
        F7Content,
        F7Footer: createGenericStub('F7Footer'),
        F7Header: createGenericStub('F7Header'),
        F7Icon: createGenericStub('F7Icon'),
        F7Navbar: createGenericStub('F7Navbar'),
        F7Page: createGenericStub('F7Page'),
        F7Title: createGenericStub('F7Title'),
        F7Toolbar: createGenericStub('F7Toolbar'),
      }
    })

    const FolderPage = (await import('@/pages/folder/ui/folder-page.vue')).default
    mount(FolderPage)
    await flushPromises()

    expect(scrollElement.scrollTop).toBe(0)
  })
})
