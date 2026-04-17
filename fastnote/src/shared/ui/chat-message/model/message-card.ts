export interface ChatMessageOpenNoteAction {
  isDeleted?: boolean
  noteId: string
  parentId?: string
  type: 'open-note'
}

export interface ChatMessageOpenFolderAction {
  folderId: string
  parentId?: string
  type: 'open-folder'
}

export type ChatMessageCardAction = ChatMessageOpenNoteAction | ChatMessageOpenFolderAction

export interface ChatMessageCardItem {
  action?: ChatMessageCardAction
  description?: string
  id: string
  layout?: 'default' | 'note-compact'
  meta?: string
  tags?: string[]
  title: string
}

export interface ChatMessageCard {
  description?: string
  footer?: string
  id: string
  items?: ChatMessageCardItem[]
  status?: 'error' | 'info' | 'success' | 'warning'
  title: string
}
