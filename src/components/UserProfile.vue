<script setup lang="ts">
import {
  alertController,
  IonAvatar,
  IonButton,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonRow,
  IonTitle,
  IonToolbar,
  loadingController,
  useIonRouter,
} from '@ionic/vue'
import {
  closeOutline,
  logInOutline,
  logOutOutline,
  personCircleOutline,
  syncOutline,
  warningOutline,
} from 'ionicons/icons'
import { computed, onMounted, ref } from 'vue'
import { authManager } from '@/core/auth-manager'
import { realtimeManager } from '@/core/realtime-manager'
import { useSync } from '@/hooks/useSync'
import { pb } from '@/pocketbase'

// 获取全局版本号
const version = (window as any).version

const router = useIonRouter()
const { sync, syncing, syncStatus, getLocalDataStats } = useSync()

// 使用核心 authManager
const currentUser = authManager.userInfo
const isLoggedIn = authManager.isLoggedIn

// 计算头像 URL
const avatarUrl = computed(() => {
  if (!currentUser.value || !currentUser.value.avatar) {
    return ''
  }

  // 构造 PocketBase 文件 URL
  // 格式：{pocketbase_url}/api/files/{collection}/{record_id}/{filename}
  return `${pb.baseUrl}/api/files/users/${currentUser.value.id}/${currentUser.value.avatar}`
})

// 弹窗控制
const isModalOpen = ref(false)
const isLoading = ref(false)

// 同步相关状态
const syncResult = ref<{ uploaded: number, downloaded: number, deleted: number } | null>(null)
const localStats = ref<{ notes: number } | null>(null)

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
            const loading = await loadingController.create({
              message: '正在退出...',
            })
            await loading.present()

            // 断开 Realtime 连接
            realtimeManager.disconnect()

            // 使用核心 authManager 退出
            await authManager.logout()

            await loading.dismiss()
            closeModal()
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
  let loading: HTMLIonLoadingElement | null = null

  try {
    loading = await loadingController.create({
      message: '正在同步数据...',
    })
    await loading.present()

    // 非静默模式：未登录会抛出错误
    const result = await sync(false)

    if (result) {
      syncResult.value = result
    }

    await loading.dismiss()

    // 显示同步结果
    if (result) {
      const alert = await alertController.create({
        header: '同步完成',
        message: `上传: ${result.uploaded} 条, 下载: ${result.downloaded} 条, 删除: ${result.deleted} 条`,
        buttons: ['确定'],
      })
      await alert.present()
    }

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
    <IonButton
      v-if="!isLoggedIn"
      fill="clear"
      size="small"
      @click="handleLogin"
    >
      <IonIcon slot="icon-only" :icon="logInOutline" />
    </IonButton>

    <IonButton
      v-else
      fill="clear"
      size="small"
      style="--padding-start: 0px;"
      @click="openModal"
    >
      <div class="flex items-center space-x-1 bg-primary c-gray-100 rounded-full p-[1px]">
        <IonAvatar class="w-6 h-6">
          <IonImg
            v-if="currentUser && avatarUrl"
            :src="avatarUrl"
            :alt="currentUser?.username || '用户头像'"
          />
          <IonIcon
            v-else
            :icon="personCircleOutline"
            class="w-full h-full"
          />
        </IonAvatar>
        <div class="pr-2">
          {{ currentUser?.username }}
        </div>
      </div>
    </IonButton>
  </div>

  <!-- 用户信息详情弹窗 -->
  <IonModal :is-open="isModalOpen" @did-dismiss="closeModal">
    <IonHeader>
      <IonToolbar>
        <IonTitle>用户信息</IonTitle>
        <IonButton
          slot="end"
          fill="clear"
          @click="closeModal"
        >
          <IonIcon :icon="closeOutline" />
        </IonButton>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <IonGrid>
        <IonRow>
          <IonCol size="12">
            <!-- 用户基本信息 -->
            <IonList>
              <IonItem>
                <IonLabel>
                  <h3>用户名</h3>
                  <p>{{ currentUser?.username }}</p>
                </IonLabel>
                <IonAvatar slot="end" class="w-10 h-10">
                  <IonImg
                    v-if="currentUser && avatarUrl"
                    :src="avatarUrl"
                    :alt="currentUser?.username || '用户头像'"
                  />
                  <IonIcon
                    v-else
                    :icon="personCircleOutline"
                    class="w-full h-full text-gray-400"
                  />
                </IonAvatar>
              </IonItem>

              <IonItem v-if="currentUser?.email">
                <IonLabel>
                  <h3>邮箱</h3>
                  <p>{{ currentUser.email }}</p>
                </IonLabel>
              </IonItem>

              <IonItem v-if="currentUser?.created">
                <IonLabel>
                  <h3>注册时间</h3>
                  <p>{{ new Date(currentUser.created).toLocaleDateString('zh-CN') }}</p>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>本地笔记数量</h3>
                  <p>{{ localStats?.notes ?? '加载中...' }} 条</p>
                </IonLabel>
              </IonItem>

              <IonItem v-if="syncResult">
                <IonLabel>
                  <h3>上次同步结果</h3>
                  <p>上传: {{ syncResult.uploaded }} 条, 下载: {{ syncResult.downloaded }} 条, 删除: {{ syncResult.deleted }} 条</p>
                </IonLabel>
              </IonItem>

              <IonItem v-if="syncStatus.lastSyncTime">
                <IonLabel>
                  <h3>上次同步时间</h3>
                  <p>{{ syncStatus.lastSyncTime.toLocaleString('zh-CN') }}</p>
                </IonLabel>
              </IonItem>

              <IonItem v-if="syncStatus.error">
                <IonLabel color="danger">
                  <h3>同步错误</h3>
                  <p>{{ syncStatus.error }}</p>
                </IonLabel>
                <IonIcon slot="end" :icon="warningOutline" color="danger" />
              </IonItem>

              <IonItem>
                <IonLabel>
                  <h3>版本号</h3>
                  <p>{{ version }}</p>
                </IonLabel>
              </IonItem>
            </IonList>

            <!-- 操作按钮 -->
            <div class="flex mt-4 flex-col space-y-3">
              <IonButton
                v-if="isLoggedIn"
                expand="block"
                color="primary"
                :disabled="syncing || isLoading"
                @click="handleSync"
              >
                <IonIcon slot="start" :icon="syncOutline" />
                {{ syncing ? '同步中...' : '同步数据' }}
              </IonButton>

              <IonButton
                expand="block"
                color="danger"
                @click="handleLogout"
              >
                <IonIcon slot="start" :icon="logOutOutline" />
                退出登录
              </IonButton>
            </div>
          </IonCol>
        </IonRow>
      </IonGrid>
    </IonContent>
  </IonModal>
</template>

<style lang="scss">
.example-test {
  // 打包出空css导致edgeone 404
  color: red;
}
</style>
