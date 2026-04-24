import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'

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

function createTextareaStub(name: string) {
  return defineComponent({
    name,
    inheritAttrs: false,
    setup(_, { attrs }) {
      return () => h('textarea', {
        value: attrs.value,
        placeholder: attrs.placeholder,
        inputmode: attrs.inputmode,
        enterkeyhint: attrs.enterkeyhint,
        autocomplete: attrs.autocomplete,
        rows: attrs.rows,
        spellcheck: attrs.spellcheck,
        class: attrs.class,
        onFocus: (event: FocusEvent) => {
          ;(attrs.onIonFocus as ((event: FocusEvent) => void) | undefined)?.(event)
          ;(attrs.onFocus as ((event: FocusEvent) => void) | undefined)?.(event)
        },
        onInput: (event: Event) => {
          ;(attrs.onIonInput as ((event: { detail: { event: Event, value: string }, target: EventTarget | null }) => void) | undefined)?.({
            detail: {
              event,
              value: (event.target as HTMLTextAreaElement).value,
            },
            target: event.target,
          })
          ;(attrs.onInput as ((event: Event) => void) | undefined)?.(event)
        },
        onKeydown: attrs.onKeydown as ((event: KeyboardEvent) => void) | undefined,
        onCompositionstart: attrs.onCompositionstart as ((event: CompositionEvent) => void) | undefined,
        onCompositionend: attrs.onCompositionend as ((event: CompositionEvent) => void) | undefined,
      })
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

  vi.doMock('@/features/ai-note-command/model/use-ai-note-command', () => ({
    useAiNoteCommand: () => ({
      executeToolCalls: vi.fn(async (calls: Array<{ confirmed?: boolean }>) => {
        if (calls.some(call => call.confirmed === true)) {
          return [{
            ok: true,
            code: 'ok',
            message: null,
            preview: {
              title: '已执行删除',
              summary: '已软删除备忘录 note-1',
              affectedNoteIds: ['note-1'],
            },
            affectedNoteIds: ['note-1'],
          }]
        }

        return [{
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
      }),
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
    IonTextarea: createTextareaStub('IonTextarea'),
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

describe('ai chat agent feature flag', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('VITE_AI_CHAT_AGENT_ENABLED', 'false')
    window.history.replaceState(null, '', '/home')
    localStorage.clear()
    setupModuleMocks()
  })

  afterEach(async () => {
    const { useAiChat } = await import('@/features/ai-chat')
    const { useGlobalSearch } = await import('@/features/global-search')

    useAiChat().clearConversation()
    useAiChat().resetSettings()
    useGlobalSearch().resetGlobalSearch()

    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    localStorage.clear()
    window.history.replaceState(null, '', '/home')
    document.body.innerHTML = ''
  })

  it('falls back to plain chat and single-round tool mode when agent orchestration is disabled', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(createSseResponse([
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
              content: '普通聊天仍然可用。',
            },
            finish_reason: 'stop',
          }],
        }),
      ]))
      .mockResolvedValueOnce(createSseResponse([
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
              content: '我先按旧模式处理。',
              tool_calls: [{
                index: 0,
                function: {
                  name: 'delete_note',
                  arguments: '{"noteId":"note-1"}',
                },
              }],
            },
            finish_reason: 'tool_calls',
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

    await input.setValue('你好')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('普通聊天仍然可用。')
    expect(wrapper.text()).not.toContain('当前任务')

    await input.setValue('删除 note-1')
    await wrapper.get('button[aria-label="发送消息"]').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('我先按旧模式处理。')
    expect(wrapper.text()).toContain('准备删除备忘录：将软删除备忘录 note-1')
    expect(wrapper.text()).toContain('待确认操作')
    expect(wrapper.text()).not.toContain('当前任务')
    expect(localStorage.getItem(createScopedStorageKey('ai-chat-agent-task'))).toBeNull()

    const confirmButton = wrapper.findAll('button').find(button => button.text() === '确认执行')
    expect(confirmButton).toBeTruthy()
    await confirmButton!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('本次操作执行结果如下：已完成：已软删除备忘录 note-1')
    expect(wrapper.text()).not.toContain('当前任务')
    expect(fetchMock).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })
})
