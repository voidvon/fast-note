import type { RecordSubscription, UnsubscribeFunc } from 'pocketbase'
import type { IRealtimeService, RealtimeConfig } from '@/shared/lib/realtime'
import type { Note } from '@/shared/types'
import { RealtimeStatus } from '@/shared/lib/realtime'
import { useNote } from '@/entities/note'
import { logger } from '@/utils/logger'
import { pb } from './client'

export class PocketBaseRealtimeService implements IRealtimeService {
  private unsubscribe: UnsubscribeFunc | null = null
  private status: RealtimeStatus = RealtimeStatus.DISCONNECTED
  private config: RealtimeConfig
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0

  constructor(config: RealtimeConfig = {}) {
    this.config = {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
      ...config,
    }
  }

  async connect(): Promise<void> {
    if (this.status === RealtimeStatus.CONNECTED) {
      logger.info('PocketBase Realtime 已经连接')
      return
    }

    if (!pb.authStore.isValid || !pb.authStore.model) {
      throw new Error('用户未登录，无法建立 Realtime 连接')
    }

    try {
      this.setStatus(RealtimeStatus.CONNECTING)

      const userId = pb.authStore.model.id

      this.unsubscribe = await pb.collection('notes').subscribe(
        '*',
        this.handleRealtimeMessage.bind(this),
        {
          filter: `user_id = "${userId}"`,
        },
      )

      this.setStatus(RealtimeStatus.CONNECTED)
      this.reconnectAttempts = 0

      logger.info('PocketBase Realtime 连接成功')
    }
    catch (error) {
      logger.error('PocketBase Realtime 连接失败:', error)
      this.setStatus(RealtimeStatus.ERROR)

      if (this.config.onError) {
        this.config.onError(error as Error)
      }

      if (this.config.autoReconnect) {
        this.scheduleReconnect()
      }

      throw error
    }
  }

  disconnect(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    this.setStatus(RealtimeStatus.DISCONNECTED)
    logger.info('PocketBase Realtime 已断开连接')
  }

  getStatus(): RealtimeStatus {
    return this.status
  }

  isConnected(): boolean {
    return this.status === RealtimeStatus.CONNECTED
  }

  private async handleRealtimeMessage(data: RecordSubscription<any>): Promise<void> {
    try {
      logger.debug('收到 PocketBase Realtime 消息:', data.action, data.record.id)

      const { updateNote, addNote, deleteNote, getNote } = useNote()
      const record = data.record as Note

      switch (data.action) {
        case 'create': {
          const existingNote = await getNote(record.id)
          if (!existingNote) {
            await addNote(record)
            logger.debug('从云端创建笔记:', record.id)
          }
          break
        }

        case 'update': {
          const localNote = await getNote(record.id)
          if (localNote) {
            const localTime = new Date(localNote.updated).getTime()
            const remoteTime = new Date(record.updated).getTime()

            if (remoteTime > localTime) {
              await updateNote(record.id, record)
              logger.debug('从云端更新笔记:', record.id)
            }
            else {
              logger.debug('本地笔记更新，跳过云端推送:', record.id)
            }
          }
          else {
            await addNote(record)
            logger.debug('从云端添加笔记:', record.id)
          }
          break
        }

        case 'delete': {
          await deleteNote(record.id)
          logger.debug('从云端删除笔记:', record.id)
          break
        }
      }

      if (this.config.onMessage) {
        const allowedActions = ['create', 'update', 'delete'] as const
        const action = allowedActions.includes(data.action as any)
          ? (data.action as 'create' | 'update' | 'delete')
          : 'update'

        this.config.onMessage({
          action,
          record,
        })
      }
    }
    catch (error) {
      logger.error('处理 Realtime 消息失败:', error)
      if (this.config.onError) {
        this.config.onError(error as Error)
      }
    }
  }

  private setStatus(status: RealtimeStatus): void {
    this.status = status

    if (this.config.onStatusChange) {
      this.config.onStatusChange(status)
    }
  }

  private scheduleReconnect(): void {
    const maxAttempts = this.config.maxReconnectAttempts || 5
    const baseDelay = this.config.reconnectDelay || 2000

    if (this.reconnectAttempts >= maxAttempts) {
      logger.error('达到最大重连次数，停止重连')
      this.setStatus(RealtimeStatus.ERROR)
      return
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }

    this.reconnectAttempts++
    this.setStatus(RealtimeStatus.RECONNECTING)

    const delay = baseDelay * 2 ** (this.reconnectAttempts - 1)

    logger.info(`将在 ${delay}ms 后尝试第 ${this.reconnectAttempts} 次重连`)

    this.reconnectTimer = window.setTimeout(() => {
      this.connect().catch((error) => {
        logger.error('重连失败:', error)
      })
    }, delay)
  }
}
