export const NOTE_TYPE = {
  FOLDER: 1,
  NOTE: 2,
} as const

export type NoteType = typeof NOTE_TYPE[keyof typeof NOTE_TYPE]

export const NOTE_LOCK_TYPE = {
  PIN: 'pin',
} as const

export type NoteLockType = typeof NOTE_LOCK_TYPE[keyof typeof NOTE_LOCK_TYPE]

export interface NoteLockFields {
  is_locked: number
  lock_type?: NoteLockType | null
  lock_secret_salt?: string | null
  lock_secret_hash?: string | null
  lock_version?: number | null
}

export interface SecuritySettings {
  scope_key: string
  pin_secret_salt: string | null
  pin_secret_hash: string | null
  pin_version: number | null
  updated: string
}

export interface Note extends NoteLockFields {
  id: string
  title: string
  summary?: string
  created: string
  content: string
  item_type: NoteType
  parent_id: string
  updated: string
  version?: number
  is_deleted: number
  is_public?: boolean
  note_count: number
  files?: string[]
  children?: Note[]
  folderName?: string
  user_id?: string
}

export interface DeviceSecurityState {
  scope_key: string
  webauthn_credential_id: string | null
  biometric_enabled: 0 | 1
  updated: string
}

export interface NoteUnlockSession {
  note_id: string
  verified_at: number | null
  expires_at: number | null
  failed_attempts: number
  cooldown_until: number | null
  updated: string
}

export function getDefaultNoteLockFields(note: Partial<NoteLockFields> = {}): Required<NoteLockFields> {
  return {
    is_locked: note.is_locked === 1 ? 1 : 0,
    lock_type: note.lock_type ?? null,
    lock_secret_salt: note.lock_secret_salt ?? null,
    lock_secret_hash: note.lock_secret_hash ?? null,
    lock_version: note.lock_version ?? null,
  }
}

export function normalizeNoteLockFields<T extends Partial<NoteLockFields>>(note: T): T & Required<NoteLockFields> {
  return Object.assign({}, note, getDefaultNoteLockFields(note))
}

export interface TypedFile {
  localId?: string
  path?: string
  file?: File
  hash: string
  id?: number
  is_deleted?: 0 | 1
  updated: string
  user_id?: string
}

export interface FileRef {
  id?: number
  hash: string
  refid: string
  updated: string
  is_deleted?: 0 | 1
  user_id?: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  avatar: string
  note_lock_pin_salt?: string | null
  note_lock_pin_hash?: string | null
  note_lock_pin_version?: number | null
  created: string
  updated: string
}

export interface FolderTreeNode {
  children: FolderTreeNode[]
  originNote: Note
  folderName?: string
}

export type {
  AiCreateNotePayload,
  AiDeleteNotePayload,
  AiFolderListItem,
  AiGetNoteDetailPayload,
  AiListFoldersPayload,
  AiMoveNotePayload,
  AiNoteDetailItem,
  AiNoteSearchItem,
  AiNoteToolCall,
  AiNoteToolName,
  AiSearchNotesPayload,
  AiSetNoteLockPayload,
  AiToolEnvelope,
  AiToolPreview,
  AiToolResult,
  AiUpdateNotePayload,
} from './ai-note-tools'
