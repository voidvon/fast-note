import { flushPromises, mount } from '@vue/test-utils'
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

async function mountGlobalSearch() {
  const GlobalSearch = (await import('@/features/global-search/ui/global-search.vue')).default
  return mount(GlobalSearch, {
    attachTo: document.body,
    props: {
      syncWithRoute: false,
    },
  })
}

describe('global search ai chat', () => {
  beforeEach(() => {
    vi.resetModules()

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
    const input = wrapper.get('input')

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
    const input = wrapper.get('input')

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
    const input = wrapper.get('input')

    await input.trigger('focus')
    await wrapper.get('button[aria-label="切换到 AI 对话"]').trigger('click')
    await nextTick()

    await input.setValue('马上清空')
    const clickPromise = wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await nextTick()

    expect((input.element as HTMLInputElement).value).toBe('')

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
})
