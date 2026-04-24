import type {
  AiChatResolvedTarget,
  AiChatRequestContext,
} from './request-context'

const NOTE_URL_PATTERN = /(?:https?:\/\/[^\s)]+)?\/n\/([^?\s/#)]+)/gi
const FOLDER_URL_PATTERN = /(?:https?:\/\/[^\s)]+)?\/f\/([^?\s#)]+)/gi

interface ExplicitTargetReference {
  id: string
  index: number
  type: 'folder' | 'note'
}

function normalizeFolderId(path: string) {
  const normalized = decodeURIComponent(path).replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }

  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) || ''
}

function collectExplicitTargetReferences(text: string): ExplicitTargetReference[] {
  const references: ExplicitTargetReference[] = []

  for (const match of text.matchAll(NOTE_URL_PATTERN)) {
    if (!match[1]) {
      continue
    }

    references.push({
      id: decodeURIComponent(match[1]),
      index: match.index || 0,
      type: 'note',
    })
  }

  for (const match of text.matchAll(FOLDER_URL_PATTERN)) {
    if (!match[1]) {
      continue
    }

    const id = normalizeFolderId(match[1])
    if (!id) {
      continue
    }

    references.push({
      id,
      index: match.index || 0,
      type: 'folder',
    })
  }

  return references.sort((left, right) => left.index - right.index)
}

function resolveNoteTarget(noteId: string, context: AiChatRequestContext) {
  const matchedNote = [
    context.activeNote,
    ...(context.candidateNotes || []),
    ...(context.recentNotes || []),
  ].find(note => note?.id === noteId) || null

  return {
    note: matchedNote || {
      id: noteId,
      title: '链接中的备忘录',
      summary: '',
      parentId: '',
      updated: '',
      isDeleted: false,
      isLocked: false,
    },
    source: 'message_note_url' as const,
  }
}

function resolveFolderTarget(folderId: string, context: AiChatRequestContext) {
  const folder = context.activeFolder?.id === folderId
    ? context.activeFolder
    : {
        id: folderId,
        title: '链接中的目录',
        kind: 'folder' as const,
      }

  return {
    folder,
    source: 'message_folder_url' as const,
  }
}

function resolveExplicitTargetReference(reference: ExplicitTargetReference, context: AiChatRequestContext) {
  if (reference.type === 'note') {
    return resolveNoteTarget(reference.id, context)
  }

  return resolveFolderTarget(reference.id, context)
}

export function resolveAiChatTarget(text: string, context: AiChatRequestContext | null | undefined): AiChatResolvedTarget | null {
  const normalizedText = text.trim()
  if (!normalizedText || !context) {
    return null
  }

  const explicitReference = collectExplicitTargetReferences(normalizedText).at(-1) || null
  if (explicitReference) {
    return resolveExplicitTargetReference(explicitReference, context)
  }

  return null
}
