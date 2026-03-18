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
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
// import ExtensionButton from '@/shared/ui/extension-button'
// import ExtensionManager from '@/features/extension-manager'
import { useNote } from '@/entities/note'
import { useExtensions } from '@/features/extension-manager'
import GlobalSearch, { useGlobalSearch } from '@/features/global-search'
import DarkModeToggle from '@/features/theme-switch'
import DeletedPage from '@/pages/deleted/ui/deleted-page.vue'
import FolderPage from '@/pages/folder/ui/folder-page.vue'
import NoteDetail from '@/pages/note-detail/ui/note-detail-page.vue'
import {
  getDesktopNotesForFolder,
  isDesktopFolderAvailable,
  resolveDesktopActiveNoteSelection,
  useDesktopActiveNote,
} from '@/processes/navigation'
import { useAuth } from '@/processes/session'
import { useDeviceType } from '@/shared/lib/device'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'
import ExtensionRenderer from '@/widgets/extension-renderer'
import NoteList from '@/widgets/note-list'
import UserProfile from '@/widgets/user-profile'

const { notes, addNote, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()
const { currentUser } = useAuth()
const { showGlobalSearch } = useGlobalSearch()
const { isExtensionEnabled, getExtensionModule } = useExtensions()
const { getSnapshot, saveSnapshot, clearSnapshot } = useDesktopActiveNote()
const currentUserId = computed(() => currentUser.value?.id || null)

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
const hasAttemptedDesktopRestore = ref(false)
const isRestoringDesktopSelection = ref(false)

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
const deletedNotes = computed(() => {
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ')
  return notes.value.filter(note => note.is_deleted === 1 && note.updated >= thirtyDaysAgo)
})
const presentingElement = ref()
function focusFolderAlertInput(event: CustomEvent) {
  const alert = event.target as HTMLElement | null

  window.setTimeout(() => {
    const input = alert?.querySelector('input.alert-input') as HTMLInputElement | null
    if (!input) {
      return
    }

    input.focus()
    const end = input.value.length
    input.setSelectionRange(end, end)
  }, 50)
}

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
  folerId: isDesktop.value ? 'allnotes' : '', // 桌面端默认选中全部备忘录
  noteId: '',
  parentId: '', // 新建笔记时的父文件夹ID
})

const isDeletedFolder = computed(() => state.folerId === 'deleted')
const showDesktopEmptyDetailOverlay = computed(() => isDesktop.value && !state.noteId)

const sortDataList = computed(() => {
  return dataList.value
    .toSorted((a: FolderTreeNode, b: FolderTreeNode) => {
      return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
    })
})

function getSortedNotesForFolder(folderId: string): Note[] {
  return getDesktopNotesForFolder(folderId, notes.value, deletedNotes.value)
}

function getDefaultNoteId(folderId: string) {
  if (!isDesktop.value) {
    return ''
  }

  if (folderId !== 'allnotes' && folderId !== 'deleted') {
    return ''
  }

  return getSortedNotesForFolder(folderId)[0]?.id || ''
}

function persistDesktopSelection(noteId = state.noteId) {
  if (!isDesktop.value || !noteId || noteId === '0') {
    return
  }

  saveSnapshot({
    folderId: state.folerId,
    noteId,
    parentId: state.parentId,
  }, currentUserId.value)
}

function restoreDesktopSelection() {
  if (!isDesktop.value) {
    return false
  }

  const selection = resolveDesktopActiveNoteSelection(
    getSnapshot(currentUserId.value),
    notes.value,
    deletedNotes.value,
  )

  if (!selection) {
    clearSnapshot(currentUserId.value)
    return false
  }

  isRestoringDesktopSelection.value = true
  state.folerId = selection.folderId
  state.noteId = selection.noteId
  state.parentId = selection.parentId

  void nextTick(() => {
    isRestoringDesktopSelection.value = false
  })

  if (selection.noteId) {
    saveSnapshot(selection, currentUserId.value)
  }
  else {
    clearSnapshot(currentUserId.value)
  }

  return true
}

// 监听目录切换，清除选中的备忘录
watch(() => state.folerId, () => {
  if (!isDesktop.value || isRestoringDesktopSelection.value) {
    return
  }

  state.noteId = ''
  state.parentId = ''
  clearSnapshot(currentUserId.value)
  init()
})

watch(() => state.noteId, (noteId) => {
  if (!isDesktop.value || isRestoringDesktopSelection.value) {
    return
  }

  if (noteId === '0') {
    clearSnapshot(currentUserId.value)
    return
  }

  if (noteId) {
    persistDesktopSelection(noteId)
  }
})

