import type {
  ChatRequestOptions,
  ChatTransport,
  UIMessage,
  UIMessageChunk,
} from 'ai'
import { nanoid } from 'nanoid'
import {
  buildAiChatContextSystemPrompt,
  extractAiChatRequestContext,
} from './request-context'

export interface OpenAiCompatibleChatSettings {
  apiKey: string
  baseUrl: string
  model: string
}

export interface OpenAiCompatibleChatTransportOptions {
  fetch?: typeof fetch
  resolveSettings: () => OpenAiCompatibleChatSettings
  systemPrompt?: string
}

interface OpenAiCompatibleMessage {
  content: string
  role: 'assistant' | 'system' | 'user'
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      content?: string | Array<{ text?: string }>
      role?: string
    }
  }>
  error?: {
    message?: string
  }
}

interface OpenAiChatCompletionChunk {
  choices?: Array<{
    delta?: {
      content?: string | Array<{ text?: string }>
      role?: string
    }
    finish_reason?: string | null
  }>
  error?: {
    message?: string
  }
}

type UiMessageFinishReason = 'stop' | 'length' | 'content-filter' | 'error' | 'other'
type OpenAiDeltaPayload = NonNullable<OpenAiChatCompletionChunk['choices']>[number]['delta']

const OPENAI_CHAT_COMPLETIONS_PATH = '/chat/completions'
export const DEFAULT_SYSTEM_PROMPT = [
  '你是 FastNote 首页里的 AI 助手。',
  '回答保持简洁、直接、可执行，优先帮助用户处理笔记与整理信息。',
  '当用户只是提问、改写、解释时，直接用自然语言回答。',
  '当用户明确要求执行笔记或文件夹操作时，你可以返回一个 JSON 对象来请求本地工具执行。',
  '如果用户消息里直接给出了 FastNote 链接或路径，例如 http://localhost:8888/n/<noteId>、https://域名/n/<noteId>、/n/<noteId>，你可以直接从 URL 提取 noteId，并调用 get_note_detail 读取该备忘录内容。',
  '如果用户给出的是 FastNote 文件夹链接或路径，例如 /f/...，你也可以直接从 URL 提取目录信息并调用 list_folders 或结合其他工具继续处理。',
  '当用户要求“读取这个链接里的备忘录并帮我改写/总结/润色”时，优先先调用 get_note_detail，再基于读取到的内容继续回答或继续请求工具。',
  '返回工具请求时，不要输出 Markdown，不要输出解释文字，只返回合法 JSON。',
  '工具请求 JSON 格式如下：{"mode":"tool_calls","answer":"可选的简短说明","toolCalls":[{"tool":"search_notes","payload":{"query":"关键词"}}]}。',
  '可用工具包括：search_notes、get_note_detail、list_folders、create_note、update_note、move_note、delete_note、set_note_lock。',
  '只有在你能够明确构造参数时才返回工具请求；否则继续用自然语言说明你还缺少什么信息。',
].join('\n')

export class OpenAiCompatibleChatTransport implements ChatTransport<UIMessage> {
  private readonly fetchImplementation?: typeof fetch
  private readonly resolveSettings: () => OpenAiCompatibleChatSettings
  private readonly systemPrompt: string

  constructor(options: OpenAiCompatibleChatTransportOptions) {
    this.fetchImplementation = options.fetch
    this.resolveSettings = options.resolveSettings
    this.systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT
  }

  async sendMessages({
    abortSignal,
    body,
    headers,
    messages,
  }: {
    abortSignal: AbortSignal | undefined
    chatId: string
    headers?: Record<string, string> | Headers
    messageId: string | undefined
    messages: UIMessage[]
    metadata?: unknown
    trigger: 'submit-message' | 'regenerate-message'
  } & ChatRequestOptions): Promise<ReadableStream<UIMessageChunk>> {
    const settings = this.resolveSettings()
    assertCompleteSettings(settings)
    const { context, requestBody: extraRequestBody } = extractAiChatRequestContext(body)
    const contextSystemPrompt = buildAiChatContextSystemPrompt(context)

    const response = await requestOpenAiCompatibleResponse({
      abortSignal,
      body: {
        model: settings.model,
        stream: true,
        messages: buildOpenAiMessages(messages, this.systemPrompt, contextSystemPrompt),
        ...extraRequestBody,
      },
      fetchImplementation: this.fetchImplementation,
      headers,
      settings,
    })

    if (!response.ok) {
      throw new Error(await resolveOpenAiError(response))
    }

    if (!response.body) {
      throw new Error('AI 服务没有返回可读取的数据流')
    }

    return createUiMessageChunkStream(response.body)
  }

