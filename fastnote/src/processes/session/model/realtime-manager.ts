import type { IRealtimeService, RealtimeConfig, RealtimeStatus } from '@/shared/lib/realtime'
import { computed, ref } from 'vue'
import { RealtimeStatus as Status } from '@/shared/lib/realtime'

class RealtimeManager {
  private realtimeService: IRealtimeService | null = null
  private status = ref<RealtimeStatus>(Status.DISCONNECTED)
  private lastError = ref<Error | null>(null)

  readonly isConnected = computed(() => this.status.value === Status.CONNECTED)
  readonly isConnecting = computed(() =>
    this.status.value === Status.CONNECTING
    || this.status.value === Status.RECONNECTING,
  )
  readonly hasError = computed(() => this.status.value === Status.ERROR)
  readonly connectionStatus = computed(() => this.status.value)

  setRealtimeService(service: IRealtimeService, config?: RealtimeConfig) {
    if (this.realtimeService) {
      console.warn('Realtime 服务已经设置，将被覆盖')
      this.cleanup()
    }

    this.realtimeService = service

    if (config?.onStatusChange) {
      this.setupStatusMonitor()
    }
  }

  getRealtimeService(): IRealtimeService {
    if (!this.realtimeService) {
      throw new Error('Realtime 服务未初始化，请先调用 setRealtimeService')
    }
    return this.realtimeService
  }

  async connect() {
    if (!this.realtimeService) {
      throw new Error('Realtime 服务未初始化')
    }

    try {
      this.status.value = Status.CONNECTING
      await this.realtimeService.connect()
      this.status.value = this.realtimeService.getStatus()
      this.lastError.value = null
      console.log('✅ Realtime 连接已建立')
    }
    catch (error) {
      this.status.value = Status.ERROR
      this.lastError.value = error as Error
      console.error('❌ Realtime 连接失败:', error)
      throw error
    }
  }

  disconnect() {
    if (!this.realtimeService) {
      return
    }

    try {
      this.realtimeService.disconnect()
      this.status.value = Status.DISCONNECTED
      console.log('🔌 Realtime 连接已断开')
    }
    catch (error) {
      console.error('断开 Realtime 连接失败:', error)
    }
  }

  getStatus(): RealtimeStatus {
    if (!this.realtimeService) {
      return Status.DISCONNECTED
    }
    return this.realtimeService.getStatus()
  }

  checkIsConnected(): boolean {
    if (!this.realtimeService) {
      return false
    }
    return this.realtimeService.isConnected()
  }

  private setupStatusMonitor() {
    setInterval(() => {
      if (this.realtimeService) {
        const currentStatus = this.realtimeService.getStatus()
        if (this.status.value !== currentStatus) {
          this.status.value = currentStatus
        }
      }
    }, 1000)
  }

  private cleanup() {
    if (this.realtimeService) {
      this.realtimeService.disconnect()
    }
  }
}

export const realtimeManager = new RealtimeManager()
