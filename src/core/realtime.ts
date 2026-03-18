/**
 * PocketBase Realtime 连接管理器
 * 负责 PocketBase 的实时数据同步和推送
 *
 * 主要功能：
 * - 建立和维护 realtime 连接
 * - 监听笔记集合的变更事件
 * - 自动处理断线重连
 * - 将云端变更同步到本地 Store
 */

import type { RecordSubscription, UnsubscribeFunc } from 'pocketbase'
import type { Note } from '@/types'
import { useNote } from '@/entities/note'
import { pb } from '@/shared/api/pocketbase/client'

/**
 * Realtime 连接状态
 */
export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/**
 * Realtime 事件类型
 */
export interface RealtimeEvent {
  action: 'create' | 'update' | 'delete'
  record: Note
}

/**
 * Realtime 配置
 */
export interface RealtimeConfig {
  autoReconnect?: boolean // 是否自动重连
  onStatusChange?: (status: RealtimeStatus) => void // 状态变化回调
  onError?: (error: Error) => void // 错误回调
  onMessage?: (event: RealtimeEvent) => void // 消息回调
}

/**
 * PocketBase Realtime 管理器
 */
export class PocketBaseRealtime {
  private unsubscribe: UnsubscribeFunc | null = null
  private status: RealtimeStatus = 'disconnected'
  private config: RealtimeConfig
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 2000 // 2秒

  constructor(config: RealtimeConfig = {}) {
    this.config = {
      autoReconnect: true,
      ...config,
    }
  }

  /**
   * 连接到 PocketBase Realtime
   */
  async connect(): Promise<void> {
    // 检查是否已连接
    if (this.status === 'connected') {
      console.warn('PocketBase Realtime 已经连接')
      return
    }

    // 检查用户是否已登录
    if (!pb.authStore.isValid || !pb.authStore.model) {
      throw new Error('用户未登录，无法建立 Realtime 连接')
    }

    try {
      this.setStatus('connecting')

      // 订阅 notes 集合的变更
      // 只监听当前用户的笔记
      const userId = pb.authStore.model.id

      this.unsubscribe = await pb.collection('notes').subscribe(
        '*',
        this.handleRealtimeMessage.bind(this),
        {
          // 过滤条件：只接收当前用户的笔记
          filter: `user_id = "${userId}"`,
        },
      )

      this.setStatus('connected')
      this.reconnectAttempts = 0 // 重置重连次数

      console.warn('PocketBase Realtime 连接成功')
    }
    catch (error) {
      console.error('PocketBase Realtime 连接失败:', error)
      this.setStatus('error')

      if (this.config.onError) {
        this.config.onError(error as Error)
      }

      // 尝试重连
      if (this.config.autoReconnect) {
        this.scheduleReconnect()
      }

      throw error
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    // 清除重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.setStatus('disconnected')
    console.warn('PocketBase Realtime 已断开连接')
  }

  /**
   * 处理 Realtime 消息
   */
  private async handleRealtimeMessage(data: RecordSubscription<any>): Promise<void> {
    try {
      console.warn('收到 PocketBase Realtime 消息:', data.action, data.record)

      const { updateNote, addNote, deleteNote, getNote } = useNote()
      const record = data.record as Note

      // 处理不同的动作
      switch (data.action) {
        case 'create': {
          // 检查本地是否已存在，避免重复添加
          const existingNote = await getNote(record.id)
          if (!existingNote) {
            await addNote(record)
            console.warn('从云端创建笔记:', record.id)
          }
          break
        }

        case 'update': {
          // 更新本地笔记
          const localNote = await getNote(record.id)
          if (localNote) {
            // 比较时间戳，只有云端更新时才同步
            const localTime = new Date(localNote.updated).getTime()
            const remoteTime = new Date(record.updated).getTime()

            if (remoteTime > localTime) {
              await updateNote(record.id, record)
              console.warn('从云端更新笔记:', record.id)
            }
            else {
              console.warn('本地笔记更新，跳过云端推送:', record.id)
            }
          }
          else {
            // 本地不存在，作为新建处理
            await addNote(record)
            console.warn('从云端添加笔记:', record.id)
          }
          break
        }

        case 'delete': {
          // 删除本地笔记
          await deleteNote(record.id)
          console.warn('从云端删除笔记:', record.id)
          break
        }
      }

      // 触发消息回调
      if (this.config.onMessage) {
        // 确保 action 是允许的类型
        const allowedActions = ['create', 'update', 'delete'] as const
        const action = allowedActions.includes(data.action as any) ? data.action as 'create' | 'update' | 'delete' : 'update'

        this.config.onMessage({
          action,
          record,
        })
      }
    }
    catch (error) {
      console.error('处理 Realtime 消息失败:', error)
      if (this.config.onError) {
        this.config.onError(error as Error)
      }
    }
  }

  /**
   * 设置连接状态
   */
  private setStatus(status: RealtimeStatus): void {
    this.status = status

    if (this.config.onStatusChange) {
      this.config.onStatusChange(status)
    }
  }

  /**
   * 计划重连
   */
  private scheduleReconnect(): void {
    // 检查是否超过最大重连次数
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('达到最大重连次数，停止重连')
      this.setStatus('error')
      return
    }

    // 清除之前的定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectAttempts++
    this.setStatus('reconnecting')

    // 计算延迟时间（指数退避）
    const delay = this.reconnectDelay * 2 ** (this.reconnectAttempts - 1)

    console.warn(`将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch((error) => {
        console.error('重连失败:', error)
      })
    }, delay)
  }

  /**
   * 获取当前连接状态
   */
  getStatus(): RealtimeStatus {
    return this.status
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.status === 'connected'
  }
}

/**
 * 创建 PocketBase Realtime 实例
 */
export function createPocketBaseRealtime(config?: RealtimeConfig): PocketBaseRealtime {
  return new PocketBaseRealtime(config)
}

// 导出单例实例（可选）
let realtimeInstance: PocketBaseRealtime | null = null

/**
 * 获取全局 Realtime 实例
 */
export function getRealtimeInstance(): PocketBaseRealtime {
  if (!realtimeInstance) {
    realtimeInstance = new PocketBaseRealtime()
  }
  return realtimeInstance
}

/**
 * 重置全局 Realtime 实例
 */
export function resetRealtimeInstance(): void {
  if (realtimeInstance) {
    realtimeInstance.disconnect()
    realtimeInstance = null
  }
}
