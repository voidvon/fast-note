<script setup lang="ts">
import type { F7LoadingElement } from '@/shared/ui/f7'
import {
  f7Block as F7Block,
  f7BlockTitle as F7BlockTitle,
  f7Link as F7Link,
  f7List as F7List,
  f7ListItem as F7ListItem,
  f7PageContent as F7PageContent,
  f7Button as F7SheetButton,
  f7Toolbar as F7Toolbar,
} from 'framework7-vue'
import { computed, onMounted, ref } from 'vue'
import { useAuth } from '@/processes/session'
import { useSync } from '@/processes/sync-notes'
import { useDeviceType } from '@/shared/lib/device'
import {
  alertController,
  F7Avatar,
  F7Button,
  F7Icon,
  F7Image,
  F7Modal,
  loadingController,
  useAppRouter,
} from '@/shared/ui/f7'
import {
  logInOutline,
  personCircleOutline,
} from '@/shared/ui/icons'

// 获取全局版本号
const version = (window as any).version

const router = useAppRouter()
const { isDesktop } = useDeviceType()
const { bidirectionalSync, syncing, syncStatus, getLocalDataStats } = useSync()
const { avatarUrl, currentUser, isLoggedIn, logout } = useAuth()

// 弹窗控制
const isModalOpen = ref(false)
const isLoading = ref(false)
const modalBreakpoints = computed(() => (isDesktop.value ? undefined : [0, 0.72, 1]))
const modalInitialBreakpoint = computed(() => (isDesktop.value ? undefined : 0.72))

// 同步相关状态
const syncResult = ref<{ uploaded: number, downloaded: number, deleted: number } | null>(null)
const localStats = ref<{ notes: number } | null>(null)
const profileInitial = computed(() => currentUser.value?.username?.trim().charAt(0).toUpperCase() || '?')
const registrationDate = computed(() => currentUser.value?.created
  ? new Date(currentUser.value.created).toLocaleDateString('zh-CN')
  : '')
const syncResultSummary = computed(() => syncResult.value
  ? `上传 ${syncResult.value.uploaded}，下载 ${syncResult.value.downloaded}，删除 ${syncResult.value.deleted}`
  : '')
const attachmentHasWarning = computed(() => syncStatus.value.attachments.failed + syncStatus.value.attachments.missing > 0)
const attachmentSummary = computed(() => {
  const attachments = syncStatus.value.attachments
  if (attachments.quotaExceeded)
    return '设备存储空间不足，附件可在需要时重新下载'
  if (attachmentHasWarning.value)
    return `已缓存 ${attachments.ready}/${attachments.total}，失败 ${attachments.failed + attachments.missing}，点击附件可重试`
  return `已缓存 ${attachments.ready}/${attachments.total}，其余附件将在查看时下载`
})

function handleLogin() {
  router.push('/login')
}

function openModal() {
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
}

async function handleLogout() {
  try {
    const alert = await alertController.create({
      header: '确认退出',
      message: '您确定要退出登录吗？',
      buttons: [
        {
          text: '取消',
          role: 'cancel',
        },
        {
          text: '确认',
          handler: async () => {
            isLoading.value = true
            const loading = await loadingController.create({
              message: '正在退出...',
            })
            await loading.present()

            try {
              await logout()
              closeModal()
            }
            finally {
              await loading.dismiss()
              isLoading.value = false
            }
          },
        },
      ],
    })

    await alert.present()
  }
  catch (error) {
    console.error('退出登录失败:', error)
  }
}

// 加载本地数据统计
async function loadLocalStats() {
  try {
    localStats.value = await getLocalDataStats()
  }
  catch (error) {
    console.error('获取本地数据统计失败:', error)
  }
}

// 处理同步功能
async function handleSync() {
  let loading: F7LoadingElement | null = null

  try {
    loading = await loadingController.create({
      message: '正在同步数据...',
    })
    await loading.present()

    // 非静默模式：未登录会抛出错误
    const result = await bidirectionalSync(false)

    if (result) {
      syncResult.value = result
    }

    await loading.dismiss()

    // 刷新本地数据统计
    await loadLocalStats()
  }
  catch (error) {
    console.error('同步失败:', error)

    // 确保 loading 被关闭
    if (loading) {
      await loading.dismiss()
    }

    // 显示错误提示（包括"用户未登录，请先登录"）
    const alert = await alertController.create({
      header: '同步失败',
      message: error instanceof Error ? error.message : '同步过程中发生错误',
      buttons: ['确定'],
    })
    await alert.present()
  }
}

// 组件挂载时加载本地数据统计
onMounted(() => {
  if (isLoggedIn.value) {
    loadLocalStats()
  }
})
</script>