  async reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return null
  }
}

function assertCompleteSettings(settings: OpenAiCompatibleChatSettings) {
  if (!settings.baseUrl.trim()) {
    throw new Error('请先配置 AI Base URL')
  }

  if (!settings.apiKey.trim()) {
    throw new Error('请先配置 AI API Key')
  }

  if (!settings.model.trim()) {
    throw new Error('请先配置 AI 模型名称')
  }
}

function toRecord(headers?: Record<string, string> | Headers) {
  if (!headers) {
    return {}
  }

  if (headers instanceof Headers) {
    const values: Record<string, string> = {}
    headers.forEach((value, key) => {
      values[key] = value
    })
    return values
  }

  return headers
}

export function buildOpenAiMessages(messages: UIMessage[], systemPrompt: string, contextSystemPrompt = ''): OpenAiCompatibleMessage[] {
  const requestMessages: OpenAiCompatibleMessage[] = []

  if (systemPrompt.trim()) {
    requestMessages.push({
      role: 'system',
      content: systemPrompt.trim(),
    })
  }

  if (contextSystemPrompt.trim()) {
    requestMessages.push({
      role: 'system',
      content: contextSystemPrompt.trim(),
    })
  }

  for (const message of messages) {
    const content = extractPlainText(message)
    if (!content) {
      continue
    }

    if (message.role === 'user' || message.role === 'assistant' || message.role === 'system') {
      requestMessages.push({
        role: message.role,
        content,
      })
    }
  }

  return requestMessages
}

interface RequestOpenAiCompatibleResponseOptions {
  abortSignal?: AbortSignal
  body: Record<string, unknown>
  fetchImplementation?: typeof fetch
  headers?: Record<string, string> | Headers
  settings: OpenAiCompatibleChatSettings
}

async function requestOpenAiCompatibleResponse(options: RequestOpenAiCompatibleResponseOptions) {
  const { abortSignal, body, fetchImplementation, headers, settings } = options

  return await (fetchImplementation || globalThis.fetch)(
    resolveChatCompletionsEndpoint(settings.baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        ...toRecord(headers),
      },
      body: JSON.stringify(body),
      signal: abortSignal,
    },
  )
}

function extractCompletionMessageText(payload: OpenAiChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content
  if (typeof content === 'string') {
    return content.trim()
  }

  if (Array.isArray(content)) {
    return content
      .map(item => typeof item?.text === 'string' ? item.text : '')
      .join('')
      .trim()
  }

  return ''
}

export async function requestOpenAiCompatibleCompletion(options: {
  abortSignal?: AbortSignal
  body?: Record<string, unknown>
  fetchImplementation?: typeof fetch
  headers?: Record<string, string> | Headers
  messages: UIMessage[]
  settings: OpenAiCompatibleChatSettings
  systemPrompt?: string
}) {
  const response = await requestOpenAiCompatibleResponse({
    abortSignal: options.abortSignal,
    body: {
      model: options.settings.model,
      stream: false,
      messages: buildOpenAiMessages(options.messages, options.systemPrompt || DEFAULT_SYSTEM_PROMPT),
      ...(options.body || {}),
    },
    fetchImplementation: options.fetchImplementation,
    headers: options.headers,
    settings: options.settings,
  })

  if (!response.ok) {
    throw new Error(await resolveOpenAiError(response))
  }

  const payload = await response.json() as OpenAiChatCompletionResponse
  return extractCompletionMessageText(payload)
}

