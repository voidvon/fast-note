import type { Note } from '@/shared/types'

export const NOTE_DELETION_RETENTION_DAYS = 30

export function normalizeParentIdKey(parentId?: string | null) {
  return parentId || 'root'
}

export function hasRemoteUserId(note: Pick<Note, 'user_id'>) {
  return typeof note.user_id === 'string' && note.user_id.trim().length > 0
}

export function shouldRefreshNoteUpdated(existingNote: Note, updates: Partial<Note>) {
  if (!updates.updated)
    return true

  if (updates.updated !== existingNote.updated)
    return false

  return Object.entries(updates).some(([field, value]) => {
    if (field === 'updated')
      return false

    return existingNote[field as keyof Note] !== value
  })
}

export function isDeletedNoteRetained(note: Pick<Note, 'is_deleted' | 'updated'>, now = Date.now()) {
  const retentionThreshold = new Date(
    now - NOTE_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString().replace('T', ' ')

  return note.is_deleted === 1 && note.updated >= retentionThreshold
}

export function matchesNoteKeyword(note: Pick<Note, 'title' | 'content'>, keyword: string) {
  return createSearchTerms(keyword).some(term =>
    note.title.includes(term) || note.content.includes(term),
  )
}

export function matchesFolderKeyword(note: Pick<Note, 'title'>, keyword: string) {
  return createSearchTerms(keyword).some(term => note.title.includes(term))
}

export function createSearchTerms(keyword: string) {
  const normalized = keyword.trim()
  if (!normalized) {
    return []
  }

  return [...new Set(normalized
    .split(/[\s,，、/|]+/g)
    .map(term => term.trim())
    .filter(Boolean))]
}
