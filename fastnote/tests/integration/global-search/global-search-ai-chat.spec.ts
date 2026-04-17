import type { AiToolResult, Note } from '@/shared/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'
import { createAgentTask, updateAgentTask } from '@/features/ai-chat/model/agent-task'

const aiChatSessionMock = {
  cancelPendingExecution: vi.fn(),
  confirmPendingExecution: vi.fn(),
  hasPendingConfirmation: ref(false),
  lastResults: ref<AiToolResult[]>([]),
  submitToolCalls: vi.fn(),
}

const noteStoreMock = {
  getNote: vi.fn((_: string) => null as Note | null),
  notes: ref<Note[]>([]),
  searchNotesByParentId: vi.fn(async () => []),
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

function resetNoteStoreMock() {
  noteStoreMock.notes.value = []
  noteStoreMock.getNote.mockReset()
  noteStoreMock.getNote.mockImplementation((id: string) => {
    return noteStoreMock.notes.value.find(note => note.id === id) || null
  })
  noteStoreMock.searchNotesByParentId.mockReset()
  noteStoreMock.searchNotesByParentId.mockImplementation(async () => [])
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
    push(events: string[]) {
      if (!streamController) {
        return
      }

      for (const event of events) {
        streamController.enqueue(encoder.encode(`data: ${event}\n\n`))
      }
    },
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
      getNote: noteStoreMock.getNote,
      notes: noteStoreMock.notes,
      searchNotesByParentId: noteStoreMock.searchNotesByParentId,
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
    window.history.replaceState(null, '', '/home')
    resetAiChatSessionMock()
    resetNoteStoreMock()
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
    window.history.replaceState(null, '', '/home')
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

  it('hides raw tool envelope json while the assistant response is still streaming', async () => {
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
    const input = await ensureAiMode(wrapper)

    await input.setValue('读取并改写这条笔记')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    pendingResponse.push([
      JSON.stringify({
        choices: [{
          delta: {
            content: '{"mode":"tool_calls","answer":"已整理好润色版本，准备直接写回这篇备忘录。","toolCalls":[{"tool":"update_note"',
          },
        }],
      }),
    ])

    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('正在准备操作')
    expect(wrapper.text()).not.toContain('"toolCalls"')
    expect(wrapper.text()).not.toContain('update_note')
    expect(wrapper.text()).not.toContain('"}]}')

    pendingResponse.close([
      JSON.stringify({
        choices: [{
          delta: {
            content: ',"payload":{"noteId":"note-1","content":"<p>改写后的正文</p>"}}]}',
          },
          finish_reason: 'stop',
        }],
      }),
    ])

    await flushPromises()
    await nextTick()

    expect(wrapper.text()).not.toContain('"toolCalls"')

    wrapper.unmount()
  })

  it('injects a resolved note target into the ai request context for FastNote urls', async () => {
    noteStoreMock.notes.value = [{
      id: 'note-42',
      title: '本地草稿',
      summary: '需要重写',
      content: '<p>本地内容</p>',
      created: '2026-04-16 09:00:00',
      updated: '2026-04-16 09:30:00',
      item_type: 2,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      files: [],
    }]

    const fetchMock = vi.fn(async () => createSseResponse([
      JSON.stringify({
        choices: [{
          delta: {
            role: 'assistant',
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
    const input = await ensureAiMode(wrapper)

    await input.setValue('读取 http://localhost:8888/n/note-42 并帮我重写')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body || '{}'))
    const contextPrompt = body.messages.find((message: { content?: string, role?: string }) => {
      return message.role === 'system' && typeof message.content === 'string' && message.content.includes('前端显式解析目标备忘录')
    })?.content

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(contextPrompt).toContain('note-42')
    expect(contextPrompt).toContain('本地草稿')
    expect(contextPrompt).toContain('消息中的备忘录链接')

    wrapper.unmount()
  })

  it('allows explicit rewrite writeback to run directly and returns a final summary', async () => {
    noteStoreMock.notes.value = [{
      id: 'note-1',
      title: '周报',
      summary: '待整理',
      content: '<p>原文内容</p>',
      created: '2026-04-16 09:00:00',
      updated: '2026-04-16 09:30:00',
      item_type: 2,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      files: [],
    }]

    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async (calls) => {
      expect(calls).toMatchObject([{
        tool: 'update_note',
        requireConfirmation: false,
        confirmed: true,
        payload: {
          noteId: 'note-1',
        },
      }])

      const results = [{
        ok: true,
        code: 'ok',
        message: null,
        preview: {
          title: '准备更新备忘录',
          summary: '将更新备忘录 note-1 的标题、内容或目录信息',
          affectedNoteIds: ['note-1'],
        },
        data: {
          note: {
            ...noteStoreMock.notes.value[0],
            content: '<p>改写后的正文。</p>',
            updated: '2026-04-16 10:00:00',
          },
          source: 'store',
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
                answer: '我会直接写回，并保留改写摘要。',
                toolCalls: [{
                  tool: 'update_note',
                  payload: {
                    noteId: 'note-1',
                    contentHtml: '<p>改写后的正文。</p>',
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
            content: '已直接写回这条笔记，主要调整了语序，并压缩了重复表达。',
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
    const input = await ensureAiMode(wrapper)

    await input.setValue('直接重写 http://localhost:8888/n/note-1 并写回原文')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(aiChatSessionMock.submitToolCalls).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已直接写回这条笔记')
    expect(wrapper.text()).not.toContain('待确认操作')
    expect(wrapper.text()).not.toContain('当前任务')

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

  it('replaces the close button with send and stop actions in ai mode based on draft and streaming state', async () => {
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
    const input = await ensureAiMode(wrapper)

    expect(wrapper.find('button[aria-label="关闭搜索"]').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="发送消息"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="停止生成"]').exists()).toBe(false)
    expect(wrapper.find('.global-search__submit-button').exists()).toBe(false)

    await input.setValue('帮我继续写')
    await nextTick()

    expect(wrapper.find('button[aria-label="关闭搜索"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="发送消息"]').exists()).toBe(true)

    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.find('button[aria-label="发送消息"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="停止生成"]').exists()).toBe(true)
    expect((input.element as HTMLTextAreaElement).value).toBe('')

    pendingResponse.close([
      JSON.stringify({
        choices: [{
          delta: {
            content: '已经继续写完。',
          },
          finish_reason: 'stop',
        }],
      }),
    ])

    await flushPromises()
    await nextTick()

    expect(wrapper.find('button[aria-label="停止生成"]').exists()).toBe(false)
    expect(wrapper.find('button[aria-label="关闭搜索"]').exists()).toBe(true)

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

  it('restores executing tasks as interrupted and lets the user continue manually after remount', async () => {
    const persistedTask = updateAgentTask(createAgentTask('读取这条笔记并帮我总结'), {
      appendStep: {
        kind: 'tool_call',
        title: '模型请求执行本地工具',
        detail: 'get_note_detail',
      },
      status: 'executing',
      terminationReason: 'running',
    })
    localStorage.setItem(createScopedStorageKey('ai-chat-agent-task'), JSON.stringify(persistedTask))

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
            content: '已重新继续任务。',
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
    await ensureAiMode(wrapper)

    expect(wrapper.text()).toContain('已中断')
    expect(wrapper.text()).toContain('页面刷新后任务已中断')
    expect(wrapper.text()).toContain('继续任务')

    const resumeButton = wrapper.findAll('button').find(item => item.text() === '继续任务')
    expect(resumeButton).toBeTruthy()
    await resumeButton!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已重新继续任务。')
    expect(wrapper.text()).not.toContain('当前任务')

    wrapper.unmount()
  })

  it('keeps the current desktop deep link and marks restored tasks for relocation when route objects mismatch', async () => {
    window.history.replaceState(null, '', '/n/note-2')

    const persistedTask = updateAgentTask(createAgentTask('继续处理这条笔记'), {
      routeTargetSnapshot: {
        routePath: '/n/note-1',
        noteId: 'note-1',
        folderId: '',
        parentId: '',
        overlayMode: 'ai',
      },
      status: 'waiting_confirmation',
      terminationReason: 'waiting_confirmation',
    })
    localStorage.setItem(createScopedStorageKey('ai-chat-agent-task'), JSON.stringify(persistedTask))

    const { useAiChat } = await import('@/features/ai-chat')
    useAiChat().saveSettings({
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4.1-mini',
    })

    const wrapper = await mountGlobalSearch()
    await ensureAiMode(wrapper)

    expect(window.location.pathname).toBe('/n/note-2')
    expect(wrapper.text()).toContain('当前页面对象已变化')
    expect(wrapper.text()).toContain('请回到原来的笔记或目录后再继续')
    expect(wrapper.text()).not.toContain('继续任务')

    wrapper.unmount()
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
    expect(wrapper.text()).toContain('当前任务')
    expect(wrapper.text()).toContain('待确认')
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
    expect(wrapper.text()).toContain('已完成')
    expect(wrapper.text()).toContain('本次操作执行结果如下：')
    expect(wrapper.text()).toContain('已完成：将软删除备忘录 note-1')

    wrapper.unmount()
  })

  it('requires confirmation for non-explicit rewrites and continues answering after confirm', async () => {
    noteStoreMock.notes.value = [{
      id: 'note-1',
      title: '周报',
      summary: '待整理',
      content: '<p>原文内容</p>',
      created: '2026-04-16 09:00:00',
      updated: '2026-04-16 09:30:00',
      item_type: 2,
      parent_id: '',
      is_deleted: 0,
      is_locked: 0,
      note_count: 0,
      files: [],
    }]

    aiChatSessionMock.submitToolCalls.mockImplementationOnce(async (calls) => {
      expect(calls).toMatchObject([{
        tool: 'update_note',
        requireConfirmation: true,
        confirmed: false,
        payload: {
          noteId: 'note-1',
        },
      }])

      const results = [{
        ok: true,
        code: 'confirmation_required',
        message: null,
        preview: {
          title: '准备更新备忘录',
          summary: '将更新备忘录 note-1 的标题、内容或目录信息',
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
          title: '准备更新备忘录',
          summary: '将更新备忘录 note-1 的标题、内容或目录信息',
          affectedNoteIds: ['note-1'],
        },
        data: {
          note: {
            ...noteStoreMock.notes.value[0],
            content: '<p>确认后的正文。</p>',
            updated: '2026-04-16 10:10:00',
          },
          source: 'store',
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
                answer: '我先生成改写预览，再等你确认是否写回。',
                toolCalls: [{
                  tool: 'update_note',
                  payload: {
                    noteId: 'note-1',
                    contentHtml: '<p>确认后的正文。</p>',
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
            content: '已按你的确认写回原文，主要调整了结构，并保留了核心信息。',
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
    const input = await ensureAiMode(wrapper)

    await input.setValue('帮我重写 http://localhost:8888/n/note-1')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('待确认操作')
    expect(wrapper.text()).toContain('中风险')
    expect(wrapper.text()).toContain('需确认')

    const confirmButton = wrapper.findAll('button').find(item => item.text() === '确认执行')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(aiChatSessionMock.confirmPendingExecution).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('已按你的确认写回原文')
    expect(wrapper.text()).not.toContain('本次操作执行结果如下：')

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
    expect(wrapper.text()).toContain('2026/4/15')

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
          source: 'store',
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
    expect(JSON.stringify(secondRequestBody)).toContain('readSource: store')
    expect(aiChatSessionMock.submitToolCalls).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('下面是重写后的版本')
    expect(wrapper.text()).toContain('表达更清晰')
    expect(wrapper.text()).not.toContain('本次操作执行结果如下：')
    expect(wrapper.text()).not.toContain('当前任务')

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
