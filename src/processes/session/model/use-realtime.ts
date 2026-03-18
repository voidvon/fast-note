import type { RealtimeEvent, RealtimeStatus } from '@/core/realtime'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getRealtimeInstance } from '@/core/realtime'

export function useRealtime() {
  const realtime = getRealtimeInstance()

  const status = ref<RealtimeStatus>(realtime.getStatus())
  const lastMessage = ref<RealtimeEvent | null>(null)
  const lastError = ref<Error | null>(null)

  const isConnected = computed(() => status.value === 'connected')
  const isConnecting = computed(() =>
    status.value === 'connecting'
    || status.value === 'reconnecting',
  )
  const hasError = computed(() => status.value === 'error')

  async function connect() {
    try {
      await realtime.connect()
    }
    catch (error) {
      console.error('连接 Realtime 失败:', error)
      throw error
    }
  }

  function disconnect() {
    realtime.disconnect()
  }

  function onStatusChange(_callback: (newStatus: RealtimeStatus) => void) {
    status.value = realtime.getStatus()
  }

  function onMessage(_callback: (event: RealtimeEvent) => void) {
    lastMessage.value = null
  }

  function onError(_callback: (error: Error) => void) {
    lastError.value = null
  }

  return {
    status: computed(() => status.value),
    isConnected,
    isConnecting,
    hasError,
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

  onUnmounted(() => {
  })

  return realtimeHook
}
