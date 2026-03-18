import type { UserInfo } from '@/shared/types'
import { computed } from 'vue'
import { authManager } from '@/core/auth-manager'
import { pb } from '@/shared/api/pocketbase'

export function getUserAvatarUrl(user?: Pick<UserInfo, 'id' | 'avatar'> | null) {
  if (!user?.id || !user.avatar) {
    return ''
  }

  return `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}`
}

export function useAuth() {
  const currentUser = authManager.userInfo
  const isLoggedIn = authManager.isLoggedIn ?? computed(() => !!currentUser.value)
  const isLoading = authManager.loading ?? computed(() => false)

  async function login(email: string, password: string) {
    if (typeof authManager.login !== 'function') {
      return { success: false, error: '认证服务未初始化' }
    }

    return await authManager.login.call(authManager, email, password)
  }

  async function register(email: string, password: string, passwordConfirm: string, username?: string) {
    if (typeof authManager.register !== 'function') {
      return { success: false, error: '认证服务未初始化' }
    }

    return await authManager.register.call(authManager, email, password, passwordConfirm, username)
  }

  async function logout() {
    if (typeof authManager.logout !== 'function') {
      return { success: false, error: '认证服务未初始化' }
    }

    return await authManager.logout.call(authManager)
  }

  async function initializeAuth() {
    if (typeof authManager.initialize !== 'function') {
      return
    }

    await authManager.initialize.call(authManager)
  }

  async function refreshUser() {
    if (typeof authManager.refreshUser !== 'function') {
      return { success: false, error: '认证服务未初始化' }
    }

    return await authManager.refreshUser.call(authManager)
  }

  return {
    userInfo: currentUser,
    currentUser,
    isLoggedIn,
    isLoading,
    avatarUrl: computed(() => getUserAvatarUrl(currentUser.value)),
    login,
    register,
    logout,
    initializeAuth,
    refreshUser,
    getToken: () => authManager.getToken?.() ?? null,
    isAuthenticated: () => authManager.isAuthenticated?.() ?? isLoggedIn.value,
  }
}
