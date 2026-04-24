import type { Note } from '@/shared/types'

export const AI_CHAT_REQUEST_CONTEXT_BODY_KEY = '_fastnoteRequestContext'
const MAX_CONTEXT_NOTES = 5
const MAX_MENTIONED_TARGETS = 8
const MAX_TITLE_LENGTH = 24
const MAX_SUMMARY_LENGTH = 48

export interface AiChatContextNote {
  id: string
  title: string
  summary: string
  parentId: string
  updated: string
  isDeleted: boolean
  isLocked: boolean
}

export interface AiChatContextFolder {
  id: string
  title: string
  kind: 'folder' | 'special'
}

export interface AiChatResolvedTarget {
  folder?: AiChatContextFolder | null
  note?: AiChatContextNote | null
  source: 'active_folder' | 'active_note' | 'message_folder_url' | 'message_note_url'
}

export interface AiChatMentionedTarget {
  id: string
  parentId?: string
  routePath: string
  source: 'message_mention'
  title: string
  type: 'folder' | 'note'
  updated?: string
}

export interface AiChatRequestContext {
  activeFolder?: AiChatContextFolder | null
  activeNote?: AiChatContextNote | null
  candidateNotes?: AiChatContextNote[]
  mentionedTargets?: AiChatMentionedTarget[]
  publicUserId?: string | null
  recentNotes?: AiChatContextNote[]
  resolvedTarget?: AiChatResolvedTarget | null
  routePath?: string
  source?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function truncateText(value: string | undefined, maxLength: number) {
  const text = value?.trim() || ''
  if (!text) {
    return ''
  }

  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, Math.max(0, maxLength - 1))}…`
}

function normalizeContextNote(value: unknown): AiChatContextNote | null {
  if (!isRecord(value) || typeof value.id !== 'string') {
    return null
  }

  return {
    id: value.id,
    title: truncateText(typeof value.title === 'string' ? value.title : '', MAX_TITLE_LENGTH) || '未命名',
    summary: truncateText(typeof value.summary === 'string' ? value.summary : '', MAX_SUMMARY_LENGTH),
    parentId: typeof value.parentId === 'string' ? value.parentId : '',
    updated: typeof value.updated === 'string' ? value.updated : '',
    isDeleted: value.isDeleted === true,
    isLocked: value.isLocked === true,
  }
}

function normalizeContextFolder(value: unknown): AiChatContextFolder | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return null
  }

  return {
    id: value.id,
    title: truncateText(value.title, MAX_TITLE_LENGTH) || '未命名目录',
    kind: value.kind === 'special' ? 'special' : 'folder',
  }
}

function normalizeContextNoteList(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => normalizeContextNote(item))
    .filter((item): item is AiChatContextNote => !!item)
    .slice(0, MAX_CONTEXT_NOTES)
}

function normalizeMentionedTarget(value: unknown): AiChatMentionedTarget | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.title !== 'string' || typeof value.routePath !== 'string') {
    return null
  }

  return {
    id: value.id,
    parentId: typeof value.parentId === 'string' ? value.parentId : '',
    routePath: value.routePath.trim(),
    source: value.source === 'message_mention' ? 'message_mention' : 'message_mention',
    title: truncateText(value.title, MAX_TITLE_LENGTH) || '未命名',
    type: value.type === 'folder' ? 'folder' : 'note',
    updated: typeof value.updated === 'string' ? value.updated : '',
  }
}

function normalizeMentionedTargets(value: unknown) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(item => normalizeMentionedTarget(item))
    .filter((item): item is AiChatMentionedTarget => !!item)
    .slice(0, MAX_MENTIONED_TARGETS)
}

function normalizeResolvedTarget(value: unknown): AiChatResolvedTarget | null {
  if (!isRecord(value) || typeof value.source !== 'string') {
    return null
  }

  const source = value.source === 'active_folder'
    || value.source === 'active_note'
    || value.source === 'message_folder_url'
    || value.source === 'message_note_url'
    ? value.source
    : null

  if (!source) {
    return null
  }

  const note = normalizeContextNote(value.note)
  const folder = normalizeContextFolder(value.folder)
  if (!note && !folder) {
    return null
  }

  return {
    source,
    note,
    folder,
  }
}

export function normalizeAiChatRequestContext(value: unknown): AiChatRequestContext | null {
  if (!isRecord(value)) {
    return null
  }

  const source = typeof value.source === 'string' ? value.source.trim() : ''
  const routePath = typeof value.routePath === 'string' ? value.routePath.trim() : ''
  const publicUserId = typeof value.publicUserId === 'string' ? value.publicUserId : null
  const activeFolder = normalizeContextFolder(value.activeFolder)
  const activeNote = normalizeContextNote(value.activeNote)
  const candidateNotes = normalizeContextNoteList(value.candidateNotes)
  const mentionedTargets = normalizeMentionedTargets(value.mentionedTargets)
  const recentNotes = normalizeContextNoteList(value.recentNotes)
  const resolvedTarget = normalizeResolvedTarget(value.resolvedTarget)

  if (!source
    && !routePath
    && !publicUserId
    && !activeFolder
    && !activeNote
    && !candidateNotes.length
    && !mentionedTargets.length
    && !recentNotes.length
    && !resolvedTarget) {
    return null
  }

  const context: AiChatRequestContext = {}
  if (source) {
    context.source = source
  }
  if (routePath) {
    context.routePath = routePath
  }
  if (publicUserId) {
    context.publicUserId = publicUserId
  }
  if (activeFolder) {
    context.activeFolder = activeFolder
  }
  if (activeNote) {
    context.activeNote = activeNote
  }
  if (candidateNotes.length) {
    context.candidateNotes = candidateNotes
  }
  if (mentionedTargets.length) {
    context.mentionedTargets = mentionedTargets
  }
  if (recentNotes.length) {
    context.recentNotes = recentNotes
  }
  if (resolvedTarget) {
    context.resolvedTarget = resolvedTarget
  }

  return context
}

export function omitAiChatRequestContextRoutePath(context: AiChatRequestContext | null | undefined) {
  const normalizedContext = normalizeAiChatRequestContext(context)
  if (!normalizedContext) {
    return null
  }

  const { routePath: _, ...rest } = normalizedContext
  return normalizeAiChatRequestContext(rest)
}

function formatNoteLine(note: AiChatContextNote) {
  const suffixParts = [
    note.isLocked ? '已加锁' : '',
    note.isDeleted ? '已删除' : '',
    note.updated ? `更新于 ${note.updated}` : '',
  ].filter(Boolean)

  return `${note.title} [${note.id}]${note.summary ? `｜${note.summary}` : ''}${suffixParts.length ? `｜${suffixParts.join('｜')}` : ''}`
}

function formatNoteSection(title: string, notes: AiChatContextNote[] | undefined) {
  if (!notes?.length) {
    return []
  }

  return [
    `- ${title}：`,
    ...notes.map((note, index) => `  ${index + 1}. ${formatNoteLine(note)}`),
  ]
}

function formatMentionedTargetLine(target: AiChatMentionedTarget) {
  const typeLabel = target.type === 'folder' ? '目录' : '备忘录'
  const suffixParts = [
    target.routePath,
    target.updated ? `更新于 ${target.updated}` : '',
  ].filter(Boolean)

  return `${typeLabel}：${target.title} [${target.id}]${suffixParts.length ? `｜${suffixParts.join('｜')}` : ''}`
}

function formatMentionedTargetSection(targets: AiChatMentionedTarget[] | undefined) {
  if (!targets?.length) {
    return []
  }

  return [
    '- 消息中显式提及的对象：',
    ...targets.map((target, index) => `  ${index + 1}. ${formatMentionedTargetLine(target)}`),
  ]
}

function getResolvedTargetSourceLabel(source: AiChatResolvedTarget['source']) {
  switch (source) {
    case 'active_note':
      return '当前活动备忘录'
    case 'active_folder':
      return '当前活动目录'
    case 'message_note_url':
      return '消息中的备忘录链接'
    case 'message_folder_url':
      return '消息中的目录链接'
  }
}

export function buildAiChatContextSystemPrompt(context: AiChatRequestContext | null | undefined) {
  const normalizedContext = normalizeAiChatRequestContext(context)
  if (!normalizedContext) {
    return ''
  }

  const lines = [
    '以下是 fastnote 前端注入的本地上下文，仅用于帮助你理解当前界面与定位目标，不等于用户已经确认执行对象。',
    '当涉及删除、移动、加锁、改写等操作时，如果目标不够明确，先调用查询工具或继续向用户确认，不要臆造 noteId。',
  ]

  if (normalizedContext.source) {
    lines.push(`- 当前入口：${normalizedContext.source}`)
  }

  if (normalizedContext.routePath) {
    lines.push(`- 当前路由：${normalizedContext.routePath}`)
  }

  if (normalizedContext.publicUserId) {
    lines.push(`- 当前公开空间用户：${normalizedContext.publicUserId}`)
  }

  if (normalizedContext.activeFolder) {
    lines.push(`- 当前目录：${normalizedContext.activeFolder.title} [${normalizedContext.activeFolder.id}]`)
  }

  if (normalizedContext.activeNote) {
    lines.push(`- 当前选中备忘录：${formatNoteLine(normalizedContext.activeNote)}`)
  }

  if (normalizedContext.resolvedTarget?.note) {
    lines.push(`- 前端显式解析目标备忘录：${formatNoteLine(normalizedContext.resolvedTarget.note)}｜来源：${getResolvedTargetSourceLabel(normalizedContext.resolvedTarget.source)}`)
  }

  if (normalizedContext.resolvedTarget?.folder) {
    lines.push(`- 前端显式解析目标目录：${normalizedContext.resolvedTarget.folder.title} [${normalizedContext.resolvedTarget.folder.id}]｜来源：${getResolvedTargetSourceLabel(normalizedContext.resolvedTarget.source)}`)
  }

  if (normalizedContext.resolvedTarget) {
    lines.push('- 若用户本轮指令与该显式目标一致，优先围绕该对象继续读取、改写或执行后续工具，不要忽略这个对象。')
  }

  lines.push(...formatMentionedTargetSection(normalizedContext.mentionedTargets))
  lines.push(...formatNoteSection('当前候选备忘录', normalizedContext.candidateNotes))
  lines.push(...formatNoteSection('最近更新的备忘录', normalizedContext.recentNotes))

  return lines.join('\n')
}

export function extractAiChatRequestContext(body: unknown) {
  if (!isRecord(body)) {
    return {
      context: null,
      requestBody: {},
    }
  }

  const requestBody: Record<string, unknown> = { ...body }
  const context = normalizeAiChatRequestContext(requestBody[AI_CHAT_REQUEST_CONTEXT_BODY_KEY])
  delete requestBody[AI_CHAT_REQUEST_CONTEXT_BODY_KEY]

  return {
    context,
    requestBody,
  }
}

export function toAiChatContextNote(note: Note | null | undefined): AiChatContextNote | null {
  if (!note?.id) {
    return null
  }

  return {
    id: note.id,
    title: truncateText(note.title, MAX_TITLE_LENGTH) || '未命名',
    summary: truncateText(note.summary || note.content || '', MAX_SUMMARY_LENGTH),
    parentId: note.parent_id || '',
    updated: note.updated || '',
    isDeleted: note.is_deleted === 1,
    isLocked: note.is_locked === 1,
  }
}
