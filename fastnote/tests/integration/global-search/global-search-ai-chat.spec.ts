import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

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

function createSseResponse(events: string[]) {
  const encoder = new TextEncoder()

  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  }))
}

function createPendingSseResponse() {
  const encoder = new TextEncoder()
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null

  const response = new Response(new ReadableStream({
    start(controller) {
      streamController = controller
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        choices: [{
          delta: {
            role: 'assistant',
          },
        }],
      })}\n\n`))
    },
  }))

  return {
    close(events: string[] = []) {
      if (!streamController) {
        return
      }

      for (const event of events) {
        streamController.enqueue(encoder.encode(`data: ${event}\n\n`))
      }

      streamController.enqueue(encoder.encode('data: [DONE]\n\n'))
      streamController.close()
      streamController = null
    },
    response,
  }
}

function stubScrollableElement(element: HTMLElement, options: {
  clientHeight: number
  initialScrollTop?: number
  scrollHeight: number
}) {
  let scrollTopValue = options.initialScrollTop ?? 0

  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    value: options.clientHeight,
  })

  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: options.scrollHeight,
  })

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => scrollTopValue,
    set: (value: number) => {
      scrollTopValue = value
    },
  })
}

async function mountGlobalSearch() {
  const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
  return mount(GlobalSearch, {
    attachTo: document.body,
    props: {
      syncWithRoute: false,
    },
  })
}

function setupModuleMocks() {
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
}

describe('global search ai chat', () => {
  beforeEach(() => {
    vi.resetModules()
    setupModuleMocks()
  })

  afterEach(async () => {
    const { useAiChat } = await import('@/features/ai-chat')
    const { useGlobalSearch } = await import('@/features/global-search')
    const aiChat = useAiChat()

    aiChat.clearConversation()
    aiChat.resetSettings()
    aiChat.showSettings.value = false
    useGlobalSearch().resetGlobalSearch()

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    document.body.innerHTML = ''
  })

  it('shows configuration card in ai mode when provider settings are missing', async () => {
    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await nextTick()
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('配置直连模型')
    expect(wrapper.text()).toContain('Base URL')

    wrapper.unmount()
  })

  it('streams assistant reply in ai mode after sending a message', async () => {
    const fetchMock = vi.fn(async () => createSseResponse([
      JSON.stringify({
        choices: [{
          delta: {
            role: 'assistant',
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            content: '你好，',
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            content: '我已经接入流式渲染。',
          },
          finish_reason: 'stop',
        }],
      }),
    ]))
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await input.setValue('你好')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('你好')
    expect(wrapper.text()).toContain('你好，我已经接入流式渲染。')

    wrapper.unmount()
  })

  it('sends ai message with ctrl enter while keeping textarea input', async () => {
    const fetchMock = vi.fn(async () => createSseResponse([
      JSON.stringify({
        choices: [{
          delta: {
            role: 'assistant',
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            content: '已通过快捷键发送。',
          },
          finish_reason: 'stop',
        }],
      }),
    ]))
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await input.setValue('快捷发送')
    await input.trigger('keydown', {
      key: 'Enter',
      ctrlKey: true,
    })
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('快捷发送')
    expect(wrapper.text()).toContain('已通过快捷键发送。')

    wrapper.unmount()
  })

  it('clears ai input immediately after submit while response is still streaming', async () => {
    const pendingResponse = createPendingSseResponse()
    const fetchMock = vi.fn(async () => pendingResponse.response)
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await input.setValue('马上清空')
    const clickPromise = wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    expect((input.element as HTMLTextAreaElement).value).toBe('')

    pendingResponse.close([
      JSON.stringify({
        choices: [{
          delta: {
            content: '已收到。',
          },
          finish_reason: 'stop',
        }],
      }),
    ])

    await clickPromise
    await flushPromises()
    wrapper.unmount()
  })

  it('stops auto scrolling when user scrolls upward during streaming', async () => {
    const pendingResponse = createPendingSseResponse()
    const fetchMock = vi.fn(async () => pendingResponse.response)
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    const thread = wrapper.get('.ai-chat-panel__thread').element as HTMLDivElement
    stubScrollableElement(thread, {
      clientHeight: 200,
      initialScrollTop: 400,
      scrollHeight: 600,
    })

    await input.setValue('测试滚动保持')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    thread.scrollTop = 120
    await wrapper.get('.ai-chat-panel__thread').trigger('scroll')

    pendingResponse.close([
      JSON.stringify({
        choices: [{
          delta: {
            content: '这里是新的流式内容。',
          },
          finish_reason: 'stop',
        }],
      }),
    ])

    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(thread.scrollTop).toBe(120)

    wrapper.unmount()
  })

  it('scrolls back to bottom when the user sends a new message after reading older content', async () => {
    const pendingResponse = createPendingSseResponse()
    const fetchMock = vi.fn(async () => pendingResponse.response)
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    const input = wrapper.get('textarea')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    const thread = wrapper.get('.ai-chat-panel__thread').element as HTMLDivElement
    stubScrollableElement(thread, {
      clientHeight: 200,
      initialScrollTop: 120,
      scrollHeight: 600,
    })

    await wrapper.get('.ai-chat-panel__thread').trigger('scroll')
    await input.setValue('带我回到底部')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(thread.scrollTop).toBe(600)

    pendingResponse.close([
      JSON.stringify({
        choices: [{
          delta: {
            content: '已回到底部。',
          },
          finish_reason: 'stop',
        }],
      }),
    ])

    await flushPromises()
    wrapper.unmount()
  })

  it('restores ai conversation from local storage after remount', async () => {
    const fetchMock = vi.fn(async () => createSseResponse([
      JSON.stringify({
        choices: [{
          delta: {
            role: 'assistant',
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            content: '本地记录已恢复。',
          },
          finish_reason: 'stop',
        }],
      }),
    ]))
    vi.stubGlobal('fetch', fetchMock)

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const firstWrapper = await mountGlobalSearch()
    const firstInput = firstWrapper.get('textarea')

    await firstInput.trigger('focus')
    await firstWrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await firstInput.setValue('帮我记住这段对话')
    await firstWrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(firstWrapper.text()).toContain('帮我记住这段对话')
    expect(firstWrapper.text()).toContain('本地记录已恢复。')
    firstWrapper.unmount()

    vi.resetModules()
    setupModuleMocks()
    vi.stubGlobal('fetch', fetchMock)

    const restoredWrapper = await mountGlobalSearch()
    const restoredInput = restoredWrapper.get('textarea')

    await restoredInput.trigger('focus')
    await restoredWrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    expect(restoredWrapper.text()).toContain('帮我记住这段对话')
    expect(restoredWrapper.text()).toContain('本地记录已恢复。')

    restoredWrapper.unmount()
  })
})
