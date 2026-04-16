import type { UIMessageChunk } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SYSTEM_PROMPT,
  OpenAiCompatibleChatTransport,
  resolveChatCompletionsEndpoint,
} from '@/features/ai-chat/model/openai-compatible-chat-transport'
import { AI_CHAT_REQUEST_CONTEXT_BODY_KEY } from '@/features/ai-chat/model/request-context'

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
  it('documents FastNote note urls in the default system prompt', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('/n/<noteId>')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('get_note_detail')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('读取这个链接里的备忘录')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('move_note')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('不要用它变更目录')
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

  it('injects local context as a system message and strips internal request fields', async () => {
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
    expect(body.messages[0]).toMatchObject({
      role: 'system',
    })
    expect(body.messages[1]).toMatchObject({
      role: 'system',
    })
    expect(body.messages[1].content).toContain('当前选中备忘录')
    expect(body.messages[1].content).toContain('前端显式解析目标备忘录')
    expect(body.messages[2]).toMatchObject({
      role: 'user',
      content: '帮我处理当前备忘录',
    })
  })
})
