import type {
  AiChatMentionedTarget,
  AiChatRequestContext,
} from './request-context'

const MENTION_ROUTE_PATTERN = /@([^()\n]+?)\(((?:https?:\/\/[^\s)]+)?\/([nf])\/([^)\s/#?]+))\)/g

function normalizeTitle(title: string) {
  return title.trim() || '未命名'
}

function buildRelativeRoutePath(type: 'folder' | 'note', id: string) {
  const prefix = type === 'folder' ? '/f/' : '/n/'
  return `${prefix}${encodeURIComponent(id)}`
}

function findContextNoteById(id: string, context: AiChatRequestContext | null | undefined) {
  return [
    context?.activeNote,
    ...(context?.candidateNotes || []),
    ...(context?.recentNotes || []),
    context?.resolvedTarget?.note || null,
  ].find(note => note?.id === id) || null
}

function findContextFolderById(id: string, context: AiChatRequestContext | null | undefined) {
  const resolvedFolder = context?.resolvedTarget?.folder?.id === id
    ? context.resolvedTarget.folder
    : null

  if (resolvedFolder) {
    return resolvedFolder
  }

  if (context?.activeFolder?.id === id) {
    return context.activeFolder
  }

  return null
}

export function extractAiChatMentionedTargets(
  text: string,
  context: AiChatRequestContext | null | undefined,
): AiChatMentionedTarget[] {
  const seen = new Set<string>()
  const result: AiChatMentionedTarget[] = []
  const matches = text.matchAll(MENTION_ROUTE_PATTERN)

  for (const match of matches) {
    const rawTitle = match[1]?.trim() || ''
    const routeType = match[3]
    const rawId = match[4]
    if (!routeType || !rawId) {
      continue
    }

    const id = decodeURIComponent(rawId)
    const type = routeType === 'f' ? 'folder' : 'note'
    const key = `${type}:${id}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    const contextNote = type === 'note' ? findContextNoteById(id, context) : null
    const contextFolder = type === 'folder' ? findContextFolderById(id, context) : null

    result.push({
      id,
      type,
      title: normalizeTitle(contextNote?.title || contextFolder?.title || rawTitle),
      routePath: buildRelativeRoutePath(type, id),
      parentId: contextNote?.parentId || '',
      updated: contextNote?.updated || '',
      source: 'message_mention',
    })
  }

  return result
}
