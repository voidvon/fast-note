import type { Note } from '@/shared/types'

export type MentionEntityType = 'folder' | 'note'

export interface MentionEntity {
  id: string
  type: MentionEntityType
  title: string
  routePath: string
  parentId?: string
  description?: string
  meta?: string
  tags?: string[]
  updated?: string
}

export interface ActiveMentionMatch {
  query: string
  range: {
    end: number
    start: number
  }
}

export interface MentionSuggestionDeps {
  getNote: (id: string) => Note | null
  notes: Note[]
  searchNotesByKeyword: (keyword: string, limit: number) => Promise<Note[]>
}