<template>
  <!-- 头部用户信息按钮 -->
  <div class="flex items-center">
    <F7Button
      v-if="!isLoggedIn"
      fill="clear"
      size="small"
      @click="handleLogin"
    >
      <F7Icon slot="icon-only" :icon="logInOutline" />
    </F7Button>

    <F7Button
      v-else
      data-testid="user-profile-trigger"
      fill="clear"
      size="small"
      style="--padding-start: 0px;"
      @click="openModal"
    >
      <div class="flex items-center space-x-1 bg-primary c-gray-100 rounded-full p-[1px]">
        <F7Avatar class="w-6 h-6">
          <F7Image
            v-if="currentUser && avatarUrl"
            :src="avatarUrl"
            :alt="currentUser?.username || '用户头像'"
          />
          <F7Icon
            v-else
            :icon="personCircleOutline"
            class="w-full h-full"
          />
        </F7Avatar>
        <div class="pr-2">
          {{ currentUser?.username }}
        </div>
      </div>
    </F7Button>
  </div>

  <!-- 用户信息详情弹窗 -->
  <F7Modal
    class="user-profile-modal"
    :is-open="isModalOpen"
    :breakpoints="modalBreakpoints"
    :initial-breakpoint="modalInitialBreakpoint"
    :class="{ 'user-profile-modal--desktop': isDesktop }"
    @did-dismiss="closeModal"
  >
    <F7Toolbar top class="user-profile-modal__toolbar">
      <div class="left user-profile-modal__title">
        用户信息
      </div>
      <div class="right">
        <F7Link @click="closeModal">
          完成
        </F7Link>
      </div>
    </F7Toolbar>

    <F7PageContent
      class="user-profile-modal__body"
      :class="{ 'user-profile-modal__body--desktop': isDesktop }"
    >
      <F7BlockTitle>账户</F7BlockTitle>
      <F7List strong inset dividers media-list>
        <F7ListItem
          :title="currentUser?.username || '未命名用户'"
          :subtitle="currentUser?.email || '未设置邮箱'"
        >
          <template #media>
            <img
              v-if="currentUser && avatarUrl"
              class="user-profile-modal__avatar"
              :src="avatarUrl"
              :alt="currentUser.username || '用户头像'"
            >
            <span v-else class="user-profile-modal__avatar user-profile-modal__avatar--fallback" aria-hidden="true">
              {{ profileInitial }}
            </span>
          </template>
        </F7ListItem>
        <F7ListItem v-if="registrationDate" title="注册时间" :after="registrationDate" />
      </F7List>

      <F7BlockTitle>数据与同步</F7BlockTitle>
      <F7List strong inset dividers>
        <F7ListItem title="本地笔记" :after="`${localStats?.notes ?? '加载中...'} 条`" />
        <F7ListItem v-if="syncResultSummary" title="上次同步结果" :footer="syncResultSummary" />
        <F7ListItem
          v-if="syncStatus.lastSyncTime"
          title="上次同步时间"
          :footer="syncStatus.lastSyncTime.toLocaleString('zh-CN')"
        />
        <F7ListItem
          v-if="syncStatus.attachments.total > 0"
          title="附件缓存"
          :footer="attachmentSummary"
          :text-color="attachmentHasWarning ? 'orange' : undefined"
        />
        <F7ListItem
          v-if="syncStatus.error"
          title="同步错误"
          :footer="syncStatus.error"
          text-color="red"
        />
      </F7List>

      <F7BlockTitle>应用</F7BlockTitle>
      <F7List strong inset dividers>
        <F7ListItem title="版本号" :after="version" />
      </F7List>

      <F7Block inset class="user-profile-modal__actions">
        <F7SheetButton
          v-if="isLoggedIn"
          fill
          large
          :loading="syncing"
          :disabled="syncing || isLoading"
          @click="handleSync"
        >
          {{ syncing ? '同步中...' : '同步数据' }}
        </F7SheetButton>
        <F7SheetButton
          outline
          large
          color="red"
          :disabled="isLoading"
          @click="handleLogout"
        >
          退出登录
        </F7SheetButton>
      </F7Block>
    </F7PageContent>
  </F7Modal>
</template>

<style lang="scss">
.user-profile-modal {
  --f7-sheet-height: 100vh;
  --f7-sheet-border-radius: 24px;

  > .sheet-modal-inner {
    width: min(520px, 100%);
    margin: auto;
  }
}

.user-profile-modal--desktop {
  --f7-sheet-height: min(80vh, 720px);

  > .sheet-modal-inner {
    max-height: min(80vh, 720px);
  }
}

.user-profile-modal__toolbar {
  --f7-toolbar-bg-color: var(--c-list-background);
  --f7-toolbar-border-color: var(--c-border);
}

.user-profile-modal__title {
  padding-left: 16px;
  color: var(--c-text-primary);
  font-size: 17px;
  font-weight: 600;
}

.user-profile-modal__body {
  --f7-page-toolbar-top-offset: var(--f7-toolbar-height);

  overflow-y: auto;
  background: var(--c-page-background);
}

.user-profile-modal__avatar {
  display: block;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  object-fit: cover;
}

.user-profile-modal__avatar--fallback {
  display: grid;
  place-items: center;
  background: var(--f7-theme-color);
  color: var(--c-gray-0);
  font-size: 18px;
  font-weight: 600;
}

.user-profile-modal__actions {
  display: grid;
  gap: 12px;
  padding-bottom: calc(16px + var(--f7-safe-area-bottom));
}
</style>
