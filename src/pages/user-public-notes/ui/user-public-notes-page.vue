<script setup lang="ts">
import type { FolderTreeNode } from '@/shared/types'
import type { PublicUserInfo } from '@/shared/types/pocketbase'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue'
import { alertCircleOutline, folderOutline } from 'ionicons/icons'
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useUserPublicNotes } from '@/entities/public-note'
import FolderPage from '@/pages/folder/ui/folder-page.vue'
import NoteDetail from '@/pages/note-detail/ui/note-detail-page.vue'
import { useSimpleBackButton } from '@/processes/navigation'
import { ensurePublicNotesReady, usePublicUserCache } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'
import NoteList from '@/widgets/note-list'

const route = useRoute()
const { isDesktop } = useDeviceType()

// 获取路由参数
const username = computed(() => route.params.username as string)

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/', '返回')

const { getPublicUserInfo } = usePublicUserCache()
// 初始化用户公开笔记存储
const {
  getPublicFolderTreeByPUuid,
} = useUserPublicNotes(username.value)

// 页面状态
const loading = ref(true)
const error = ref('')
const publicFolders = ref<FolderTreeNode[]>([])
const userInfo = ref<PublicUserInfo | null>(null)
const presentingElement = ref()
const page = ref()

// 状态管理
const state = reactive({
  folderUuid: '',
  noteUuid: '',
})

const expandedStateKey = computed(() => `home:public:${username.value}`)

// 初始化数据
async function init() {
  if (!username.value) {
    error.value = '无效的用户名'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''

    // 从远程获取数据
    userInfo.value = await getPublicUserInfo(username.value)
    await ensurePublicNotesReady(username.value)
    publicFolders.value = getPublicFolderTreeByPUuid()
  }
  catch (err) {
    error.value = err instanceof Error ? err.message : '加载用户数据失败'
    console.error('加载用户数据失败:', err)
  }
  finally {
    loading.value = false
  }
}

// 刷新数据
async function refresh(ev: CustomEvent) {
  await init() // 强制刷新，从远程获取数据
  ev.detail.complete()
}

onIonViewWillEnter(() => {
  init()
})

onMounted(() => {
  presentingElement.value = page.value.$el
  init()
})
</script>

<template>
  <IonPage ref="page" :class="{ 'note-desktop': isDesktop }">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ userInfo?.username }}</IonTitle>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonRefresher slot="fixed" @ion-refresh="refresh($event)">
        <IonRefresherContent />
      </IonRefresher>

      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ userInfo?.username }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div v-if="loading" class="loading-container">
        <IonSpinner />
        <p>加载中...</p>
      </div>

      <div v-else-if="error" class="error-container">
        <IonIcon :icon="alertCircleOutline" size="large" />
        <h2>无法加载用户数据</h2>
        <p>{{ error }}</p>
        <IonButton @click="$router.push('/')">
          返回首页
        </IonButton>
      </div>

      <div v-else>
        <!-- 使用NoteList组件显示文件夹列表 -->
        <NoteList
          :note-uuid="state.folderUuid"
          :data-list="publicFolders"
          :expanded-state-key="expandedStateKey"
          :presenting-element="presentingElement"
          :disabled-route="isDesktop"
          @refresh="init"
          @selected="(id: string) => state.folderUuid = id"
        />

        <!-- 空状态 -->
        <div v-if="publicFolders.length === 0" class="empty-state">
          <IonIcon :icon="folderOutline" size="large" />
          <h2>暂无公开文件夹</h2>
          <p>该用户还没有分享任何文件夹</p>
        </div>
      </div>
    </IonContent>

    <!-- 桌面端布局 -->
    <div v-if="isDesktop" class="home-list">
      <FolderPage
        :current-folder="state.folderUuid"
        @selected="(id: string) => state.noteUuid = id"
      />
    </div>
    <div v-if="isDesktop" class="home-detail">
      <NoteDetail :note-uuid="state.noteUuid" />
    </div>
  </IonPage>
</template>

<style lang="scss">
.loading-container,
.error-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  gap: 1rem;
  text-align: center;
  color: var(--ion-color-medium);
}

.ion-page {
  .note-desktop {
    right: initial;
    width: 361px;
    border-right: 1px solid #333;
    .home-list {
      width: 361px;
      border-right: 1px solid #333;
      left: 361px;
    }
    .home-detail {
      width: calc(100vw - 361px * 2);
      left: 722px;
    }
  }
  .home-list,
  .home-detail {
    position: fixed;
    height: 100%;
  }
}
</style>
