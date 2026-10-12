<script setup lang="ts">
import { ref } from 'vue'
import { useSimpleBackButton } from '@/processes/navigation'
import { useAuth } from '@/processes/session'
import {
  alertController,
  F7BackButton,
  F7Block,
  F7BlockTitle,
  F7Button,
  F7Buttons,
  F7Content,
  F7Header,
  F7List,
  F7ListInput,
  F7Page,
  F7Spinner,
  F7Toolbar,
  loadingController,
  useAppRouter,
} from '@/shared/ui/f7'

const router = useAppRouter()
const { login } = useAuth()

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/', '返回')

const loading = ref(false)
const error = ref('')
const message = ref('')

const formData = ref({
  email: '',
  password: '',
})

async function handleLogin() {
  if (loading.value)
    return

  // 验证输入
  if (!formData.value.email || !formData.value.password) {
    const alert = await alertController.create({
      header: '提示',
      message: '请输入邮箱和密码',
      buttons: ['确定'],
    })
    alert.present()
    return
  }

  const loadingInstance = await loadingController.create({
    message: '正在登录...',
  })
  loadingInstance.present()

  try {
    error.value = ''
    message.value = ''
    loading.value = true

    const result = await login(formData.value.email, formData.value.password)
    if (!result.success || result.error) {
      throw new Error(result.error || '登录失败')
    }

    // 登录成功，显示成功消息并返回上一页
    message.value = '登录成功！'
    setTimeout(() => {
      router.back()
    }, 1000)
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '登录失败'
    console.error('登录错误:', err)
  }
  finally {
    loading.value = false
    loadingInstance.dismiss()
  }
}
</script>

<template>
  <F7Page class="fastnote-login-page">
    <F7Header :translucent="true">
      <F7Toolbar>
        <F7Buttons position="start">
          <F7BackButton v-bind="backButtonProps" />
        </F7Buttons>
      </F7Toolbar>
    </F7Header>

    <F7Content class="fastnote-login-page__content">
      <form class="fastnote-login-page__form" novalidate @submit.prevent="handleLogin">
        <F7BlockTitle large class="text-align-center">
          用户登录
        </F7BlockTitle>
        <F7Block class="text-align-center">
          请输入您的邮箱和密码
        </F7Block>

        <F7List strong inset>
          <F7ListInput
            v-model:value="formData.email"
            input-id="login-email"
            name="email"
            label="邮箱地址"
            placeholder="请输入邮箱地址"
            type="email"
            autocomplete="username"
            :disabled="loading"
          />
          <F7ListInput
            v-model:value="formData.password"
            input-id="login-password"
            name="password"
            label="密码"
            placeholder="请输入密码"
            type="password"
            autocomplete="current-password"
            :disabled="loading"
          />
        </F7List>

        <F7Block inset class="no-padding-horizontal">
          <F7Button
            type="submit"
            :fill="true"
            large
            round
            :disabled="loading || !formData.email || !formData.password"
          >
            <F7Spinner v-if="loading" class="margin-right-half" />
            {{ loading ? '登录中...' : '登录' }}
          </F7Button>
        </F7Block>

        <F7Block v-if="error" inset role="alert" class="text-align-center text-color-red">
          {{ error }}
        </F7Block>
        <F7Block v-if="message" inset role="status" class="text-align-center text-color-green">
          {{ message }}
        </F7Block>

        <F7Block inset class="text-align-center">
          还没有账户？
          <F7Button
            class="display-inline-flex"
            :disabled="loading"
            @click="router.replace('/register')"
          >
            立即注册
          </F7Button>
        </F7Block>
      </form>
    </F7Content>
  </F7Page>
</template>

<style lang="scss">
.fastnote-login-page {
  .fastnote-login-page__content {
    display: flex;
    align-items: center;
  }

  .fastnote-login-page__form {
    width: 100%;
    max-width: 480px;
    margin: auto;
    padding-block: 24px;
  }
}
</style>
