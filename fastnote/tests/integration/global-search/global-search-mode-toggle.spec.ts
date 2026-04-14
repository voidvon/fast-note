import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

function createIonicStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h('div', attrs, slots.default ? slots.default() : [])
    },
  })
}

describe('global search mode toggle', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    const { useGlobalSearch } = await import('@/features/global-search')
    useGlobalSearch().resetGlobalSearch()
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('switches to ai mode and refocuses the input', async () => {
    const pushMock = vi.fn()
    const replaceMock = vi.fn()

    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        searchNotesByParentId: vi.fn(async () => []),
      }),
    }))

    vi.doMock('@/widgets/note-list', () => ({
      default: defineComponent({
        name: 'NoteListStub',
        template: '<div class="note-list-stub" />',
      }),
    }))

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          path: '/home',
          query: {},
          hash: '',
        }),
        useRouter: () => ({
          push: pushMock,
          replace: replaceMock,
          back: vi.fn(),
        }),
      }
    })

    vi.doMock('@ionic/vue', () => ({
      IonContent: createIonicStub('IonContent'),
      IonIcon: createIonicStub('IonIcon'),
    }))

    const focusSpy = vi.spyOn(HTMLInputElement.prototype, 'focus')
    const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
    const { useGlobalSearch } = await import('@/features/global-search')
    const state = useGlobalSearch()
    const wrapper = mount(GlobalSearch, {
      attachTo: document.body,
      props: {
        syncWithRoute: false,
      },
    })

    const input = wrapper.get('input')
    await input.trigger('focus')
    await nextTick()

    const toggleButton = wrapper.get('button[aria-label="切换到 AI 对话"]')
    await toggleButton.trigger('pointerdown')
    await toggleButton.trigger('click')
    await nextTick()

    expect(state.inputMode.value).toBe('ai')
    expect(input.attributes('placeholder')).toBe('发消息')
    expect(focusSpy).toHaveBeenCalled()
    expect(wrapper.get('.global-search__field-shell').classes()).toContain('global-search__field-shell--panel-visible')
    expect(wrapper.find('.global-search__panel').exists()).toBe(true)
    expect(wrapper.text()).toContain('AI 对话')

    wrapper.unmount()
  })

  it('keeps search keyword and ai draft when toggling between modes', async () => {
    vi.doMock('@/entities/note', () => ({
      useNote: () => ({
        searchNotesByParentId: vi.fn(async () => []),
      }),
    }))

    vi.doMock('@/widgets/note-list', () => ({
      default: defineComponent({
        name: 'NoteListStub',
        template: '<div class="note-list-stub" />',
      }),
    }))

    vi.doMock('vue-router', async () => {
      const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
      return {
        ...actual,
        useRoute: () => ({
          path: '/home',
          query: {},
          hash: '',
        }),
        useRouter: () => ({
          push: vi.fn(),
          replace: vi.fn(),
          back: vi.fn(),
        }),
      }
    })

    vi.doMock('@ionic/vue', () => ({
      IonContent: createIonicStub('IonContent'),
      IonIcon: createIonicStub('IonIcon'),
    }))

    const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
    const { useGlobalSearch } = await import('@/features/global-search')
    const state = useGlobalSearch()
    const wrapper = mount(GlobalSearch, {
      attachTo: document.body,
      props: {
        syncWithRoute: false,
      },
    })

    const input = wrapper.get('input')
    await input.trigger('focus')
    await input.setValue('会议')
    await nextTick()

    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await input.setValue('帮我整理今天的会议纪要')
    await nextTick()

    await wrapper.get('button[aria-label="切换到全局搜索"]').trigger('click')
    await nextTick()

    expect(state.searchKeyword.value).toBe('会议')
    expect(state.aiDraft.value).toBe('帮我整理今天的会议纪要')
    expect(input.element.value).toBe('会议')

    wrapper.unmount()
  })
})
