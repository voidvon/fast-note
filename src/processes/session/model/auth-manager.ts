import type { IAuthService } from '@/shared/lib/auth'
import type { UserInfo } from '@/shared/types'
import { computed, ref } from 'vue'

class AuthManager {
  private authService: IAuthService | null = null
  private currentUser = ref<UserInfo | null>(null)
  private isLoading = ref(false)
  private authChangeUnsubscribe: (() => void) | null = null

  readonly isLoggedIn = computed(() => !!this.currentUser.value)
  readonly userInfo = computed(() => this.currentUser.value)
  readonly loading = computed(() => this.isLoading.value)

  setAuthService(service: IAuthService) {
    if (this.authService) {
      console.warn('认证服务已经设置，将被覆盖')
      this.cleanup()
    }

    this.authService = service
    this.setupAuthListener()
  }

  getAuthService(): IAuthService {
    if (!this.authService) {
      throw new Error('认证服务未初始化，请先调用 setAuthService')
    }
    return this.authService
  }

  async login(email: string, password: string) {
    if (!this.authService) {
      throw new Error('认证服务未初始化')
    }

    try {
      this.isLoading.value = true
      const result = await this.authService.signIn(email, password)

      if (result.success && result.user) {
        this.currentUser.value = result.user
      }

      return result
    }
    finally {
      this.isLoading.value = false
    }
  }

  async register(email: string, password: string, passwordConfirm: string, username?: string) {
    if (!this.authService) {
      throw new Error('认证服务未初始化')
    }

    try {
      this.isLoading.value = true
      const result = await this.authService.signUp(email, password, passwordConfirm, username)

      if (result.success && result.user) {
        this.currentUser.value = result.user
      }

      return result
    }
    finally {
      this.isLoading.value = false
    }
  }

  async logout() {
    if (!this.authService) {
      throw new Error('认证服务未初始化')
    }

    try {
      this.isLoading.value = true
      await this.authService.signOut()
      this.currentUser.value = null
      return { success: true }
    }
    catch (error: any) {
      console.error('登出失败:', error.message)
      return { success: false, error: error.message }
    }
    finally {
      this.isLoading.value = false
    }
  }

  async initialize() {
    if (!this.authService) {
      throw new Error('认证服务未初始化')
    }

    try {
      this.isLoading.value = true

      const localUser = this.authService.getCurrentAuthUser()
      if (localUser) {
        this.currentUser.value = localUser
      }

      if (this.authService.isAuthenticated()) {
        const result = await this.authService.getCurrentUser()
        if (result.success && result.user) {
          this.currentUser.value = result.user
        }
        else {
          this.currentUser.value = null
        }
      }
      else {
        this.currentUser.value = null
      }
    }
    catch (error: any) {
      console.error('初始化认证状态失败:', error.message)
      this.currentUser.value = null
    }
    finally {
      this.isLoading.value = false
    }
  }

  async refreshUser() {
    if (!this.authService) {
      throw new Error('认证服务未初始化')
    }

    if (!this.authService.isAuthenticated()) {
      this.currentUser.value = null
      return { success: false, error: '未认证' }
    }

    try {
      const result = await this.authService.getCurrentUser()
      if (result.success && result.user) {
        this.currentUser.value = result.user
        return { success: true, user: result.user }
      }

      this.currentUser.value = null
      return { success: false, error: result.error }
    }
    catch (error: any) {
      console.error('刷新用户信息失败:', error.message)
      this.currentUser.value = null
      return { success: false, error: error.message }
    }
  }

  getToken(): string | null {
    if (!this.authService) {
      return null
    }
    return this.authService.getToken()
  }

  isAuthenticated(): boolean {
    if (!this.authService) {
      return false
    }
    return this.authService.isAuthenticated()
  }

  private setupAuthListener() {
    if (!this.authService) {
      return
    }

    this.authChangeUnsubscribe = this.authService.onAuthChange((token, user) => {
      this.currentUser.value = token && user ? user : null
    })
  }

  private cleanup() {
    if (this.authChangeUnsubscribe) {
      this.authChangeUnsubscribe()
      this.authChangeUnsubscribe = null
    }
  }
}

export const authManager = new AuthManager()
