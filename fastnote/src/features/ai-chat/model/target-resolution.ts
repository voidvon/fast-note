import type {
  AiChatContextFolder,
  AiChatContextNote,
  AiChatResolvedTarget,
  AiChatRequestContext,
} from './request-context'

const NOTE_URL_PATTERN = /(?:https?:\/\/[^\s]+)?\/n\/([^?\s/#]+)/i
const FOLDER_URL_PATTERN = /(?:https?:\/\/[^\s]+)?\/f\/([^?\s#]+)/i

function findNoteUrlId(text: string) {
  const match = text.match(NOTE_URL_PATTERN)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function findFolderPath(text: string) {
  const match = text.match(FOLDER_URL_PATTERN)
  if (!match?.[1]) {
    return ''
  }

  const normalized = decodeURIComponent(match[1]).replace(/\/+$/, '')
  if (!normalized) {
    return ''
  }

  const segments = normalized.split('/').filter(Boolean)
  return segments.at(-1) || ''
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

  const noteId = findNoteUrlId(normalizedText)
  if (noteId) {
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
      source: 'message_note_url',
    }
  }

  const folderId = findFolderPath(normalizedText)
  if (folderId) {
    const folder = context.activeFolder?.id === folderId
      ? context.activeFolder
      : {
          id: folderId,
          title: '链接中的目录',
          kind: 'folder' as const,
        }

    return {
      folder,
      source: 'message_folder_url',
    }
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
