<script setup lang="ts">
import type { F7LoadingElement } from '@/shared/ui/f7'
import {
  f7Block as F7Block,
  f7BlockTitle as F7BlockTitle,
  f7Link as F7Link,
  f7List as F7List,
  f7ListItem as F7ListItem,
  f7PageContent as F7PageContent,
  f7Popup as F7Popup,
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
      fill="clear"
      size="small"
      data-testid="user-profile-trigger"
      style="--padding-start: 0px;"
      @click="openModal"
    >
      <div class="flex items-center space-x-1">
        <F7Avatar class="user-profile-trigger__avatar">
          <F7Image
            v-if="currentUser && avatarUrl"
            class="user-profile-trigger__avatar-image"
            :src="avatarUrl"
            :alt="currentUser?.username || '用户头像'"
          />
          <F7Icon
            v-else
            :icon="personCircleOutline"
            class="user-profile-trigger__avatar-icon"
          />
        </F7Avatar>
        <div class="user-profile-trigger__name pr-2">
          {{ currentUser?.username }}
        </div>
      </div>
    </F7Button>
  </div>

  <!-- 用户信息详情弹窗 -->
  <component
    :is="isDesktop ? F7Popup : F7Modal"
    class="user-profile-modal"
    :is-open="isDesktop ? undefined : isModalOpen"
    :opened="isDesktop ? isModalOpen : undefined"
    :class="{ 'user-profile-modal--desktop': isDesktop }"
    @update:is-open="isModalOpen = $event"
    @update:opened="isModalOpen = $event"
    @popup:closed="closeModal"
    @did-dismiss="closeModal"
  >
    <F7Toolbar top class="user-profile-modal__toolbar">
      <div class="user-profile-modal__title">
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
      <div class="user-profile-modal__identity">
        <img
          v-if="currentUser && avatarUrl"
          class="user-profile-modal__hero-avatar"
          :src="avatarUrl"
          :alt="currentUser?.username || '用户头像'"
        >
        <span v-else class="user-profile-modal__hero-avatar user-profile-modal__avatar--fallback" aria-hidden="true">
          {{ profileInitial }}
        </span>
        <div class="user-profile-modal__identity-copy">
          <strong>{{ currentUser?.username || '未命名用户' }}</strong>
          <span>{{ currentUser?.email || '未设置邮箱' }}</span>
        </div>
      </div>

      <F7BlockTitle>账户</F7BlockTitle>
      <F7List strong inset dividers media-list>
        <F7ListItem
          title="账户状态"
          subtitle="已登录并可同步"
        >
          <template #media>
            <F7Icon :icon="personCircleOutline" />
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
          large
          :loading="syncing"
          :disabled="syncing || isLoading"
          @click="handleSync"
        >
          {{ syncing ? '同步中...' : '同步数据' }}
        </F7SheetButton>
        <F7SheetButton
          large
          :disabled="isLoading"
          @click="handleLogout"
        >
          退出登录
        </F7SheetButton>
      </F7Block>
    </F7PageContent>
  </component>
</template>

<style lang="scss">
.user-profile-trigger__avatar {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  overflow: hidden;
  border-radius: 50%;
}

.user-profile-trigger__avatar-image,
.user-profile-trigger__avatar-icon {
  display: block;
  width: 100%;
  height: 100%;
}

.user-profile-trigger__avatar-image {
  object-fit: cover;
}

.user-profile-trigger__name {
  color: var(--c-text-primary);
}

.user-profile-modal {
  --f7-sheet-height: 100vh;
  --f7-sheet-border-radius: 24px;

  > .sheet-modal-inner {
    width: min(520px, 100%);
    margin: auto;
  }
}

.user-profile-modal__identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 16px 8px;
}

.user-profile-modal__hero-avatar {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  border-radius: 50%;
  object-fit: cover;
}

.user-profile-modal__identity-copy {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.user-profile-modal__identity-copy strong,
.user-profile-modal__identity-copy span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-profile-modal__identity-copy strong {
  color: var(--c-text-primary);
  font-size: 18px;
}

.user-profile-modal__identity-copy span {
  color: var(--c-text-secondary);
  font-size: 13px;
}

.user-profile-modal--desktop {
  --f7-popup-tablet-width: 400px;
  --f7-popup-tablet-height: min(620px, calc(100vh - 48px));
  --f7-popup-tablet-border-radius: 14px;
}

.user-profile-modal--desktop .user-profile-modal__toolbar {
  --f7-toolbar-height: 48px;
}

.user-profile-modal--desktop .user-profile-modal__body {
  max-height: min(560px, calc(100vh - 84px));
}

@media (max-width: 767px) {
  .user-profile-modal {
    --f7-sheet-height: min(92vh, 760px);
  }
}

.user-profile-modal__toolbar {
  --f7-toolbar-border-color: transparent;
}

.user-profile-modal__title {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  color: var(--c-text-primary);
  font-size: 17px;
  font-weight: 600;
}

.user-profile-modal__body {
  --f7-page-toolbar-top-offset: var(--f7-toolbar-height);

  overflow-y: auto;
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
  font-size: 18px;
  font-weight: 600;
}

.user-profile-modal__actions {
  display: grid;
  gap: 12px;
  padding-bottom: calc(24px + var(--f7-safe-area-bottom));
}
</style>
