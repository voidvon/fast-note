import type { UIMessageChunk } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import {
  OpenAiCompatibleChatTransport,
  resolveChatCompletionsEndpoint,
} from '@/features/ai-chat/model/openai-compatible-chat-transport'

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
})
