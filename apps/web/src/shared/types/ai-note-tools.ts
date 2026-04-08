import type { Note } from './index'

export type AiNoteToolName = 'search_notes' | 'get_note_detail' | 'list_folders' | 'create_note' | 'update_note' | 'move_note' | 'delete_note' | 'set_note_lock'

export interface AiToolEnvelope<TTool extends AiNoteToolName, TPayload> {
  tool: TTool
  payload: TPayload
  dryRun?: boolean
  confirmed?: boolean
  requireConfirmation?: boolean
}

export interface AiSearchNotesPayload {
  query: string
  folderId?: string
  includeDeleted?: boolean
  limit?: number
}

export interface AiGetNoteDetailPayload {
  noteId: string
}

export interface AiListFoldersPayload {
  parentId?: string
}

export interface AiCreateNotePayload {
  kind?: 'note' | 'folder'
  noteId?: string
  title?: string
  summary?: string
  contentHtml?: string
  parentId?: string
}

export interface AiUpdateNotePayload {
  noteId: string
  title?: string
  summary?: string
  contentHtml?: string
  appendContentHtml?: string
  parentId?: string
  expectedUpdated?: string
}

export interface AiMoveNotePayload {
  noteId: string
  targetFolderId: string
}

export interface AiDeleteNotePayload {
  noteId: string
  mode?: 'soft'
}

export interface AiSetNoteLockPayload {
  noteId: string
  action: 'enable' | 'disable'
  biometricEnabled?: boolean
}

export type AiNoteToolCall = AiToolEnvelope<'search_notes', AiSearchNotesPayload>
  | AiToolEnvelope<'get_note_detail', AiGetNoteDetailPayload>
  | AiToolEnvelope<'list_folders', AiListFoldersPayload>
  | AiToolEnvelope<'create_note', AiCreateNotePayload>
  | AiToolEnvelope<'update_note', AiUpdateNotePayload>
  | AiToolEnvelope<'move_note', AiMoveNotePayload>
  | AiToolEnvelope<'delete_note', AiDeleteNotePayload>
  | AiToolEnvelope<'set_note_lock', AiSetNoteLockPayload>

export interface AiToolPreview {
  title: string
  summary: string
  affectedNoteIds: string[]
}

export interface AiToolResult<TData = unknown> {
  ok: boolean
  code: string
  message: string | null
  data?: TData
  preview?: AiToolPreview
  requiresConfirmation?: boolean
  affectedNoteIds?: string[]
  syncQueued?: boolean
  humanActionRequired?: boolean
}

export interface AiFolderListItem {
  id: string
  title: string
  parentId: string
  noteCount: number
}

export interface AiNoteSearchItem {
  id: string
  title: string
  summary?: string
  parentId: string
  updated: string
  isLocked: boolean
  isDeleted: boolean
}

export interface AiNoteDetailItem {
  note: Note
}
