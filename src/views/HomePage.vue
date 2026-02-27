<script setup lang="ts">
import type {
  AlertButton,
} from '@ionic/vue'
import type { FolderTreeNode, Note } from '@/types'
import {
  IonAlert,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue'
import { addOutline, createOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import DarkModeToggle from '@/components/DarkModeToggle.vue'
// import ExtensionButton from '@/components/ExtensionButton.vue'
// import ExtensionManager from '@/components/ExtensionManager.vue'
import ExtensionRenderer from '@/components/ExtensionRenderer.vue'
import GlobalSearch from '@/components/GlobalSearch/GlobalSearch.vue'
import { useGlobalSearch } from '@/components/GlobalSearch/useGlobalSearch'
import NoteList from '@/components/NoteList.vue'
import UserProfile from '@/components/UserProfile.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useExtensions } from '@/hooks/useExtensions'
import { useNote } from '@/stores'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'
import { errorHandler, ErrorType, withErrorHandling } from '@/utils/errorHandler'
import FolderPage from './FolderPage.vue'
import NoteDetail from './NoteDetail.vue'

const { notes, addNote, onUpdateNote, getDeletedNotes, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()
const { showGlobalSearch } = useGlobalSearch()
const { isExtensionEnabled, getExtensionModule } = useExtensions()

// 扩展管理器状态
// const showExtensionManager = ref(false)

// 动态获取同步扩展的钩子函数
let unSub: (() => void) | undefined

// 监听同步扩展的加载状态
watch(() => isExtensionEnabled('sync'), async (enabled) => {
  if (enabled) {
    // 如果同步扩展已启用，动态获取其钩子函数
    const syncModule = getExtensionModule('sync')
    if (syncModule && syncModule.useSync) {
      const { onSynced } = syncModule.useSync()
      unSub = onSynced(() => {
        init()
      })
    }
  }
  else if (unSub) {
    // 如果同步扩展被禁用，取消订阅
    unSub()
    unSub = undefined
  }
}, { immediate: true })

// 在组件卸载时取消订阅
onUnmounted(() => {
  if (unSub) {
    unSub()
  }
})

const page = ref()
const folderPageRef = ref()

// 将 dataList 改为计算属性，自动响应 notes 的变化
const dataList = computed(() => {
  const treeData = getFolderTreeByParentId()
  return treeData && treeData.length > 0 ? treeData : []
})
// 使用单个计算属性同时计算两个值，只遍历一次数组
const noteCounts = computed(() => {
  const counts = notes.value.reduce((acc, note) => {
    if (note.item_type === NOTE_TYPE.NOTE && note.is_deleted === 0) {
      acc.all++
      if (!note.parent_id) {
        acc.unfiled++
      }
    }
    return acc
  }, { all: 0, unfiled: 0 })

  return counts
})

// 从计算属性中提取各个计数值
const allNotesCount = computed(() => noteCounts.value.all)
const unfiledNotesCount = computed(() => noteCounts.value.unfiled)
const deletedNotes = ref<Note[]>([])
const presentingElement = ref()
const addButtons: AlertButton[] = [
  { text: '取消', role: 'cancel' },
  {
    text: '确认',
    handler: async (d) => {
      const isoTime = getTime()
      await addNote({
        title: d.newFolderName,
        created: getTime(),
        content: '',
        updated: isoTime,
        item_type: NOTE_TYPE.FOLDER,
        parent_id: '',
        id: nanoid(12),
        note_count: 0,
        is_deleted: 0,
        is_locked: 0,
      })
      init()
    },
  },
]
const state = reactive({
  windowWidth: 0,
  folerId: isDesktop.value ? 'allnotes' : '', // 桌面端默认选中全部备忘录
  noteId: '',
  parentId: '', // 新建笔记时的父文件夹ID
})

const sortDataList = computed(() => {
  return dataList.value
    .toSorted((a: FolderTreeNode, b: FolderTreeNode) => {
      return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
    })
})

// 监听目录切换，清除选中的备忘录
watch(() => state.folerId, () => {
  if (isDesktop.value) {
    state.noteId = ''
  }
})

async function refresh(ev: CustomEvent) {
  await init()
  ev.detail.complete()
}

async function init() {
  // dataList 现在是计算属性，会自动更新，无需手动赋值

  // 获取已删除的备忘录
  const { data: deletedData, error: deletedError } = await withErrorHandling(
    () => getDeletedNotes(),
    ErrorType.DATABASE,
  )

  if (deletedError) {
    console.error('获取已删除笔记失败:', errorHandler.getUserFriendlyMessage(deletedError))
  }
  else if (deletedData) {
    deletedNotes.value = deletedData
  }

  // 桌面端初始化时，如果选中了全部备忘录且没有选中笔记，自动选择第一条笔记
  if (isDesktop.value && state.folerId === 'allnotes' && !state.noteId) {
    const allNotes = notes.value
      .filter(d => d.item_type === NOTE_TYPE.NOTE && d.is_deleted === 0)
      .sort((a, b) => new Date(b.updated!).getTime() - new Date(a.updated!).getTime())
    
    if (allNotes.length > 0) {
      state.noteId = allNotes[0].id!
    }
  }
}

onUpdateNote((item) => {
  if (item.parent_id === null) {
    init()
  }
})

onIonViewWillEnter(() => {
  init()
})

onMounted(() => {
  presentingElement.value = page.value.$el
})

function handleNoteSaved(event: { noteId: string, isNew: boolean }) {
  // 如果是新建的笔记，选中它并刷新列表
  if (event.isNew) {
    state.noteId = event.noteId
    // 只在新建笔记时刷新列表，确保新笔记被正确显示和选中
    if (folderPageRef.value) {
      folderPageRef.value.refresh()
    }
  }
  // 更新笔记时不需要刷新列表，因为 notes store 是响应式的，列表会自动更新
}
</script>

<template>
  <IonPage ref="page" :class="{ 'note-desktop': isDesktop }">
    <Transition name="header-slide">
      <IonHeader v-if="!showGlobalSearch" :translucent="true">
        <IonToolbar />
      </IonHeader>
    </Transition>

    <IonContent :fullscreen="true">
      <IonRefresher v-if="!showGlobalSearch" slot="fixed" @ion-refresh="refresh($event)">
        <IonRefresherContent />
      </IonRefresher>

      <IonHeader collapse="condense">
        <IonToolbar>
          <Transition name="header-slide">
            <IonTitle v-if="!showGlobalSearch" size="large">
              备忘录
            </IonTitle>
          </Transition>
        </IonToolbar>
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0 16px;">
          <div class="flex items-center">
            <!-- 使用扩展渲染器动态渲染同步组件 -->
            <ExtensionRenderer
              extension-id="sync"
              component-name="SyncState"
              :component-props="{}"
            />
            <!-- 用户信息组件 - 核心组件 -->
            <UserProfile />
          </div>
          <div class="flex items-center">
            <!-- <ExtensionButton @click="showExtensionManager = true" /> -->
            <DarkModeToggle />
          </div>
        </div>
      </IonHeader>

      <GlobalSearch />

      <NoteList
        :note-uuid="state.folerId"
        :data-list="sortDataList"
        :all-notes-count
        :unfiled-notes-count
        :deleted-note-count="deletedNotes.length"
        :presenting-element="presentingElement"
        :disabled-route="isDesktop"
        show-all-notes
        show-unfiled-notes
        show-delete
        @refresh="init"
        @selected="(id: string) => state.folerId = id"
      />
    </IonContent>
    <IonFooter>
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton id="add-folder">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle />
        <IonButtons slot="end">
          <IonButton
            v-if="isDesktop"
            @click="() => {
              state.parentId = ''
              state.noteId = '0'
            }"
          >
            <IonIcon :icon="createOutline" />
          </IonButton>
          <IonButton
            v-else
            router-link="/n/0"
            router-direction="forward"
          >
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonFooter>
    <IonAlert
      trigger="add-folder"
      header="请输入文件夹名称"
      :buttons="addButtons"
      :inputs="[{ name: 'newFolderName', placeholder: '请输入文件夹名称' }]"
    />

    <!-- 扩展管理器 -->
    <!-- <ExtensionManager
      v-model:is-open="showExtensionManager"
      :presenting-element="presentingElement"
    /> -->
    <div v-if="isDesktop" class="home-list">
      <FolderPage
        ref="folderPageRef"
        :current-folder="state.folerId"
        :selected-note-id="state.noteId"
        @selected="(id: string) => state.noteId = id"
        @create-note="(parentId: string) => {
          state.parentId = parentId
          state.noteId = '0'
        }"
      />
    </div>
    <div v-if="isDesktop" class="home-detail">
      <NoteDetail 
        :note-id="state.noteId" 
        :parent-id="state.parentId"
        @note-saved="handleNoteSaved"
      />
    </div>
  </IonPage>
</template>

<style lang="scss">
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
/* 进入和离开动画的激活状态 */
.header-slide-enter-active,
.header-slide-leave-active {
  transition:
    max-height 0.3s ease-in-out,
    opacity 0.3s ease-in-out;
  overflow: hidden; /* 非常重要！确保内容在折叠时被裁剪 */
}

/* 进入动画的起始状态 和 离开动画的结束状态 */
.header-slide-enter-from,
.header-slide-leave-to {
  max-height: 0;
  opacity: 0;
}

/* 进入动画的结束状态 和 离开动画的起始状态 */
.header-slide-enter-to,
.header-slide-leave-from {
  /*
    设置一个足够大的 max-height 值，使其能容纳 header 的所有内容。
    一个标准的 ion-toolbar 大约是 56px。
    如果你的 header 内容更多（例如，多个 toolbar，大标题模式），请增大此值。
    例如: 100px, 150px, 或根据你的 header 实际最大高度调整。
  */
  max-height: 150px; /* 示例值，请根据你的 header 内容调整 */
  opacity: 1;
}
</style>
