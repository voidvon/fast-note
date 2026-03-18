import type { UserInfo } from '@/shared/types'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getRealtimeInstance } from '@/core/realtime'
import { useSync } from '@/processes/sync-notes'
import { authService } from '@/shared/api/pocketbase'

const currentUser = ref<UserInfo | null>(null)
const isLoading = ref(false)

export function useAuth() {
  let authChangeUnsubscribe: (() => void) | null = null

  const isLoggedIn = computed(() => !!currentUser.value)
  const userInfo = computed<UserInfo | null>(() => currentUser.value)

  async function login(email: string, password: string) {
    try {
      isLoading.value = true
      const result = await authService.signIn(email, password)

      if (result.success && result.user) {
        currentUser.value = result.user

        try {
          const realtime = getRealtimeInstance()
          await realtime.connect()
          console.log('登录后 Realtime 连接建立成功')

          const { sync } = useSync()
          await sync()
          console.log('登录后数据同步完成')
        }
        catch (error) {
          console.error('登录后连接 Realtime 或同步失败:', error)
        }

        return { success: true, user: result.user }
      }
      else {
        return { success: false, error: result.error }
      }
    }
    catch (error: any) {
      console.error('登录失败:', error.message)
      return { success: false, error: error.message }
    }
    finally {
      isLoading.value = false
    }
  }

  async function register(email: string, password: string, passwordConfirm: string, username?: string) {
    try {
      isLoading.value = true
      const result = await authService.signUp(email, password, passwordConfirm, username)

      if (result.success && result.user) {
        currentUser.value = result.user
        return { success: true, user: result.user }
      }
      else {
        return { success: false, error: result.error }
      }
    }
    catch (error: any) {
      console.error('注册失败:', error.message)
      return { success: false, error: error.message }
    }
    finally {
      isLoading.value = false
    }
  }

  async function logout() {
    try {
      isLoading.value = true

      const realtime = getRealtimeInstance()
      realtime.disconnect()
      console.log('登出时断开 Realtime 连接')

      await authService.signOut()
      currentUser.value = null

      return { success: true }
    }
    catch (error: any) {
      console.error('登出失败:', error.message)
      return { success: false, error: error.message }
    }
    finally {
      isLoading.value = false
    }
  }

  async function initializeAuth() {
    try {
      isLoading.value = true

      const localUser = authService.getCurrentAuthUser()
      if (localUser) {
        currentUser.value = localUser
      }

      if (authService.isAuthenticated()) {
        const result = await authService.getCurrentUser()
        if (result.success && result.user) {
          currentUser.value = result.user

          try {
            const realtime = getRealtimeInstance()
            await realtime.connect()
            console.log('初始化时 Realtime 连接建立成功')

            const { sync } = useSync()
            await sync()
            console.log('初始化时数据同步完成')
          }
          catch (error) {
            console.error('初始化时连接 Realtime 或同步失败:', error)
          }
        }
        else {
          currentUser.value = null
        }
      }
      else {
        currentUser.value = null
      }
    }
    catch (error: any) {
      console.error('初始化认证状态失败:', error.message)
      currentUser.value = null
    }
    finally {
      isLoading.value = false
    }
  }

  async function refreshUser() {
    if (!authService.isAuthenticated()) {
      currentUser.value = null
      return { success: false, error: '未认证' }
    }

    try {
      const result = await authService.getCurrentUser()
      if (result.success && result.user) {
        currentUser.value = result.user
        return { success: true, user: result.user }
      }
      else {
        currentUser.value = null
        return { success: false, error: result.error }
      }
    }
    catch (error: any) {
      console.error('刷新用户信息失败:', error.message)
      currentUser.value = null
      return { success: false, error: error.message }
    }
  }

  function getToken() {
    return authService.getToken()
  }

  function isAuthenticated() {
    return authService.isAuthenticated()
  }

  function setupAuthListener() {
    authChangeUnsubscribe = authService.onAuthChange((token, model) => {
      if (token && model) {
        const nextUserInfo: UserInfo = model
        currentUser.value = nextUserInfo
      }
      else {
        currentUser.value = null
      }
    })
  }

  onMounted(() => {
    initializeAuth()
    setupAuthListener()
  })

  onUnmounted(() => {
    if (authChangeUnsubscribe) {
      authChangeUnsubscribe()
      authChangeUnsubscribe = null
    }
  })

  return {
    userInfo,
    isLoggedIn,
    isLoading: computed(() => isLoading.value),
    currentUser: computed(() => currentUser.value),
    login,
    register,
    logout,
    initializeAuth,
    refreshUser,
    getToken,
    isAuthenticated,
  }
}
