<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { pocketbaseAuthAdapter } from '@/adapters/pocketbase/auth-adapter'
import { PocketBaseRealtimeAdapter } from '@/adapters/pocketbase/realtime-adapter'
import { authManager } from '@/core/auth-manager'
import { realtimeManager } from '@/core/realtime-manager'
import { useSync } from '@/hooks/useSync'
import { useTheme } from '@/hooks/useTheme'
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

onMounted(async () => {
  // 初始化主题
  initTheme()

  // 初始化认证服务
  console.warn('🚀 初始化认证服务...')
  authManager.setAuthService(pocketbaseAuthAdapter)
  await authManager.initialize()

  // 如果用户已登录，先建立 Realtime 连接，再执行数据同步
  if (authManager.isAuthenticated()) {
    console.warn('🔌 用户已登录，初始化 Realtime 连接和数据同步...')
    const realtimeAdapter = new PocketBaseRealtimeAdapter({
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
    })

    realtimeManager.setRealtimeService(realtimeAdapter)

    try {
      // 1. 先建立 Realtime 连接，开始接收实时推送
      await realtimeManager.connect()
      console.warn('✅ Realtime 连接初始化完成')

      // 2. 执行数据同步，获取云端最新数据
      // 在同步过程中如果有新的变更，也能通过 Realtime 接收到
      const { sync } = useSync()
      await sync()
      console.warn('✅ 初始化时数据同步完成')
    }
    catch (error) {
      console.error('❌ Realtime 连接或数据同步失败:', error)
      // 不影响应用启动
    }
  }
  else {
    console.warn('👤 用户未登录，跳过 Realtime 连接和数据同步')
  }
})
</script>

<template>
  <IonApp>
    <IonRouterOutlet />
  </IonApp>
</template>
