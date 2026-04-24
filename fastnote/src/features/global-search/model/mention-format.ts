import type { ChatMessageCardItem } from '@/shared/ui/chat-message'
import type { MentionEntity } from './mention-types'

function normalizeMentionTitle(title: string) {
  return title.trim() || '未命名'
}

export function formatMentionText(entity: MentionEntity) {
  return `@${normalizeMentionTitle(entity.title)}(${entity.routePath}) `
}

export function toMentionCardItem(entity: MentionEntity): ChatMessageCardItem {
  const typeTag = entity.type === 'folder' ? '文件夹' : '备忘录'
  const extraTags = entity.tags || []

  return {
    action: entity.type === 'folder'
      ? {
          type: 'open-folder',
          folderId: entity.id,
          parentId: entity.parentId,
        }
      : {
          type: 'open-note',
          noteId: entity.id,
          parentId: entity.parentId,
        },
    description: entity.description,
    id: `${entity.type}:${entity.id}`,
    meta: entity.meta,
    tags: [typeTag, ...extraTags],
    title: normalizeMentionTitle(entity.title),
  }
}
