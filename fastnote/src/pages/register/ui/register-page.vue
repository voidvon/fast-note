<script setup lang="ts">
import { ref } from 'vue'
import { useSimpleBackButton } from '@/processes/navigation'
import { useAuth } from '@/processes/session'
import { useDeviceType } from '@/shared/lib/device'
import {
  alertController,
  F7BackButton,
  F7Button,
  F7Buttons,
  F7Content,
  F7Header,
  F7Icon,
  F7Input,
  F7Item,
  F7Label,
  F7Page,
  F7Spinner,
  F7Toolbar,
  loadingController,
  useAppRouter,
} from '@/shared/ui/f7'
import { alertCircle, checkmarkCircle } from '@/shared/ui/icons'

const router = useAppRouter()
const { isDesktop } = useDeviceType()
const { register } = useAuth()

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

    const result = await register(
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
  <F7Page>
    <F7Header :translucent="true">
      <F7Toolbar>
        <F7Buttons position="start">
          <F7BackButton v-bind="backButtonProps" />
        </F7Buttons>
      </F7Toolbar>
    </F7Header>

    <F7Content :fullscreen="true">
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
              <F7Input
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
              <F7Input
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
              <F7Input
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
              <F7Input
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
              <F7Button
                expand="block"
                :disabled="loading || !formData.username || !formData.email || !formData.password || !formData.passwordConfirm"
                @click="handleRegister"
              >
                <F7Spinner v-if="loading" name="crescent" class="mr-2" />
                {{ loading ? '注册中...' : '注册' }}
              </F7Button>
            </div>

            <!-- 错误提示 -->
            <div v-if="error" class="mt-4">
              <F7Item color="danger" lines="none" class="rounded-lg">
                <F7Label class="text-center whitespace-pre-wrap">
                  <F7Icon :icon="alertCircle" class="mr-2" />
                  {{ error }}
                </F7Label>
              </F7Item>
            </div>

            <!-- 成功提示 -->
            <div v-if="message" class="mt-4">
              <F7Item color="success" lines="none" class="rounded-lg">
                <F7Label class="text-center whitespace-pre-wrap">
                  <F7Icon :icon="checkmarkCircle" class="mr-2" />
                  {{ message }}
                </F7Label>
              </F7Item>
            </div>

            <!-- 登录链接 -->
            <div class="flex justify-center items-center">
              已有账户？
              <F7Button
                fill="clear"
                :disabled="loading"
                @click="router.replace('/login')"
              >
                立即登录
              </F7Button>
            </div>
          </div>
        </div>
      </div>
    </F7Content>
  </F7Page>
</template>
