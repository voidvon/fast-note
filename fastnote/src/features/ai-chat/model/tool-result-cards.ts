import type { ChatMessageCard, ChatMessageCardItem } from '@/shared/ui/chat-message'
import type { AiToolResult, Note } from '@/shared/types'
import { formatNotePreviewLine } from '@/shared/lib/date'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStatus(result: AiToolResult): ChatMessageCard['status'] {
  if (result.humanActionRequired || result.requiresConfirmation) {
    return 'warning'
  }

  if (!result.ok) {
    return 'error'
  }

  return 'success'
}

function toTags(tags: Array<string | false | null | undefined>) {
  return tags.filter((tag): tag is string => !!tag)
}

function toNoteMeta(note: Partial<Note>) {
  return formatNotePreviewLine(note.created || note.updated, note.summary)
}

function toNoteCardItem(note: Partial<Note> & { id: string, title?: string, summary?: string }): ChatMessageCardItem {
  const parentId = note.parent_id || (note as Partial<{ parentId: string }>).parentId || ''
  const isDeleted = note.is_deleted === 1 || (note as Partial<{ isDeleted: boolean }>).isDeleted === true
  const isLocked = note.is_locked === 1 || (note as Partial<{ isLocked: boolean }>).isLocked === true

  return {
    action: {
      type: 'open-note',
      isDeleted,
      noteId: note.id,
      parentId,
    },
    id: note.id,
    title: note.title || '未命名备忘录',
    description: '',
    meta: toNoteMeta(note),
    tags: toTags([
      isLocked ? '已加锁' : '',
      isDeleted ? '已删除' : '',
    ]),
  }
}

function createActionCard(result: AiToolResult, index: number): ChatMessageCard {
  return {
    id: `action-${index}`,
    title: result.preview?.title || result.message || result.code,
    description: result.preview?.summary || result.message || '',
    footer: result.affectedNoteIds?.length
      ? `影响对象：${result.affectedNoteIds.join('、')}`
      : '',
    status: toStatus(result),
  }
}

function createNoteDataCard(result: AiToolResult, index: number, note: Partial<Note> & { id: string }): ChatMessageCard {
  return {
    id: `note-${index}-${note.id}`,
    title: result.preview?.title || '备忘录结果',
    description: result.preview?.summary || result.message || '',
    items: [toNoteCardItem(note)],
    status: toStatus(result),
  }
}

function createListCard(
  result: AiToolResult,
  index: number,
  items: ChatMessageCardItem[],
  title: string,
) {
  return {
    id: `list-${index}`,
    title,
    description: result.preview?.summary || result.message || '',
    items,
    status: toStatus(result),
  } satisfies ChatMessageCard
}

function tryCreateNoteDetailCard(result: AiToolResult, index: number) {
  if (!isRecord(result.data) || !isRecord(result.data.note) || typeof result.data.note.id !== 'string') {
    return null
  }

  return createNoteDataCard(result, index, result.data.note as Partial<Note> & { id: string })
}

function tryCreateSearchResultCard(result: AiToolResult, index: number) {
  if (!Array.isArray(result.data) || !result.data.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string')) {
    return null
  }

  const firstItem = result.data[0]
  if (!firstItem || !('isLocked' in firstItem || 'isDeleted' in firstItem)) {
    return null
  }

  return createListCard(
    result,
    index,
    result.data.map((item) => {
      const typedItem = item as {
        id: string
        isDeleted?: boolean
        isLocked?: boolean
        parentId?: string
        created?: string
        summary?: string
        title: string
        updated?: string
      }

      return toNoteCardItem({
        created: typedItem.created,
        id: typedItem.id,
        title: typedItem.title,
        summary: typedItem.summary,
        updated: typedItem.updated,
        parentId: typedItem.parentId,
        isDeleted: typedItem.isDeleted,
        isLocked: typedItem.isLocked,
      } as Partial<Note> & { id: string, title?: string, summary?: string })
    }),
    result.preview?.title || '搜索结果',
  )
}

function tryCreateFolderListCard(result: AiToolResult, index: number) {
  if (!Array.isArray(result.data) || !result.data.every(item => isRecord(item) && typeof item.id === 'string' && typeof item.title === 'string')) {
    return null
  }

  const firstItem = result.data[0]
  if (!firstItem || !('noteCount' in firstItem)) {
    return null
  }

  return createListCard(
    result,
    index,
    result.data.map((item) => {
      const typedItem = item as {
        id: string
        noteCount?: number
        parentId?: string
        title: string
      }

      return {
        action: {
          type: 'open-folder',
          folderId: typedItem.id,
          parentId: typedItem.parentId,
        },
        description: '',
        id: typedItem.id,
        title: typedItem.title,
        meta: [
          typedItem.parentId ? `父目录 ${typedItem.parentId}` : '根目录',
          typeof typedItem.noteCount === 'number' ? `${typedItem.noteCount} 项` : '',
        ].filter(Boolean).join(' · '),
      }
    }),
    result.preview?.title || '文件夹列表',
  )
}

export function createToolResultCards(results: AiToolResult[]) {
  return results.map((result, index) => {
    return tryCreateSearchResultCard(result, index)
      || tryCreateFolderListCard(result, index)
      || tryCreateNoteDetailCard(result, index)
      || createActionCard(result, index)
  })
}
