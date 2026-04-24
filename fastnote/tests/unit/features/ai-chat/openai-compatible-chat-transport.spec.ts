import type { UIMessageChunk } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import {
  buildOpenAiMessages,
  DEFAULT_SYSTEM_PROMPT,
  OpenAiCompatibleChatTransport,
  requestOpenAiCompatibleCompletion,
  resolveChatCompletionsEndpoint,
} from '@/features/ai-chat/model/openai-compatible-chat-transport'
import { AI_CHAT_REQUEST_CONTEXT_BODY_KEY } from '@/features/ai-chat/model/request-context'
import { AI_CHAT_WORKING_MEMORY_BODY_KEY } from '@/features/ai-chat/model/working-memory'

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

async function readChunks(stream: ReadableStream<UIMessageChunk>) {
  const reader = stream.getReader()
  const chunks: UIMessageChunk[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    chunks.push(value)
  }

  return chunks
}

describe('openAiCompatibleChatTransport', () => {
  it('documents direct native tool calling in the default system prompt', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('/n/<noteId>')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('get_note_detail')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('读取这个链接里的备忘录')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('move_note')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('不要用它变更目录')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('搜索、查找、筛选、汇总、归纳、统计、总结某类备忘录')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('自行提炼 2 到 5 个搜索关键词或短语')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('优先把它们用空格拼成一次 search_notes.query 去搜索')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('如果用户要的是总结、对比、归纳')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('@标题(/n/...)')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('优先调用 list_folders')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('调用工具时不要输出 Markdown')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('直接使用工具调用')
  })

  it('normalizes chat completions endpoint', () => {
    expect(resolveChatCompletionsEndpoint('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(resolveChatCompletionsEndpoint('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1/chat/completions')
    expect(resolveChatCompletionsEndpoint('https://example.com/chat/completions')).toBe('https://example.com/chat/completions')
  })

  it('converts OpenAI SSE chunks into UI message chunks', async () => {
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
            content: '这里是流式回复。',
          },
          finish_reason: 'stop',
        }],
      }),
    ]))

    const transport = new OpenAiCompatibleChatTransport({
      fetch: fetchMock as typeof fetch,
      resolveSettings: () => ({
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }),
    })

    const stream = await transport.sendMessages({
      abortSignal: undefined,
      chatId: 'chat-1',
      messageId: undefined,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '你好',
        }],
      }],
      trigger: 'submit-message',
    })

    const chunks = await readChunks(stream)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(chunks.map(chunk => chunk.type)).toEqual([
      'start',
      'text-start',
      'text-delta',
      'text-delta',
      'text-end',
      'finish',
    ])
    expect(chunks.filter(chunk => chunk.type === 'text-delta').map(chunk => chunk.delta).join('')).toBe('你好，这里是流式回复。')
  })

  it('always adds native tools to the request body', async () => {
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

    const transport = new OpenAiCompatibleChatTransport({
      fetch: fetchMock as typeof fetch,
      resolveSettings: () => ({
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }),
    })

    await transport.sendMessages({
      abortSignal: undefined,
      chatId: 'chat-1',
      messageId: undefined,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '帮我搜索周报',
        }],
      }],
      trigger: 'submit-message',
    })

    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body || '{}'))

    expect(body.tool_choice).toBe('auto')
    expect(Array.isArray(body.tools)).toBe(true)
    expect(body.tools[0]?.type).toBe('function')
    expect(body.tools.map((tool: { function?: { name?: string } }) => tool.function?.name)).toContain('search_notes')
  })

  it('emits native tool chunks for streamed tool calls', async () => {
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
            tool_calls: [{
              index: 0,
              function: {
                name: 'search_notes',
                arguments: '{"query":"周报"',
              },
            }],
          },
        }],
      }),
      JSON.stringify({
        choices: [{
          delta: {
            tool_calls: [{
              index: 0,
              function: {
                arguments: '}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      }),
    ]))

    const transport = new OpenAiCompatibleChatTransport({
      fetch: fetchMock as typeof fetch,
      resolveSettings: () => ({
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }),
    })

    const stream = await transport.sendMessages({
      abortSignal: undefined,
      chatId: 'chat-1',
      messageId: undefined,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '帮我搜索周报',
        }],
      }],
      trigger: 'submit-message',
    })

    const chunks = await readChunks(stream)
    const text = chunks
      .filter(chunk => chunk.type === 'text-delta')
      .map(chunk => chunk.delta)
      .join('')

    expect(text).toBe('')
    expect(chunks.some(chunk => chunk.type === 'tool-input-available')).toBe(true)
    expect(chunks.find(chunk => chunk.type === 'tool-input-available')).toMatchObject({
      type: 'tool-input-available',
      toolName: 'search_notes',
      input: {
        query: '周报',
      },
    })
  })

  it('injects local context and working memory as system messages and strips internal request fields', async () => {
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

    const transport = new OpenAiCompatibleChatTransport({
      fetch: fetchMock as typeof fetch,
      resolveSettings: () => ({
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      }),
    })

    await transport.sendMessages({
      abortSignal: undefined,
      body: {
        [AI_CHAT_REQUEST_CONTEXT_BODY_KEY]: {
          source: 'home_global_search',
          activeNote: {
            id: 'note-1',
            title: '周报',
            summary: '需要整理',
            parentId: '',
            updated: '2026-04-15 10:00:00',
            isDeleted: false,
            isLocked: false,
          },
          resolvedTarget: {
            source: 'message_note_url',
            note: {
              id: 'note-2',
              title: '链接里的周报',
              summary: '需要优先处理',
              parentId: '',
              updated: '2026-04-16 09:00:00',
              isDeleted: false,
              isLocked: false,
            },
          },
        },
        [AI_CHAT_WORKING_MEMORY_BODY_KEY]: {
          version: 1,
          taskId: 'task-1',
          scope: 'private',
          status: 'summarized',
          taskSummary: '读取链接里的周报并总结重点',
          latestToolResultSummary: '已读取正文',
          lastCompressionAt: '2026-04-23T10:00:00.000Z',
          sourceMessageIds: ['msg-1'],
        },
        temperature: 0.3,
      },
      chatId: 'chat-1',
      messageId: undefined,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '帮我处理当前备忘录',
        }],
      }],
      trigger: 'submit-message',
    })

    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body || '{}'))

    expect(body.temperature).toBe(0.3)
    expect(body[AI_CHAT_REQUEST_CONTEXT_BODY_KEY]).toBeUndefined()
    expect(body[AI_CHAT_WORKING_MEMORY_BODY_KEY]).toBeUndefined()
    expect(body.messages[0]).toMatchObject({
      role: 'system',
    })
    expect(body.messages[1]).toMatchObject({
      role: 'system',
    })
    expect(body.messages[1].content).toContain('当前选中备忘录')
    expect(body.messages[1].content).toContain('前端显式解析目标备忘录')
    expect(body.messages[2]).toMatchObject({
      role: 'system',
    })
    expect(body.messages[2].content).toContain('任务工作记忆')
    expect(body.messages[2].content).toContain('读取链接里的周报并总结重点')
    expect(body.messages[3]).toMatchObject({
      role: 'user',
      content: '帮我处理当前备忘录',
    })
  })

  it('drops compressed middle messages when working memory marks them as summarized', () => {
    const messages = buildOpenAiMessages([
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: '第一条' }],
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [{ type: 'text', text: '第二条' }],
      },
      {
        id: 'msg-3',
        role: 'user',
        parts: [{ type: 'text', text: '第三条' }],
      },
    ], '系统提示', '', '任务工作记忆', {
      version: 1,
      taskId: 'task-1',
      scope: 'private',
      status: 'summarized',
      taskSummary: '已压缩历史',
      lastCompressionAt: '2026-04-23T10:00:00.000Z',
      sourceMessageIds: ['msg-2'],
    })

    expect(messages.map(message => `${message.role}:${message.content}`)).toEqual([
      'system:系统提示',
      'system:任务工作记忆',
      'user:第一条',
      'user:第三条',
    ])
  })

  it('returns structured native tool calls for non-stream completions', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: '先读取这条笔记。',
          tool_calls: [{
            type: 'function',
            function: {
              name: 'get_note_detail',
              arguments: '{"noteId":"note-1"}',
            },
          }],
        },
        finish_reason: 'tool_calls',
      }],
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    }))

    const result = await requestOpenAiCompatibleCompletion({
      fetchImplementation: fetchMock as typeof fetch,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '读取 note-1',
        }],
      }],
      settings: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      },
    })

    expect(result).toEqual({
      text: '先读取这条笔记。',
      toolCalls: [{
        tool: 'get_note_detail',
        payload: {
          noteId: 'note-1',
        },
      }],
    })
  })

  it('can disable tool exposure for text-only completions', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: '这是摘要结果。',
        },
        finish_reason: 'stop',
      }],
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    }))

    const result = await requestOpenAiCompatibleCompletion({
      allowTools: false,
      fetchImplementation: fetchMock as typeof fetch,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '总结一下',
        }],
      }],
      settings: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      },
    })

    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body || '{}'))

    expect(body.tools).toBeUndefined()
    expect(body.tool_choice).toBeUndefined()
    expect(result).toEqual({
      text: '这是摘要结果。',
      toolCalls: [],
    })
  })

  it('uses raw OpenAI messages directly for follow-up native tool turns', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          role: 'assistant',
          content: '已基于工具结果继续回答。',
        },
        finish_reason: 'stop',
      }],
    }), {
      headers: {
        'Content-Type': 'application/json',
      },
      status: 200,
    }))

    await requestOpenAiCompatibleCompletion({
      fetchImplementation: fetchMock as typeof fetch,
      messages: [{
        id: 'user-1',
        role: 'user',
        parts: [{
          type: 'text',
          text: '这条不会被发送',
        }],
      }],
      rawMessages: [{
        role: 'assistant',
        content: '',
        tool_calls: [{
          id: 'tool-call-1',
          type: 'function',
          function: {
            name: 'search_notes',
            arguments: '{"query":"周报"}',
          },
        }],
      }, {
        role: 'tool',
        tool_call_id: 'tool-call-1',
        content: '{"ok":true,"code":"ok"}',
      }],
      settings: {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
      },
    })

    const request = fetchMock.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body || '{}'))

    expect(body.tools).toBeDefined()
    expect(body.messages).toEqual([{
      role: 'assistant',
      content: '',
      tool_calls: [{
        id: 'tool-call-1',
        type: 'function',
        function: {
          name: 'search_notes',
          arguments: '{"query":"周报"}',
        },
      }],
    }, {
      role: 'tool',
      tool_call_id: 'tool-call-1',
      content: '{"ok":true,"code":"ok"}',
    }])
  })
})
