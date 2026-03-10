/**
 * 数据库相关类型定义
 */

import type Dexie from 'dexie'
// 重新导出原有类型
// 导入必要的类型
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

/**
 * 笔记文件关联表（用于存储文件与hash的映射关系）
 */
export interface NoteFile {
  hash: string // 文件hash值，作为主键
  file: File // File对象
  fileName: string // 文件名
  fileSize: number // 文件大小
  fileType: string // 文件类型
  created: string // 创建时间
  updated: string // 更新时间
}

/**
 * 可同步的数据项接口
 */
export interface SyncableItem {
  files?: any[]
  updated: string
  [key: string]: any
}

/**
 * 用户信息接口
 */
export interface UserInfo {
  id: string
  username: string
  name?: string
}

/**
 * 元数据接口
 */
export interface Metadata {
  key: string
  value: string
}

/**
 * 同步状态
 */
export interface SyncStatus {
  isLoading: boolean
  error: string | null
  lastSyncTime: string | null
}

/**
 * useRefDBSync 配置选项
 */
export interface UseRefDBSyncOptions<T extends SyncableItem> {
  /** 响应式数据源 */
  data: Ref<T[]>
  /** Dexie 表实例 */
  table: Dexie.Table<T, any>
  /** ID 字段名 */
  idField: keyof T
  /** 防抖延迟时间（毫秒） */
  debounceMs?: number
}
