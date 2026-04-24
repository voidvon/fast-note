import type { Note } from '@/shared/types'
import { NOTE_TYPE } from '@/shared/types'
import type { ActiveMentionMatch, MentionEntity, MentionSuggestionDeps } from './mention-types'

const DEFAULT_SUGGESTION_LIMIT = 6
const RECENT_FOLDER_LIMIT = 3
const RECENT_NOTE_LIMIT = 5

function normalizeMentionTitle(title: string) {
  return title.trim() || '未命名'
}

function includesQuery(value: string, query: string) {
  return value.toLocaleLowerCase().includes(query.toLocaleLowerCase())
}

function buildRoutePath(type: MentionEntity['type'], id: string) {
  return type === 'folder' ? `/f/${encodeURIComponent(id)}` : `/n/${encodeURIComponent(id)}`
}

function resolveFolderMeta(note: Note, getNote: MentionSuggestionDeps['getNote']) {
  const parentTitle = note.parent_id ? getNote(note.parent_id)?.title?.trim() : ''
  const parts = [
    parentTitle || '根目录',
    `${note.note_count || 0} 项`,
  ].filter(Boolean)
  return parts.join(' · ')
}

function resolveNoteMeta(note: Note, getNote: MentionSuggestionDeps['getNote']) {
  const parentTitle = note.parent_id ? getNote(note.parent_id)?.title?.trim() : ''
  return parentTitle || note.updated || ''
}

function toMentionEntity(note: Note, deps: MentionSuggestionDeps): MentionEntity {
  const type = note.item_type === NOTE_TYPE.FOLDER ? 'folder' : 'note'
  return {
    id: note.id,
    type,
    title: normalizeMentionTitle(note.title),
    routePath: buildRoutePath(type, note.id),
    parentId: note.parent_id || '',
    description: type === 'note' ? (note.summary || '') : '',
    meta: type === 'folder'
      ? resolveFolderMeta(note, deps.getNote)
      : resolveNoteMeta(note, deps.getNote),
    tags: type === 'note' && note.is_locked === 1 ? ['已加锁'] : [],
    updated: note.updated || '',
  }
}

function byUpdatedDesc(left: Note, right: Note) {
  return new Date(right.updated).getTime() - new Date(left.updated).getTime()
}

function getRecentFolderSuggestions(deps: MentionSuggestionDeps) {
  return deps.notes
    .filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)
    .slice()
    .sort(byUpdatedDesc)
    .slice(0, RECENT_FOLDER_LIMIT)
    .map(note => toMentionEntity(note, deps))
}

function getRecentNoteSuggestions(deps: MentionSuggestionDeps) {
  return deps.notes
    .filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted !== 1)
    .slice()
    .sort(byUpdatedDesc)
    .slice(0, RECENT_NOTE_LIMIT)
    .map(note => toMentionEntity(note, deps))
}

function scoreMentionEntity(item: MentionEntity, query: string) {
  const normalizedTitle = item.title.toLocaleLowerCase()
  const normalizedQuery = query.toLocaleLowerCase()

  let score = 0
  if (normalizedTitle === normalizedQuery) {
    score += 1000
  }
  if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 500
  }
  if (normalizedTitle.includes(normalizedQuery)) {
    score += 100
  }

  score += Math.max(0, 80 - item.title.length)

  const updatedAt = item.updated ? new Date(item.updated).getTime() : 0
  if (Number.isFinite(updatedAt)) {
    score += Math.floor(updatedAt / 100000000000)
  }

  return score
}

export function rankMentionSuggestions(items: MentionEntity[], query: string) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return items
  }

  return items
    .slice()
    .sort((left, right) => scoreMentionEntity(right, normalizedQuery) - scoreMentionEntity(left, normalizedQuery))
}

function dedupeMentionSuggestions(items: MentionEntity[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.type}:${item.id}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getFolderSuggestionsByQuery(query: string, deps: MentionSuggestionDeps) {
  const normalizedQuery = query.trim()
  const folders = deps.notes.filter(note => note.item_type === NOTE_TYPE.FOLDER && note.is_deleted !== 1)
  const matchedFolders = normalizedQuery
    ? folders.filter(folder => includesQuery(folder.title, normalizedQuery))
    : folders

  return matchedFolders.map(folder => toMentionEntity(folder, deps))
}

export function parseActiveMention(value: string, selectionStart: number): ActiveMentionMatch | null {
  if (selectionStart < 0 || selectionStart > value.length) {
    return null
  }

  const prefix = value.slice(0, selectionStart)
  const mentionStart = prefix.lastIndexOf('@')
  if (mentionStart < 0) {
    return null
  }

  const previousChar = mentionStart > 0 ? prefix[mentionStart - 1] : ''
  if (previousChar && !/[\s([{（【"'“‘]/.test(previousChar)) {
    return null
  }

  const mentionText = prefix.slice(mentionStart + 1)
  if (/\s/.test(mentionText)) {
    return null
  }

  return {
    query: mentionText.trim(),
    range: {
      start: mentionStart,
      end: selectionStart,
    },
  }
}

export async function getMentionSuggestions(
  query: string,
  deps: MentionSuggestionDeps,
  limit = DEFAULT_SUGGESTION_LIMIT,
) {
  const normalizedQuery = query.trim()
  if (!normalizedQuery) {
    return dedupeMentionSuggestions([
      ...getRecentNoteSuggestions(deps),
      ...getRecentFolderSuggestions(deps),
    ]).slice(0, limit)
  }

  const matchedNotes = await deps.searchNotesByKeyword(normalizedQuery, limit)
  const suggestions = dedupeMentionSuggestions([
    ...matchedNotes.map(note => toMentionEntity(note, deps)),
    ...getFolderSuggestionsByQuery(normalizedQuery, deps),
  ])

  return rankMentionSuggestions(suggestions, normalizedQuery).slice(0, limit)
}
