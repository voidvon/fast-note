<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { pocketbaseAuthAdapter } from '@/adapters/pocketbase/auth-adapter'
import { PocketBaseRealtimeAdapter } from '@/adapters/pocketbase/realtime-adapter'
import { authManager } from '@/core/auth-manager'
import { realtimeManager } from '@/core/realtime-manager'
import { useSync } from '@/hooks/useSync'
import { useTheme } from '@/hooks/useTheme'
import { logger } from '@/utils/logger'
import { useLastVisitedRoute } from './hooks/useLastVisitedRoute'
import { useVisualViewport } from './hooks/useVisualViewport'

const { initTheme } = useTheme()
const router = useRouter()
const { setupAutoSave, restoreLastVisitedRoute } = useLastVisitedRoute()

useVisualViewport(true)

// 设置自动保存路由
setupAutoSave(router)

// 立即恢复最后访问的路由（不需要等待 onMounted）
restoreLastVisitedRoute(router)

let hasRealtimeService = false
let sessionBootstrapPromise: Promise<void> | null = null
let authChangeUnsubscribe: (() => void) | null = null

async function bootstrapLoggedInSession() {
  if (!authManager.isAuthenticated())
    return

  if (sessionBootstrapPromise)
    return sessionBootstrapPromise

  sessionBootstrapPromise = (async () => {
    if (!hasRealtimeService) {
      const realtimeAdapter = new PocketBaseRealtimeAdapter({
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 2000,
      })
      realtimeManager.setRealtimeService(realtimeAdapter)
      hasRealtimeService = true
    }

    if (!realtimeManager.checkIsConnected()) {
      await realtimeManager.connect()
      logger.info('Realtime 连接初始化完成')
    }

    const { sync } = useSync()
    await sync(true)
    logger.info('会话同步完成')
  })().finally(() => {
    sessionBootstrapPromise = null
  })

  return sessionBootstrapPromise
}

onMounted(async () => {
  initTheme()

  logger.info('初始化认证服务')
  authManager.setAuthService(pocketbaseAuthAdapter)

  // 单一会话入口：监听登录态变化后统一进行 Realtime + Sync
  authChangeUnsubscribe = authManager.getAuthService().onAuthChange(async (token, user) => {
    if (token && user) {
      try {
        await bootstrapLoggedInSession()
      }
      catch (error) {
        logger.error('登录态变更后会话初始化失败:', error)
      }
    }
    else {
      realtimeManager.disconnect()
    }
  })

  await authManager.initialize()

  if (!authManager.isAuthenticated())
    return

  try {
    await bootstrapLoggedInSession()
  }
  catch (error) {
    logger.error('初始化会话失败:', error)
  }
})

onUnmounted(() => {
  if (authChangeUnsubscribe) {
    authChangeUnsubscribe()
    authChangeUnsubscribe = null
  }
})
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>
