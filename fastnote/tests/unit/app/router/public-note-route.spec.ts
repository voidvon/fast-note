import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

describe('public note mobile route', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('keeps distinct Ionic route components for each public center level', async () => {
    const { appRoutes } = await import('@/app/router/routes')
    const publicRouteComponents = appRoutes
      .filter(route => ['UserHome', 'UserFolder', 'UserNote'].includes(route.name as string))
      .map(route => route.component)

    expect(publicRouteComponents).toHaveLength(3)
    expect(new Set(publicRouteComponents).size).toBe(3)

    const resolvedComponents = await Promise.all(
      publicRouteComponents.map(component => (component as () => Promise<unknown>)()),
    )
    expect(new Set(resolvedComponents).size).toBe(3)
  })

  it('renders a skeleton before the public note request resolves', async () => {
    const pendingNote = deferred<{ id: string } | null>()
    const loadPublicNote = vi.fn(() => pendingNote.promise)
    const noteDetailStub = defineComponent({
      name: 'NoteDetailPage',
      template: '<div class="note-detail-page" />',
    })

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          name: 'UserNote',
          params: { username: 'voidvon', noteId: 'note-1' },
        }),
      }
    })
    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(false) }),
    }))
    vi.doMock('@/processes/public-notes', () => ({ loadPublicNote }))
    vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({ default: noteDetailStub }))
    vi.doMock('@/pages/user-public-notes/ui/user-public-notes-page.vue', () => ({
      default: defineComponent({ template: '<div />' }),
    }))
    vi.doMock('@ionic/vue', () => ({
      IonBackButton: createIonicStub('IonBackButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonContent: createIonicStub('IonContent'),
      IonHeader: createIonicStub('IonHeader'),
      IonPage: createIonicStub('IonPage'),
      IonSkeletonText: createIonicStub('IonSkeletonText'),
      IonToolbar: createIonicStub('IonToolbar'),
    }))

    const PublicNoteRoute = (await import('@/app/router/ui/public-note-route.vue')).default
    const wrapper = mount(PublicNoteRoute)

    expect(loadPublicNote).toHaveBeenCalledWith('voidvon', 'note-1')
    expect(wrapper.find('.public-note-skeleton').exists()).toBe(true)
    expect(wrapper.find('.note-detail-page').exists()).toBe(false)

    pendingNote.resolve({ id: 'note-1' })
    await flushPromises()

    expect(wrapper.find('.public-note-skeleton').exists()).toBe(false)
    await vi.waitFor(() => {
      expect(wrapper.find('.note-detail-page').exists()).toBe(true)
    })
  })
})
