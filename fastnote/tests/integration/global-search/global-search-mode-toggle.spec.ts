import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

function createRect({ left, top, width, height }: { left: number, top: number, width: number, height: number }) {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect
}

function createIonicStub(name: string, tag = 'div') {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
      return () => h(tag, attrs, slots.default ? slots.default() : [])
    },
  })
}

function createButtonStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits: ['click'],
    setup(_, { attrs, slots, emit }) {
      return () => h('button', {
        ...attrs,
        type: 'button',
        onClick: (event: MouseEvent) => emit('click', event),
      }, slots.default ? slots.default() : [])
    },
  })
}

function createInputStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      label: {
        type: String,
        default: '',
      },
      modelValue: {
        type: String,
        default: '',
      },
    },
    emits: ['update:modelValue'],
    setup(props, { attrs, emit }) {
      return () => h('label', { ...attrs, 'data-ion-input': name }, [
        props.label ? h('span', props.label) : null,
        h('input', {
          value: props.modelValue,
          type: attrs.type,
          placeholder: attrs.placeholder,
          inputmode: attrs.inputmode,
          onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
        }),
      ])
    },
  })
}

function createModalStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      isOpen: {
        type: Boolean,
        default: false,
      },
    },
    setup(props, { attrs, slots }) {
      return () => props.isOpen
        ? h('div', { ...attrs, 'data-ion-modal': name }, slots.default ? slots.default() : [])
        : null
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
      IonButton: createButtonStub('IonButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonChip: createIonicStub('IonChip'),
      IonContent: createIonicStub('IonContent'),
      IonAlert: createModalStub('IonAlert'),
      IonIcon: createIonicStub('IonIcon'),
      IonInput: createInputStub('IonInput'),
      IonItem: createIonicStub('IonItem'),
      IonLabel: createIonicStub('IonLabel', 'span'),
      IonList: createIonicStub('IonList'),
      IonModal: createModalStub('IonModal'),
      IonNote: createIonicStub('IonNote', 'span'),
      IonSpinner: createIonicStub('IonSpinner', 'span'),
      IonHeader: createIonicStub('IonHeader'),
      IonToolbar: createIonicStub('IonToolbar'),
      IonTitle: createIonicStub('IonTitle', 'span'),
    }))

    const focusSpy = vi.spyOn(HTMLTextAreaElement.prototype, 'focus')
    const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
    const { useGlobalSearch } = await import('@/features/global-search')
    const state = useGlobalSearch()
    const wrapper = mount(GlobalSearch, {
      attachTo: document.body,
      props: {
        syncWithRoute: false,
      },
    })

    const input = wrapper.get('textarea')
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
      IonButton: createButtonStub('IonButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonChip: createIonicStub('IonChip'),
      IonContent: createIonicStub('IonContent'),
      IonAlert: createModalStub('IonAlert'),
      IonIcon: createIonicStub('IonIcon'),
      IonInput: createInputStub('IonInput'),
      IonItem: createIonicStub('IonItem'),
      IonLabel: createIonicStub('IonLabel', 'span'),
      IonList: createIonicStub('IonList'),
      IonModal: createModalStub('IonModal'),
      IonNote: createIonicStub('IonNote', 'span'),
      IonSpinner: createIonicStub('IonSpinner', 'span'),
      IonHeader: createIonicStub('IonHeader'),
      IonToolbar: createIonicStub('IonToolbar'),
      IonTitle: createIonicStub('IonTitle', 'span'),
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

    const input = wrapper.get('textarea')
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
    expect((input.element as HTMLTextAreaElement).value).toBe('会议')

    wrapper.unmount()
  })

  it('keeps the glass panel full screen and reserves the bottom dock area for content', async () => {
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
      IonButton: createButtonStub('IonButton'),
      IonButtons: createIonicStub('IonButtons'),
      IonChip: createIonicStub('IonChip'),
      IonContent: createIonicStub('IonContent'),
      IonAlert: createModalStub('IonAlert'),
      IonIcon: createIonicStub('IonIcon'),
      IonInput: createInputStub('IonInput'),
      IonItem: createIonicStub('IonItem'),
      IonLabel: createIonicStub('IonLabel', 'span'),
      IonList: createIonicStub('IonList'),
      IonModal: createModalStub('IonModal'),
      IonNote: createIonicStub('IonNote', 'span'),
      IonSpinner: createIonicStub('IonSpinner', 'span'),
      IonHeader: createIonicStub('IonHeader'),
      IonToolbar: createIonicStub('IonToolbar'),
      IonTitle: createIonicStub('IonTitle', 'span'),
    }))

    const host = document.createElement('div')
    host.className = 'ion-page'
    host.getBoundingClientRect = () => createRect({
      left: 10,
      top: 20,
      width: 320,
      height: 640,
    })
    document.body.appendChild(host)

    const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
    const wrapper = mount(GlobalSearch, {
      attachTo: host,
      props: {
        syncWithRoute: false,
      },
    })

    const dockHost = wrapper.get('.global-search').element as HTMLDivElement
    dockHost.getBoundingClientRect = () => createRect({
      left: 26,
      top: 600,
      width: 288,
      height: 44,
    })

    await wrapper.get('textarea').trigger('focus')
    await nextTick()

    const panel = wrapper.get('.global-search__panel')

    expect(panel.attributes('style')).toContain('height: 640px;')
    expect(panel.attributes('style')).toContain('--global-search-panel-bottom-inset: 60px;')

    wrapper.unmount()
  })
})
