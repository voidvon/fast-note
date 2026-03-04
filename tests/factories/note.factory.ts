import type { Note } from '@/types'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

export function makeNote(overrides: Partial<Note> = {}): Note {
  const now = getTime()

  return {
    id: overrides.id ?? `note-${Date.now()}`,
    title: overrides.title ?? '测试笔记',
    summary: overrides.summary,
    created: overrides.created ?? now,
    content: overrides.content ?? '',
    item_type: overrides.item_type ?? NOTE_TYPE.NOTE,
    parent_id: overrides.parent_id ?? '',
    updated: overrides.updated ?? now,
    version: overrides.version,
    is_deleted: overrides.is_deleted ?? 0,
    is_locked: overrides.is_locked ?? 0,
    is_public: overrides.is_public,
    note_count: overrides.note_count ?? 0,
    files: overrides.files,
    children: overrides.children,
    folderName: overrides.folderName,
    user_id: overrides.user_id,
  }
}
