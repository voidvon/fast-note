import type {
  AiChatContextFolder,
  AiChatContextNote,
  AiChatResolvedTarget,
  AiChatRequestContext,
} from './request-context'

const NOTE_URL_PATTERN = /(?:https?:\/\/[^\s)]+)?\/n\/([^?\s/#)]+)/gi
const FOLDER_URL_PATTERN = /(?:https?:\/\/[^\s)]+)?\/f\/([^?\s#)]+)/gi
const MOVE_INTENT_PATTERN = /(移到|移动到|移入|放到|放进|放入|归档到|转移到)/
const COMPARE_INTENT_PATTERN = /(对比|比较|区别|差异|不同)/

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

function findLastExplicitTargetReference(text: string) {
  return collectExplicitTargetReferences(text).at(-1) || null
}

function hasMoveIntent(text: string) {
  return MOVE_INTENT_PATTERN.test(text)
}

function hasCompareIntent(text: string) {
  return COMPARE_INTENT_PATTERN.test(text)
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

function findIntentMatchedExplicitReference(
  text: string,
  references: ExplicitTargetReference[],
  context: AiChatRequestContext,
): AiChatResolvedTarget | null | undefined {
  const noteReferences = references.filter(reference => reference.type === 'note')
  const folderReferences = references.filter(reference => reference.type === 'folder')

  if (hasCompareIntent(text) && noteReferences.length >= 2) {
    return null
  }

  if (hasMoveIntent(text) && noteReferences.length && folderReferences.length) {
    return resolveExplicitTargetReference(noteReferences[0], context)
  }

  return undefined
}

function refersToCurrentNote(text: string) {
  return /(这条笔记|当前笔记|这个笔记|这篇备忘录|当前备忘录|这个备忘录)/.test(text)
}

function refersToCurrentFolder(text: string) {
  return /(当前目录|这个目录|这个文件夹|当前文件夹|这个文件夹里|当前目录里)/.test(text)
}

export function resolveAiChatTarget(text: string, context: AiChatRequestContext | null | undefined): AiChatResolvedTarget | null {
  const normalizedText = text.trim()
  if (!normalizedText || !context) {
    return null
  }

  const explicitReferences = collectExplicitTargetReferences(normalizedText)
  const intentMatchedTarget = findIntentMatchedExplicitReference(normalizedText, explicitReferences, context)
  if (intentMatchedTarget !== undefined) {
    return intentMatchedTarget
  }

  const explicitReference = explicitReferences.at(-1) || null
  if (explicitReference) {
    return resolveExplicitTargetReference(explicitReference, context)
  }

  if (refersToCurrentNote(normalizedText) && context.activeNote) {
    return {
      note: context.activeNote,
      source: 'active_note',
    }
  }

  if (refersToCurrentFolder(normalizedText) && context.activeFolder) {
    return {
      folder: context.activeFolder,
      source: 'active_folder',
    }
  }

  return null
}
