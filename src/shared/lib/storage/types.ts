import type Dexie from 'dexie'
import type { Ref } from 'vue'

export type {
  DeviceSecurityState,
  Note,
  NoteLockFields,
  NoteLockType,
  NoteUnlockSession,
  SecuritySettings,
  TypedFile,
} from '@/types'

export interface NoteFile {
  hash: string
  file: File
  fileName: string
  fileSize: number
  fileType: string
  created: string
  updated: string
}

export interface SyncableItem {
  files?: any[]
  updated: string
  [key: string]: any
}

export interface UserInfo {
  id: string
  username: string
  name?: string
}

export interface Metadata {
  key: string
  value: string
}

export interface SyncStatus {
  isLoading: boolean
  error: string | null
  lastSyncTime: string | null
}

export interface UseRefDBSyncOptions<T extends SyncableItem> {
  data: Ref<T[]>
  table: Dexie.Table<T, any>
  idField: keyof T
  debounceMs?: number
}