watch(currentUserId, (nextUserId, previousUserId) => {
  if (!isDesktop.value || nextUserId === previousUserId) {
    return
  }

  void resetDesktopSelectionForUserScope()
})

function hasCurrentDesktopNoteSelection() {
  if (!state.noteId || state.noteId === '0') {
    return false
  }

  return getSortedNotesForFolder(state.folerId).some(note => note.id === state.noteId)
}

async function resetDesktopSelectionForUserScope() {
  if (!isDesktop.value) {
    return
  }

  isRestoringDesktopSelection.value = true
  hasAttemptedDesktopRestore.value = false
  state.folerId = 'allnotes'
  state.noteId = ''
  state.parentId = ''

  await nextTick()
  isRestoringDesktopSelection.value = false
  await init({ preferPersistedSelection: true })
}

async function refresh(ev: CustomEvent) {
  await init()
  ev.detail.complete()
}

async function init(options: { preferPersistedSelection?: boolean } = {}) {
  if (options.preferPersistedSelection && !hasAttemptedDesktopRestore.value) {
    hasAttemptedDesktopRestore.value = true
    if (restoreDesktopSelection()) {
      return
    }
  }

  if (isDesktop.value && !isDesktopFolderAvailable(state.folerId, notes.value, deletedNotes.value)) {
    state.folerId = 'allnotes'
  }

  if (isDesktop.value && !hasCurrentDesktopNoteSelection()) {
    state.noteId = ''
    state.parentId = ''
  }

  if (isDesktop.value && !state.noteId) {
    const defaultNoteId = getDefaultNoteId(state.folerId)
    if (defaultNoteId) {
      state.noteId = defaultNoteId
    }
  }
}

function handleFolderSelected(id: string) {
  state.folerId = id
}

function handleNoteSelected(id: string) {
  state.parentId = ''
  state.noteId = id
}

function handleCreateNote(parentId = '') {
  state.parentId = parentId
  state.noteId = '0'
  clearSnapshot(currentUserId.value)
}

onIonViewWillEnter(() => {
  init({ preferPersistedSelection: true })
})

onMounted(() => {
  presentingElement.value = page.value.$el
  init({ preferPersistedSelection: true })
})

function handleNoteSaved(event: { noteId: string, isNew: boolean }) {
  state.noteId = event.noteId

  // 如果是新建的笔记，选中它并刷新列表
  if (event.isNew && folderPageRef.value) {
    folderPageRef.value.refresh()
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
        expanded-state-key="home:private"
        :presenting-element="presentingElement"
        :disabled-route="isDesktop"
        show-all-notes
        show-unfiled-notes
        show-delete
        @refresh="init"
        @selected="handleFolderSelected"
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
            @click="handleCreateNote()"
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
      :keyboard-close="false"
      header="请输入文件夹名称"
      :buttons="addButtons"
      :inputs="[{ name: 'newFolderName', placeholder: '请输入文件夹名称' }]"
      @did-present="focusFolderAlertInput"
    />

    <!-- 扩展管理器 -->
    <!-- <ExtensionManager
      v-model:is-open="showExtensionManager"
      :presenting-element="presentingElement"
    /> -->
    <div v-if="isDesktop" class="home-list">
      <DeletedPage
        v-if="isDeletedFolder"
        :selected-note-id="state.noteId"
        @selected="handleNoteSelected"
      />
      <FolderPage
        v-else
        ref="folderPageRef"
        :current-folder="state.folerId"
        :selected-note-id="state.noteId"
        @selected="handleNoteSelected"
        @create-note="handleCreateNote"
      />
    </div>
    <div v-if="isDesktop" class="home-detail">
      <NoteDetail
        :note-id="state.noteId"
        :parent-id="state.parentId"
        @note-saved="handleNoteSaved"
      />
      <button
        v-if="showDesktopEmptyDetailOverlay"
        type="button"
        class="home-detail-empty"
        data-testid="home-empty-detail-create"
        @click="handleCreateNote()"
      >
        <IonIcon :icon="createOutline" class="home-detail-empty__icon" />
        <div class="home-detail-empty__title">
          点击开始新建备忘录
        </div>
        <div class="home-detail-empty__desc">
          将直接进入编辑并聚焦正文
        </div>
      </button>
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
.home-detail-empty {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.04));
  color: #8e8e93;
  cursor: text;
  text-align: center;
}

.home-detail-empty:hover {
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.06));
}

.home-detail-empty__icon {
  font-size: 28px;
  color: var(--ion-color-primary, #007aff);
}

.home-detail-empty__title {
  font-size: 16px;
  font-weight: 600;
  color: #f2f2f7;
}

.home-detail-empty__desc {
  font-size: 13px;
}
</style>
