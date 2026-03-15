<script setup lang="ts">
import type { Router } from 'vue-router'
import type { GuestDataDecision } from '@/database/guestData'
import { alertController, IonApp, IonRouterOutlet } from '@ionic/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { pocketbaseAuthAdapter } from '@/adapters/pocketbase/auth-adapter'
import { PocketBaseRealtimeAdapter } from '@/adapters/pocketbase/realtime-adapter'
import { authManager } from '@/core/auth-manager'
import { realtimeManager } from '@/core/realtime-manager'
import { initializeDatabase } from '@/database'
import { hasGuestData, mergeGuestDataIntoCurrent } from '@/database/guestData'
import { useLastVisitedRoute } from '@/hooks/useLastVisitedRoute'
import { useNavigationHistory } from '@/hooks/useNavigationHistory'
import { useNoteLock } from '@/hooks/useNoteLock'
import { useSync } from '@/hooks/useSync'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/pocketbase'
import { initializeNotes } from '@/stores'
import { logger } from '@/utils/logger'
import { useVisualViewport } from './hooks/useVisualViewport'

const { initTheme } = useTheme()
const router = useRouter()
const {
  isDeferredPrivateRoute,
  restoreDeferredLastVisitedRoute,
  restoreImmediateLastVisitedRoute,
  setupAutoSave,
} = useLastVisitedRoute()
const { installRestoredRouteVirtualBackStack } = useNavigationHistory()
const noteLock = useNoteLock()

const isPrivateRouteRestoreReady = ref(!authService.isAuthenticated())

const shouldBlockPrivateRoute = computed(() => {
  return authService.isAuthenticated()
    && isDeferredPrivateRoute(router.currentRoute.value.fullPath)
    && !isPrivateRouteRestoreReady.value
})

useVisualViewport(true)
setupAutoSave(router)

function shouldInstallRestoreBackStack(restoredPath: string | null) {
  if (typeof window === 'undefined')
    return false

  if (!restoredPath)
    return false

  if (window.innerWidth >= 640)
    return false

  const standaloneMedia = typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false
  const navigatorStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true

  return standaloneMedia || navigatorStandalone || window.history.length <= 1
}

async function restoreRouteWithVirtualBackStack(
  restoreRoute: (router: Router, userId?: string | null) => Promise<string | null> | string | null,
  userId?: string | null,
) {
  const restoredPath = await restoreRoute(router, userId)

  if (shouldInstallRestoreBackStack(restoredPath)) {
    installRestoredRouteVirtualBackStack(router, restoredPath)
  }

  return restoredPath
}

void restoreRouteWithVirtualBackStack(restoreImmediateLastVisitedRoute, authService.getCurrentAuthUser()?.id)

let hasRealtimeService = false
let sessionBootstrapPromise: Promise<void> | null = null
let authChangeUnsubscribe: (() => void) | null = null
let guestDecisionPromise: Promise<void> | null = null
let guestDecisionHandled = false
let lastKnownAuthenticated = authService.isAuthenticated()

async function prepareSessionContext(userId?: string | null) {
  await initializeDatabase(userId)
  await initializeNotes()
}

async function promptGuestDataDecision(): Promise<GuestDataDecision> {
  return await new Promise((resolve, reject) => {
    void (async () => {
      try {
        const alert = await alertController.create({
          header: '检测到未登录时创建的备忘录',
          message: '登录后，是否要将这些备忘录上传到当前账号？',
          backdropDismiss: false,
          buttons: [
            {
              text: '仅在未登录时显示',
              role: 'cancel',
              handler: () => resolve('coexist'),
            },
            {
              text: '上传到云端',
              handler: () => resolve('merge'),
            },
          ],
        })

        await alert.present()
      }
      catch (error) {
        reject(error)
      }
    })()
  })
}

async function handleGuestDataDecision() {
  if (guestDecisionHandled)
    return
  if (guestDecisionPromise)
    return guestDecisionPromise

  guestDecisionPromise = (async () => {
    const hasData = await hasGuestData()
    if (!hasData)
      return

    const decision = await promptGuestDataDecision()

    if (decision === 'merge') {
      await mergeGuestDataIntoCurrent()
      await initializeNotes()
    }
  })().catch((error) => {
    logger.error('游客态数据处理失败:', error)
  }).finally(() => {
    guestDecisionHandled = true
    guestDecisionPromise = null
  })

  return guestDecisionPromise
}

async function bootstrapLoggedInSession() {
  if (!authManager.isAuthenticated())
    return

  if (sessionBootstrapPromise)
    return sessionBootstrapPromise

  sessionBootstrapPromise = (async () => {
    isPrivateRouteRestoreReady.value = false

    await prepareSessionContext(authManager.userInfo.value?.id)

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

    await noteLock.syncSecuritySettingsFromCloud(true)
    logger.info('全局 PIN 配置同步完成')

    isPrivateRouteRestoreReady.value = true
    await restoreRouteWithVirtualBackStack(restoreDeferredLastVisitedRoute, authManager.userInfo.value?.id)
  })().catch(async (error) => {
    isPrivateRouteRestoreReady.value = true

    if (isDeferredPrivateRoute(router.currentRoute.value.fullPath)) {
      await router.replace('/home')
    }

    throw error
  }).finally(() => {
    sessionBootstrapPromise = null
  })

  return sessionBootstrapPromise
}

onMounted(async () => {
  initTheme()

  logger.info('初始化认证服务')
  authManager.setAuthService(pocketbaseAuthAdapter)

  authChangeUnsubscribe = authManager.getAuthService().onAuthChange(async (token, user) => {
    const isAuthenticated = !!token && !!user
    const shouldPromptGuestData = !lastKnownAuthenticated && isAuthenticated
    lastKnownAuthenticated = isAuthenticated

    try {
      await prepareSessionContext(user?.id)
    }
    catch (error) {
      logger.error('登录态变更后切换本地上下文失败:', error)
    }

    if (token && user) {
      try {
        await restoreRouteWithVirtualBackStack(restoreImmediateLastVisitedRoute, user.id)
        if (shouldPromptGuestData) {
          await handleGuestDataDecision()
        }
        await bootstrapLoggedInSession()
      }
      catch (error) {
        logger.error('登录态变更后会话初始化失败:', error)
      }
    }
    else {
      isPrivateRouteRestoreReady.value = true
      realtimeManager.disconnect()
      guestDecisionHandled = false
      await restoreRouteWithVirtualBackStack(restoreImmediateLastVisitedRoute, null)
    }
  })

  await authManager.initialize()

  try {
    await prepareSessionContext(authManager.userInfo.value?.id)
  }
  catch (error) {
    logger.error('初始化本地上下文失败:', error)
  }

  if (!authManager.isAuthenticated()) {
    isPrivateRouteRestoreReady.value = true
    return
  }

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
    <div v-if="shouldBlockPrivateRoute" data-testid="app-private-route-pending" class="app-private-route-pending" />
    <IonRouterOutlet v-else />
  </IonApp>
</template>

<style scoped>
.app-private-route-pending {
  width: 100%;
  min-height: 100vh;
}
</style>
