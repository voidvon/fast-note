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

function createF7Stub(name: string) {
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

  it('keeps distinct Framework7 route components for each public center level', async () => {
    const { appRoutes } = await import('@/app/router/routes')
    const publicRouteComponents = appRoutes
      .filter(route => ['UserHome', 'UserFolder', 'UserNote'].includes(route.name as string))
      .map(route => route.component)

    expect(publicRouteComponents).toHaveLength(3)
    expect(new Set(publicRouteComponents).size).toBe(3)

    expect(publicRouteComponents.every(component => component && typeof component === 'object')).toBe(true)
  })

  it('renders a skeleton before the public note request resolves', async () => {
    const pendingNote = deferred<{ id: string } | null>()
    const loadPublicNote = vi.fn(() => pendingNote.promise)
    let f7ViewDidLeaveCallback: (() => void) | undefined
    const noteDetailStub = defineComponent({
      name: 'NoteDetailPage',
      props: {
        loadError: {
          type: String,
          default: '',
        },
        loading: Boolean,
        noteId: {
          type: String,
          default: '',
        },
      },
      template: `
        <div class="note-detail-page" :data-note-id="noteId">
          <div v-if="loading" class="public-note-skeleton" />
          <div v-else-if="loadError" class="public-note-load-error">{{ loadError }}</div>
          <div v-else class="note-detail-content" />
        </div>
      `,
    })

    vi.doMock('@/shared/lib/device', () => ({
      useDeviceType: () => ({ isDesktop: ref(false) }),
    }))
    vi.doMock('@/processes/public-notes', () => ({ loadPublicNote }))
    vi.doMock('@/pages/note-detail/ui/note-detail-page.vue', () => ({ default: noteDetailStub }))
    vi.doMock('@/pages/user-public-notes/ui/user-public-notes-page.vue', () => ({
      default: defineComponent({ template: '<div />' }),
    }))
    vi.doMock('@/shared/ui/f7', () => ({
      F7BackButton: createF7Stub('F7BackButton'),
      F7Buttons: createF7Stub('F7Buttons'),
      F7Content: createF7Stub('F7Content'),
      F7Header: createF7Stub('F7Header'),
      F7Page: createF7Stub('F7Page'),
      F7SkeletonText: createF7Stub('F7SkeletonText'),
      F7Toolbar: createF7Stub('F7Toolbar'),
      onF7ViewDidLeave: (callback: () => void) => {
        f7ViewDidLeaveCallback = callback
      },
      useAppRoute: () => ({
        name: 'UserNote',
        params: { username: 'voidvon', noteId: 'note-1' },
      }),
    }))

    const PublicNoteRoute = (await import('@/app/router/ui/public-note-route.vue')).default
    const wrapper = mount(PublicNoteRoute)

    expect(loadPublicNote).toHaveBeenCalledWith('voidvon', 'note-1')
    expect(wrapper.find('.public-note-skeleton').exists()).toBe(true)
    expect(wrapper.find('.note-detail-page').exists()).toBe(true)
    expect(wrapper.find('.note-detail-content').exists()).toBe(false)
    const stableDetailPage = wrapper.find('.note-detail-page').element

    pendingNote.resolve({ id: 'note-1' })
    await flushPromises()

    expect(wrapper.find('.public-note-skeleton').exists()).toBe(false)
    await vi.waitFor(() => {
      expect(wrapper.find('.note-detail-content').exists()).toBe(true)
    })
    expect(wrapper.find('.note-detail-page').element).toBe(stableDetailPage)
    expect(wrapper.find('.note-detail-page').attributes('data-note-id')).toBe('note-1')

    f7ViewDidLeaveCallback?.()
    await flushPromises()

    expect(wrapper.find('.note-detail-page').exists()).toBe(true)
    expect(wrapper.find('.note-detail-page').element).toBe(stableDetailPage)
    expect(wrapper.find('.note-detail-content').exists()).toBe(false)
    expect(wrapper.find('.public-note-skeleton').exists()).toBe(true)
  })
})
