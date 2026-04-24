import type { AiNoteToolCall } from '@/shared/types'
import type { AiChatRequestContext } from './request-context'

export type AiAgentMutationRiskLevel = 'none' | 'low' | 'medium' | 'high'
export type AiAgentConfirmationMode = 'none' | 'direct' | 'required'

export interface AiAgentMutationPolicy {
  call: AiNoteToolCall
  confirmationMode: AiAgentConfirmationMode
  reason: string
  rewriteSuggestion: string
  riskLevel: AiAgentMutationRiskLevel
}

function htmlToPlainText(contentHtml: string) {
  const normalized = contentHtml.trim()
  if (!normalized) {
    return ''
  }

  if (typeof DOMParser !== 'undefined') {
    const document = new DOMParser().parseFromString(normalized, 'text/html')
    return document.body.textContent?.replace(/\n{3,}/g, '\n\n').trim() || ''
  }

  return normalized
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function resolveWritableTargetNoteId(context: AiChatRequestContext | null | undefined) {
  return context?.resolvedTarget?.note?.id
    || context?.activeNote?.id
    || ''
}

function isContentRewritePayload(call: Extract<AiNoteToolCall, { tool: 'update_note' }>) {
  return typeof call.payload.content === 'string'
    || typeof call.payload.contentHtml === 'string'
    || typeof call.payload.appendContentHtml === 'string'
}

function resolveRewriteContent(call: Extract<AiNoteToolCall, { tool: 'update_note' }>) {
  if (typeof call.payload.contentHtml === 'string') {
    return call.payload.contentHtml
  }

  if (typeof call.payload.content === 'string') {
    return call.payload.content
  }

  return typeof call.payload.contentHtml === 'string'
    ? call.payload.contentHtml
    : typeof call.payload.appendContentHtml === 'string'
      ? call.payload.appendContentHtml
      : ''
}

function toRewriteSuggestion(call: Extract<AiNoteToolCall, { tool: 'update_note' }>) {
  const rewriteContent = resolveRewriteContent(call)
  if (rewriteContent) {
    return htmlToPlainText(rewriteContent)
  }

  return ''
}

function isExplicitDirectWriteCall(call: Extract<AiNoteToolCall, { tool: 'update_note' }>) {
  return call.confirmed === true && call.requireConfirmation !== true
}

export function applyAgentMutationPolicy(
  call: AiNoteToolCall,
  _taskInput: string,
  context: AiChatRequestContext | null | undefined,
): AiAgentMutationPolicy {
  switch (call.tool) {
    case 'delete_note':
    case 'move_note':
    case 'set_note_lock':
      return {
        call: {
          ...call,
          confirmed: false,
          requireConfirmation: true,
        },
        confirmationMode: 'required',
        reason: '高风险写操作默认进入确认预览',
        rewriteSuggestion: '',
        riskLevel: 'high',
      }
    case 'create_note':
      return {
        call: {
          ...call,
          requireConfirmation: false,
        },
        confirmationMode: 'direct',
        reason: '创建操作保持直接执行',
        rewriteSuggestion: '',
        riskLevel: 'low',
      }
    case 'update_note': {
      const rewriteSuggestion = toRewriteSuggestion(call)
      const writableTargetNoteId = resolveWritableTargetNoteId(context)
      const matchesResolvedTarget = !!call.payload.noteId && call.payload.noteId === writableTargetNoteId
      const hasDirectWriteIntent = isExplicitDirectWriteCall(call)
      const isRewritePayload = isContentRewritePayload(call)

      if (typeof call.payload.parentId === 'string' && call.payload.parentId.trim()) {
        return {
          call: {
            ...call,
            confirmed: false,
            requireConfirmation: true,
          },
          confirmationMode: 'required',
          reason: '涉及目录变更的更新一律先确认',
          rewriteSuggestion,
          riskLevel: 'high',
        }
      }

      if (hasDirectWriteIntent && matchesResolvedTarget && isRewritePayload) {
        return {
          call: {
            ...call,
            confirmed: true,
            requireConfirmation: false,
          },
        confirmationMode: 'direct',
        reason: '模型已显式请求直写且目标唯一，允许直接写回',
        rewriteSuggestion,
        riskLevel: 'low',
      }
      }

      return {
        call: {
          ...call,
          confirmed: false,
          requireConfirmation: true,
        },
        confirmationMode: 'required',
        reason: matchesResolvedTarget
          ? '未命中显式直写标记，改写默认先确认'
          : '写操作目标未与当前唯一对象对齐，默认先确认',
        rewriteSuggestion,
        riskLevel: 'medium',
      }
    }
    default:
      return {
        call,
        confirmationMode: 'none',
        reason: '',
        rewriteSuggestion: '',
        riskLevel: 'none',
      }
  }
}

export function getHighestMutationRiskLevel(levels: AiAgentMutationRiskLevel[]): AiAgentMutationRiskLevel {
  if (levels.includes('high')) {
    return 'high'
  }

  if (levels.includes('medium')) {
    return 'medium'
  }

  if (levels.includes('low')) {
    return 'low'
  }

  return 'none'
}

export function getHighestConfirmationMode(modes: AiAgentConfirmationMode[]): AiAgentConfirmationMode {
  if (modes.includes('required')) {
    return 'required'
  }

  if (modes.includes('direct')) {
    return 'direct'
  }

  return 'none'
}
