import type { RealtimeEvent } from '@/shared/lib/realtime'
import { computed, onMounted, ref } from 'vue'
import { RealtimeStatus } from '@/shared/lib/realtime'
import { realtimeManager } from './realtime-manager'

export function useRealtime() {
  const lastError = ref<Error | null>(null)
  const lastMessage = ref<RealtimeEvent | null>(null)
  const status = computed(() => realtimeManager.connectionStatus.value)

  async function connect() {
    try {
      await realtimeManager.connect()
      lastError.value = null
    }
    catch (error) {
      lastError.value = error as Error
      console.error('连接 Realtime 失败:', error)
      throw error
    }
  }

  function disconnect() {
    realtimeManager.disconnect()
  }

  function onStatusChange(callback: (newStatus: RealtimeStatus) => void) {
    callback(status.value)
  }

  function onMessage(_callback: (event: RealtimeEvent) => void) {
    lastMessage.value = null
  }

  function onError(_callback: (error: Error) => void) {
    lastError.value = null
  }

  return {
    status,
    isConnected: computed(() => realtimeManager.isConnected.value),
    isConnecting: computed(() => realtimeManager.isConnecting.value),
    hasError: computed(() => realtimeManager.hasError.value),
    lastMessage: computed(() => lastMessage.value),
    lastError: computed(() => lastError.value),
    connect,
    disconnect,
    onStatusChange,
    onMessage,
    onError,
  }
}

export function useAutoRealtime() {
  const realtimeHook = useRealtime()

  onMounted(async () => {
    try {
      await realtimeHook.connect()
    }
    catch (error) {
      console.error('自动连接 Realtime 失败:', error)
    }
  })

  return realtimeHook
}
