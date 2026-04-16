import type { AiToolResult } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

const aiChatSessionMock = {
  cancelPendingExecution: vi.fn(),
  confirmPendingExecution: vi.fn(),
  hasPendingConfirmation: ref(false),
  lastResults: ref<AiToolResult[]>([]),
  submitToolCalls: vi.fn(),
}

function resetAiChatSessionMock() {
  aiChatSessionMock.hasPendingConfirmation.value = false
  aiChatSessionMock.lastResults.value = []
  aiChatSessionMock.submitToolCalls.mockReset()
  aiChatSessionMock.confirmPendingExecution.mockReset()
  aiChatSessionMock.cancelPendingExecution.mockReset()
  aiChatSessionMock.cancelPendingExecution.mockImplementation(() => {
    aiChatSessionMock.hasPendingConfirmation.value = false
    aiChatSessionMock.lastResults.value = []
  })
  aiChatSessionMock.submitToolCalls.mockImplementation(async () => [])
  aiChatSessionMock.confirmPendingExecution.mockImplementation(async () => [])
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

function createJsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
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

async function ensureAiMode(wrapper: Awaited<ReturnType<typeof mountGlobalSearch>>) {
  const input = wrapper.get('textarea')

  await input.trigger('focus')
  await nextTick()

  const toggleButton = wrapper.find('button[aria-label="切换到 AI 对话"]')
  if (toggleButton.exists()) {
    await toggleButton.trigger('click')
    await nextTick()
  }

  return input
}

function setupModuleMocks() {
  vi.doMock('@/entities/note', () => ({
    NOTE_TYPE: {
      FOLDER: 1,
      NOTE: 2,
    },
    useNote: () => ({
      getNote: vi.fn(() => null),
      notes: ref([]),
      searchNotesByParentId: vi.fn(async () => []),
    }),
  }))

  vi.doMock('@/processes/ai-chat-session', () => ({
    useAiChatSession: () => aiChatSessionMock,
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
    resetAiChatSessionMock()
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
    await ensureAiMode(restoredWrapper)

    expect(restoredWrapper.text()).toContain('帮我记住这段对话')
    expect(restoredWrapper.text()).toContain('本地记录已恢复。')

    restoredWrapper.unmount()
  })

  it('restores structured result cards from local storage after remount', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '搜索备忘录',
          summary: '搜索关键字“周报”',
          affectedNoteIds: [],
        },
        data: [{
          id: 'note-1',
          title: '周报',
          summary: '本周项目推进',
          parentId: 'folder-1',
          updated: '2026-04-15 10:00:00',
          isLocked: false,
          isDeleted: false,
        }],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

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
            content: JSON.stringify({
              mode: 'tool_calls',
              answer: '我找到了相关备忘录。',
              toolCalls: [{
                tool: 'search_notes',
                payload: {
                  query: '周报',
                },
              }],
            }),
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

    await firstInput.setValue('搜索周报')
    await firstWrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(firstWrapper.find('button.chat-message__card-item-button').exists()).toBe(true)
    firstWrapper.unmount()

    vi.resetModules()
    resetAiChatSessionMock()
    setupModuleMocks()
    vi.stubGlobal('fetch', fetchMock)

    const restoredWrapper = await mountGlobalSearch()
    await ensureAiMode(restoredWrapper)

    expect(restoredWrapper.text()).toContain('我找到了相关备忘录。')
    expect(restoredWrapper.text()).toContain('周报')
    expect(restoredWrapper.find('button.chat-message__card-item-button').exists()).toBe(true)

    restoredWrapper.unmount()
  })

  it('scrolls to bottom when entering ai mode with restored conversation', async () => {
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
            content: '已恢复到底部。',
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

    await firstInput.setValue('帮我保留滚动位置')
    await firstWrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()
    firstWrapper.unmount()

    vi.resetModules()
    setupModuleMocks()
    vi.stubGlobal('fetch', fetchMock)

    const scrollTopMap = new WeakMap<HTMLDivElement, number>()
    const originalClientHeight = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, 'clientHeight')
    const originalScrollHeight = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, 'scrollHeight')
    const originalScrollTop = Object.getOwnPropertyDescriptor(HTMLDivElement.prototype, 'scrollTop')

    Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return this.classList.contains('ai-chat-panel__thread') ? 200 : 0
      },
    })
    Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
      configurable: true,
      get() {
        return this.classList.contains('ai-chat-panel__thread') ? 600 : 0
      },
    })
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
      configurable: true,
      get() {
        return scrollTopMap.get(this) ?? 0
      },
      set(value: number) {
        scrollTopMap.set(this, value)
      },
    })

    try {
      const restoredWrapper = await mountGlobalSearch()
      await ensureAiMode(restoredWrapper)
      await nextTick()

      const thread = restoredWrapper.get('.ai-chat-panel__thread').element as HTMLDivElement
      expect(thread.scrollTop).toBe(600)

      restoredWrapper.unmount()
    }
    finally {
      if (originalClientHeight) {
        Object.defineProperty(HTMLDivElement.prototype, 'clientHeight', originalClientHeight)
      }
      if (originalScrollHeight) {
        Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', originalScrollHeight)
      }
      if (originalScrollTop) {
        Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', originalScrollTop)
      }
    }
  })

  it('shows confirmation actions for assistant tool envelope and appends execution summary after confirm', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'confirmation_required',
        message: null,
        preview: {
          title: '准备删除备忘录',
          summary: '将软删除备忘录 note-1',
          affectedNoteIds: ['note-1'],
        },
        requiresConfirmation: true,
        affectedNoteIds: ['note-1'],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = true
      aiChatSessionMock.lastResults.value = results
      return results
    })
    aiChatSessionMock.confirmPendingExecution.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '准备删除备忘录',
          summary: '将软删除备忘录 note-1',
          affectedNoteIds: ['note-1'],
        },
        affectedNoteIds: ['note-1'],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

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
            content: JSON.stringify({
              mode: 'tool_calls',
              answer: '我已准备删除这条备忘录。',
              toolCalls: [{
                tool: 'delete_note',
                payload: {
                  noteId: 'note-1',
                },
              }],
            }),
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

    await input.setValue('删除 note-1')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(aiChatSessionMock.submitToolCalls).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('待确认操作')
    expect(wrapper.text()).toContain('准备删除备忘录：将软删除备忘录 note-1')
    expect(wrapper.text()).toContain('我已准备删除这条备忘录。')

    const confirmButton = wrapper.findAll('button').find(item => item.text() === '确认执行')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(aiChatSessionMock.confirmPendingExecution).toHaveBeenCalledTimes(1)
    expect(aiChatSessionMock.hasPendingConfirmation.value).toBe(false)
    expect(wrapper.text()).toContain('本次操作执行结果如下：')
    expect(wrapper.text()).toContain('已完成：将软删除备忘录 note-1')

    wrapper.unmount()
  })

  it('renders structured cards for note search results', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '搜索备忘录',
          summary: '搜索关键字“周报”',
          affectedNoteIds: [],
        },
        data: [{
          id: 'note-1',
          title: '周报',
          summary: '本周项目推进',
          parentId: '',
          updated: '2026-04-15 10:00:00',
          isLocked: false,
          isDeleted: false,
        }],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

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
            content: JSON.stringify({
              mode: 'tool_calls',
              answer: '我找到了相关备忘录。',
              toolCalls: [{
                tool: 'search_notes',
                payload: {
                  query: '周报',
                },
              }],
            }),
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

    await input.setValue('搜索周报')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(aiChatSessionMock.submitToolCalls).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('我找到了相关备忘录。')
    expect(wrapper.text()).toContain('周报')
    expect(wrapper.text()).toContain('本周项目推进')
    expect(wrapper.text()).toContain('更新于 2026-04-15 10:00:00')

    wrapper.unmount()
  })

  it('continues answering after reading note detail via tool call', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '读取备忘录详情',
          summary: '读取备忘录 note-1 的详情',
          affectedNoteIds: ['note-1'],
        },
        data: {
          note: {
            id: 'note-1',
            title: '原文',
            summary: '原摘要',
            content: '<p>这是一段需要重写的内容。</p>',
            parent_id: '',
            updated: '2026-04-16 10:00:00',
            is_deleted: 0,
            is_locked: 0,
          },
        },
        affectedNoteIds: ['note-1'],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => createSseResponse([
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
              content: JSON.stringify({
                mode: 'tool_calls',
                answer: '我先读取这条备忘录。',
                toolCalls: [{
                  tool: 'get_note_detail',
                  payload: {
                    noteId: 'note-1',
                  },
                }],
              }),
            },
            finish_reason: 'stop',
          }],
        }),
      ]))
      .mockImplementationOnce(async () => createJsonResponse({
        choices: [{
          message: {
            role: 'assistant',
            content: '下面是重写后的版本：\n\n这段内容经过重组，表达更清晰，也更适合直接发送。',
          },
          finish_reason: 'stop',
        }],
      }))
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

    await input.setValue('读取这条笔记并帮我重写')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const secondRequest = fetchMock.mock.calls[1]?.[1]
    const secondRequestBody = JSON.parse(String(secondRequest?.body || '{}'))
    expect(JSON.stringify(secondRequestBody)).toContain('这是一段需要重写的内容')
    expect(JSON.stringify(secondRequestBody)).toContain('读取备忘录 note-1 的详情')
    expect(aiChatSessionMock.submitToolCalls).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('下面是重写后的版本')
    expect(wrapper.text()).toContain('表达更清晰')
    expect(wrapper.text()).not.toContain('本次操作执行结果如下：')

    wrapper.unmount()
  })

  it('emits open-note when clicking a result card action', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '搜索备忘录',
          summary: '搜索关键字“周报”',
          affectedNoteIds: [],
        },
        data: [{
          id: 'note-1',
          title: '周报',
          summary: '本周项目推进',
          parentId: 'folder-1',
          updated: '2026-04-15 10:00:00',
          isLocked: false,
          isDeleted: false,
        }],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

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
            content: JSON.stringify({
              mode: 'tool_calls',
              answer: '我找到了相关备忘录。',
              toolCalls: [{
                tool: 'search_notes',
                payload: {
                  query: '周报',
                },
              }],
            }),
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

    await input.setValue('搜索周报')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    const openButton = wrapper.get('button.chat-message__card-item-button')
    await openButton.trigger('click')

    expect(wrapper.emitted('openNote')?.[0]?.[0]).toEqual({
      isDeleted: false,
      noteId: 'note-1',
      parentId: 'folder-1',
    })

    wrapper.unmount()
  })

  it('emits open-folder when clicking a folder result card action', async () => {
    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async () => {
      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '读取文件夹列表',
          summary: '读取根目录下的文件夹',
          affectedNoteIds: [],
        },
        data: [{
          id: 'folder-1',
          title: '项目资料',
          parentId: '',
          noteCount: 3,
        }],
      }]

      aiChatSessionMock.hasPendingConfirmation.value = false
      aiChatSessionMock.lastResults.value = results
      return results
    })

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
            content: JSON.stringify({
              mode: 'tool_calls',
              answer: '我找到了相关目录。',
              toolCalls: [{
                tool: 'list_folders',
                payload: {
                  parentId: '',
                },
              }],
            }),
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

    await input.setValue('查看目录')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    const openButton = wrapper.get('button.chat-message__card-item-button')
    await openButton.trigger('click')

    expect(wrapper.emitted('openFolder')?.[0]?.[0]).toEqual({
      folderId: 'folder-1',
      parentId: '',
    })

    wrapper.unmount()
  })
})
