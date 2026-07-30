<script setup lang="ts">
import type { CSSProperties } from 'vue'
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
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUserPublicNotes } from '@/entities/public-note'
import { useDesktopPaneLayout } from '@/features/desktop-pane-layout'
import { useSimpleBackButton } from '@/processes/navigation'
import { ensurePublicNotesReady } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'
import PaneSplitter from '@/shared/ui/pane-splitter'
import FolderBrowser from '@/widgets/folder-browser'
import NoteDetailPane from '@/widgets/note-detail-pane'
import NoteList from '@/widgets/note-list'

const route = useRoute()
const router = useRouter()
const { isDesktop } = useDeviceType()

// 获取路由参数
const username = computed(() => route.params.username as string)

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/', '返回')

const publicFolders = computed(() => {
  if (!username.value) {
    return []
  }

  return useUserPublicNotes(username.value).getPublicFolderTreeByPUuid()
})

// 页面状态
const loading = ref(true)
const error = ref('')
const userInfo = ref<PublicUserInfo | null>(null)
const presentingElement = ref()
const page = ref()
let desktopResizeObserver: ResizeObserver | null = null
const desktopContainerWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth)
const desktopPaneLayout = useDesktopPaneLayout(desktopContainerWidth)
const desktopLayoutStyle = computed<CSSProperties | undefined>(() => isDesktop.value
  ? {
      '--public-navigation-width': `${desktopPaneLayout.navigationWidth.value}px`,
      '--public-note-list-width': `${desktopPaneLayout.noteListWidth.value}px`,
    } as CSSProperties
  : undefined)

// 状态管理
const state = reactive({
  folderUuid: '',
  noteUuid: '',
})

const expandedStateKey = computed(() => `home:public:${username.value}`)

function resolveRouteFolderId() {
  const pathMatch = route.params.pathMatch
  if (!pathMatch) {
    return ''
  }

  const segments = Array.isArray(pathMatch) ? pathMatch : pathMatch.split('/')
  return segments[segments.length - 1] || ''
}

function syncDesktopSelectionFromRoute() {
  if (!isDesktop.value || !username.value) {
    return
  }

  const noteId = route.params.noteId as string | undefined
  if (noteId) {
    const targetNote = useUserPublicNotes(username.value).getPublicNote(noteId)
    state.noteUuid = noteId
    state.folderUuid = targetNote?.parent_id || 'allnotes'
    return
  }

  state.folderUuid = resolveRouteFolderId()
  state.noteUuid = ''
}

function selectFolder(id: string) {
  state.folderUuid = id
  state.noteUuid = ''
  void router.push(`/${encodeURIComponent(username.value)}/f/${id}`)
}

function selectNote(id: string) {
  state.noteUuid = id
  void router.push(`/${encodeURIComponent(username.value)}/n/${id}`)
}

// 初始化数据
async function init(force = false) {
  if (!username.value) {
    error.value = '无效的用户名'
    loading.value = false
    return
  }

  try {
    loading.value = true
    error.value = ''

    const result = await ensurePublicNotesReady(username.value, { force })
    userInfo.value = result.userInfo
    syncDesktopSelectionFromRoute()
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
  await init(true)
  ev.detail.complete()
}

onIonViewWillEnter(() => {
  presentingElement.value = page.value?.$el || page.value
  void init()
})

onMounted(() => {
  void init()

  if (!isDesktop.value || typeof ResizeObserver === 'undefined') {
    return
  }

  const pageElement = (page.value?.$el || page.value) as HTMLElement | undefined
  if (!pageElement) {
    return
  }

  desktopResizeObserver = new ResizeObserver(([entry]) => {
    desktopContainerWidth.value = entry?.contentRect.width || window.innerWidth
  })
  desktopResizeObserver.observe(pageElement)
})

onUnmounted(() => {
  desktopResizeObserver?.disconnect()
  desktopResizeObserver = null
})

watch(
  () => route.fullPath,
  () => syncDesktopSelectionFromRoute(),
)
</script>

<template>
  <IonPage ref="page" :class="{ 'public-note-desktop': isDesktop }" :style="desktopLayoutStyle">
    <div id="public-navigation-pane" class="public-navigation">
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
          <NoteList
            :note-uuid="state.folderUuid"
            :data-list="publicFolders"
            :expanded-state-key="expandedStateKey"
            :presenting-element="presentingElement"
            :disabled-route="isDesktop"
            @refresh="init"
            @selected="selectFolder"
          />

          <div v-if="publicFolders.length === 0" class="empty-state">
            <IonIcon :icon="folderOutline" size="large" />
            <h2>暂无公开文件夹</h2>
            <p>该用户还没有公开任何文件夹</p>
          </div>
        </div>
      </IonContent>
    </div>

    <PaneSplitter
      v-if="isDesktop"
      v-model="desktopPaneLayout.navigationWidth.value"
      controls="public-navigation-pane public-note-list-pane"
      label="调整公开文件夹导航栏宽度"
      :min="desktopPaneLayout.navigationMin"
      :max="desktopPaneLayout.navigationMax.value"
      @reset="desktopPaneLayout.resetNavigationWidth"
      @resize-end="desktopPaneLayout.persist"
    />
    <div v-if="isDesktop" id="public-note-list-pane" class="home-list">
      <FolderBrowser
        :current-folder="state.folderUuid"
        :selected-note-id="state.noteUuid"
        @selected="selectNote"
      />
    </div>
    <PaneSplitter
      v-if="isDesktop"
      v-model="desktopPaneLayout.noteListWidth.value"
      controls="public-note-list-pane public-note-detail-pane"
      label="调整公开备忘录列表栏宽度"
      :min="desktopPaneLayout.noteListMin"
      :max="desktopPaneLayout.noteListMax.value"
      @reset="desktopPaneLayout.resetNoteListWidth"
      @resize-end="desktopPaneLayout.persist"
    />
    <div v-if="isDesktop" id="public-note-detail-pane" class="home-detail">
      <NoteDetailPane :note-id="state.noteUuid" />
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

.public-navigation {
  position: relative;
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.public-note-desktop {
  display: grid;
  width: 100%;
  grid-template-columns:
    minmax(0, var(--public-navigation-width, 361px))
    1px
    minmax(0, var(--public-note-list-width, 361px))
    1px
    minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}

.public-note-desktop .public-navigation,
.public-note-desktop .home-list,
.public-note-desktop .home-detail {
  position: relative;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}
</style>
