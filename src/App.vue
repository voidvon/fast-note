<script setup lang="ts">
import type { Router } from 'vue-router'
import type { GuestDataDecision } from '@/database/guestData'
import { alertController, IonApp, IonRouterOutlet, useIonRouter } from '@ionic/vue'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
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
const ionRouter = useIonRouter()
const {
  getLastVisitedRoute,
  getRouteRestoreMode,
  isDeferredPrivateRoute,
  restoreDeferredLastVisitedRoute,
  restoreImmediateLastVisitedRoute,
  setupAutoSave,
} = useLastVisitedRoute()
const {
  getRestoreBackStack,
  installRestoredRouteVirtualBackStack,
  pauseTracking,
  resumeTracking,
} = useNavigationHistory()
const noteLock = useNoteLock()

const isPrivateRouteRestoreReady = ref(!authService.isAuthenticated())
const isSilentRestoreReplaying = ref(false)

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

function normalizePath(path: string) {
  return path.split('?')[0]?.split('#')[0] || ''
}

function isNoteDetailPath(path: string) {
  const normalizedPath = normalizePath(path)
  return /^\/n\/[^/]+$/.test(normalizedPath) || /^\/[^/]+\/n\/[^/]+$/.test(normalizedPath)
}

function waitForRoutePath(targetPath: string, timeout = 2000) {
  if (router.currentRoute.value.fullPath === targetPath) {
    return Promise.resolve()
  }

  return new Promise<void>((resolve) => {
    const stop = watch(() => router.currentRoute.value.fullPath, (path) => {
      if (path === targetPath) {
        cleanup()
      }
    })

    const timer = window.setTimeout(() => {
      cleanup()
    }, timeout)

    function cleanup() {
      stop()
      window.clearTimeout(timer)
      resolve()
    }
  })
}

function delay(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

async function replayRecentIonicStack(parentPath: string, restoredPath: string) {
  isSilentRestoreReplaying.value = true
  pauseTracking()

  try {
    ionRouter.navigate(parentPath, 'root', 'replace')
    await waitForRoutePath(parentPath)
    await nextTick()

    ionRouter.navigate(restoredPath, 'forward', 'push')
    await waitForRoutePath(restoredPath)
    await delay(360)
  }
  finally {
    resumeTracking()
    isSilentRestoreReplaying.value = false
  }
}

async function restoreRouteWithStackHydration(
  restoreRoute: (router: Router, userId?: string | null) => Promise<string | null> | string | null,
  mode: 'deferred' | 'immediate',
  userId?: string | null,
) {
  const restoredPath = getLastVisitedRoute(userId)
  if (!restoredPath || getRouteRestoreMode(restoredPath) !== mode) {
    return null
  }

  const backStack = getRestoreBackStack(restoredPath)
  const parentPath = backStack[backStack.length - 1] || null

  if (shouldInstallRestoreBackStack(restoredPath) && parentPath && parentPath !== restoredPath && isNoteDetailPath(restoredPath)) {
    await replayRecentIonicStack(parentPath, restoredPath)
    return restoredPath
  }

  const finalPath = await restoreRoute(router, userId)

  if (shouldInstallRestoreBackStack(finalPath)) {
    installRestoredRouteVirtualBackStack(router, finalPath)
  }

  return finalPath
}

void restoreRouteWithStackHydration(restoreImmediateLastVisitedRoute, 'immediate', authService.getCurrentAuthUser()?.id)

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
    await restoreRouteWithStackHydration(restoreDeferredLastVisitedRoute, 'deferred', authManager.userInfo.value?.id)
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
        await restoreRouteWithStackHydration(restoreImmediateLastVisitedRoute, 'immediate', user.id)
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
      await restoreRouteWithStackHydration(restoreImmediateLastVisitedRoute, 'immediate', null)
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
    <template v-else>
      <IonRouterOutlet />
      <div
        v-if="isSilentRestoreReplaying"
        data-testid="app-silent-restore-mask"
        class="app-silent-restore-mask"
      />
    </template>
  </IonApp>
</template>

<style scoped>
.app-private-route-pending {
  width: 100%;
  min-height: 100vh;
}

.app-silent-restore-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: var(--ion-background-color, var(--c-blue-gray-950));
}
</style>