function extractPlainText(message: UIMessage) {
  return message.parts
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text
      }

      return ''
    })
    .join('\n')
    .trim()
}

async function resolveOpenAiError(response: Response) {
  const fallback = `AI 请求失败（${response.status}）`

  try {
    const payload = await response.json() as OpenAiChatCompletionChunk
    return payload.error?.message || fallback
  }
  catch {
    const text = await response.text()
    return text || fallback
  }
}

function createUiMessageChunkStream(
  responseStream: ReadableStream<Uint8Array>,
): ReadableStream<UIMessageChunk> {
  const messageId = nanoid()
  const textPartId = nanoid()

  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      const reader = responseStream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let hasStarted = false
      let hasTextStarted = false
      let hasFinished = false

      const emitStart = () => {
        if (hasStarted) {
          return
        }

        hasStarted = true
        controller.enqueue({
          type: 'start',
          messageId,
        })
      }

      const emitTextStart = () => {
        emitStart()
        if (hasTextStarted) {
          return
        }

        hasTextStarted = true
        controller.enqueue({
          type: 'text-start',
          id: textPartId,
        })
      }

      const emitFinish = (finishReason: UiMessageFinishReason = 'stop') => {
        if (hasFinished) {
          return
        }

        emitStart()

        if (hasTextStarted) {
          controller.enqueue({
            type: 'text-end',
            id: textPartId,
          })
        }

        hasFinished = true
        controller.enqueue({
          type: 'finish',
          finishReason,
        })
      }

      try {
        let streamClosedByProtocol = false

        while (true) {
          const { done, value } = await reader.read()

          if (done || streamClosedByProtocol) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const parsed = splitSseEvents(buffer)
          buffer = parsed.rest

          for (const eventData of parsed.events) {
            if (!eventData || eventData === '[DONE]') {
              emitFinish()
              streamClosedByProtocol = true
              break
            }

            const payload = JSON.parse(eventData) as OpenAiChatCompletionChunk
            if (payload.error?.message) {
              throw new Error(payload.error.message)
            }

            const choice = payload.choices?.[0]
            if (!choice) {
              continue
            }

            emitStart()

            const deltaText = extractDeltaText(choice.delta)
            if (deltaText) {
              emitTextStart()
              controller.enqueue({
                type: 'text-delta',
                id: textPartId,
                delta: deltaText,
              })
            }

            if (choice.finish_reason) {
              emitFinish(mapFinishReason(choice.finish_reason))
              streamClosedByProtocol = true
              break
            }
          }
        }

        emitFinish()
        controller.close()
      }
      catch (error) {
        controller.error(toError(error))
      }
      finally {
        reader.releaseLock()
      }
    },
  })
}

function splitSseEvents(buffer: string) {
  const chunks = buffer.split(/\r?\n\r?\n/)
  const rest = chunks.pop() || ''

  return {
    rest,
    events: chunks
      .map(chunk => chunk
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n'))
      .filter(Boolean),
  }
}

function extractDeltaText(delta?: OpenAiDeltaPayload) {
  if (!delta) {
    return ''
  }

  if (typeof delta.content === 'string') {
    return delta.content
  }

  if (Array.isArray(delta.content)) {
    return delta.content
      .map(part => part.text || '')
      .join('')
  }

  return ''
}

function mapFinishReason(reason: string): UiMessageFinishReason {
  switch (reason) {
    case 'stop':
      return 'stop'
    case 'length':
      return 'length'
    case 'content_filter':
      return 'content-filter'
    default:
      return 'other'
  }
}

function toError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  return new Error('AI 数据流解析失败')
}

export function resolveChatCompletionsEndpoint(baseUrl: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')

  if (!normalizedBaseUrl) {
    return OPENAI_CHAT_COMPLETIONS_PATH
  }

  if (normalizedBaseUrl.endsWith(OPENAI_CHAT_COMPLETIONS_PATH)) {
    return normalizedBaseUrl
  }

  return `${normalizedBaseUrl}${OPENAI_CHAT_COMPLETIONS_PATH}`
}
