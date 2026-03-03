<script setup lang="ts">
import {
  alertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonSpinner,
  IonToolbar,
  loadingController,
  useIonRouter,
} from '@ionic/vue'
import { alertCircle, checkmarkCircle } from 'ionicons/icons'
import { ref } from 'vue'
import { authManager } from '@/core/auth-manager'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useSimpleBackButton } from '@/hooks/useSmartBackButton'

const router = useIonRouter()
const { isDesktop } = useDeviceType()

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/', '返回')

const loading = ref(false)
const error = ref('')
const message = ref('')

const formData = ref({
  username: '',
  email: '',
  password: '',
  passwordConfirm: '',
})

function validateForm(): string | null {
  if (!formData.value.username || !formData.value.email || !formData.value.password || !formData.value.passwordConfirm) {
    return '请填写所有必填字段'
  }

  if (formData.value.password.length < 8) {
    return '密码长度至少为8位'
  }

  if (formData.value.password !== formData.value.passwordConfirm) {
    return '两次输入的密码不一致'
  }

  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  if (!emailRegex.test(formData.value.email)) {
    return '请输入有效的邮箱地址'
  }

  return null
}

async function handleRegister() {
  // 验证输入
  const validationError = validateForm()
  if (validationError) {
    const alert = await alertController.create({
      header: '提示',
      message: validationError,
      buttons: ['确定'],
    })
    alert.present()
    return
  }

  const loadingInstance = await loadingController.create({
    message: '正在注册...',
  })
  loadingInstance.present()

  try {
    error.value = ''
    message.value = ''
    loading.value = true

    // 使用核心 authManager 注册
    const result = await authManager.register(
      formData.value.email,
      formData.value.password,
      formData.value.passwordConfirm,
      formData.value.username,
    )

    if (!result.success || result.error) {
      throw new Error(result.error || '注册失败')
    }

    // 注册成功，显示成功消息并返回上一页
    message.value = '注册成功！正在跳转...'
    setTimeout(() => {
      router.back()
    }, 1500)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '注册失败'
    console.error('注册错误:', err)
  }
  finally {
    loading.value = false
    loadingInstance.dismiss()
  }
}
</script>

<template>
  <IonPage>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <!-- 注册表单容器 -->
      <div class="flex items-center min-h-full justify-center px-4 py-8">
        <div
          :class="{
            'w-full max-w-md': !isDesktop,
            'w-full max-w-lg': isDesktop,
          }"
        >
          <!-- 标题 -->
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              用户注册
            </h1>
            <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
              创建您的新账户
            </p>
          </div>

          <!-- 注册表单 -->
          <div class="bg-transparent">
            <!-- 用户名输入（必填） -->
            <div class="mb-4">
              <IonInput
                v-model="formData.username"
                label="用户名"
                label-placement="floating"
                fill="outline"
                placeholder="请输入用户名"
                type="text"
                mode="md"
                class="rounded-lg"
                :disabled="loading"
              />
            </div>

            <!-- 邮箱输入 -->
            <div class="mb-4">
              <IonInput
                v-model="formData.email"
                label="邮箱地址"
                label-placement="floating"
                fill="outline"
                placeholder="请输入邮箱地址"
                type="email"
                mode="md"
                class="rounded-lg"
                :disabled="loading"
              />
            </div>

            <!-- 密码输入 -->
            <div class="mb-4">
              <IonInput
                v-model="formData.password"
                label="密码"
                label-placement="floating"
                fill="outline"
                placeholder="请输入密码（至少8位）"
                type="password"
                mode="md"
                class="rounded-lg"
                :disabled="loading"
              />
            </div>

            <!-- 确认密码输入 -->
            <div class="mb-6">
              <IonInput
                v-model="formData.passwordConfirm"
                label="确认密码"
                label-placement="floating"
                fill="outline"
                placeholder="请再次输入密码"
                type="password"
                mode="md"
                class="rounded-lg"
                :disabled="loading"
                @keyup.enter="handleRegister"
              />
            </div>

            <!-- 注册按钮 -->
            <div>
              <IonButton
                expand="block"
                :disabled="loading || !formData.username || !formData.email || !formData.password || !formData.passwordConfirm"
                @click="handleRegister"
              >
                <IonSpinner v-if="loading" name="crescent" class="mr-2" />
                {{ loading ? '注册中...' : '注册' }}
              </IonButton>
            </div>

            <!-- 错误提示 -->
            <div v-if="error" class="mt-4">
              <IonItem color="danger" lines="none" class="rounded-lg">
                <IonLabel class="text-center whitespace-pre-wrap">
                  <IonIcon :icon="alertCircle" class="mr-2" />
                  {{ error }}
                </IonLabel>
              </IonItem>
            </div>

            <!-- 成功提示 -->
            <div v-if="message" class="mt-4">
              <IonItem color="success" lines="none" class="rounded-lg">
                <IonLabel class="text-center whitespace-pre-wrap">
                  <IonIcon :icon="checkmarkCircle" class="mr-2" />
                  {{ message }}
                </IonLabel>
              </IonItem>
            </div>

            <!-- 登录链接 -->
            <div class="flex justify-center items-center">
              已有账户？
              <IonButton
                fill="clear"
                :disabled="loading"
                @click="router.replace('/login')"
              >
                立即登录
              </IonButton>
            </div>
          </div>
        </div>
      </div>
    </IonContent>
  </IonPage>
</template>
