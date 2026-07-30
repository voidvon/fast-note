<script setup lang="ts">
import type { AlertButton } from '@ionic/vue'
import type { FolderTreeNode, Note } from '@/shared/types'
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter,
  onIonViewWillEnter,
} from '@ionic/vue'
import { addOutline, createOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { useNote } from '@/entities/note'
import { useUserPublicNotes } from '@/entities/public-note'
import { useFolderBackButton, useRouteStateRestore } from '@/processes/navigation'
import { loadPublicFolderNotes } from '@/processes/public-notes'
import { getTime } from '@/shared/lib/date'
import { useDeviceType } from '@/shared/lib/device'
import { useIonContentScrollMemory } from '@/shared/lib/ionic'
import { NOTE_TYPE } from '@/shared/types'
import NoteList from '@/widgets/note-list'

const props = withDefaults(
  defineProps<{
    currentFolder?: string
    selectedNoteId?: string
  }>(),
  {
    currentFolder: undefined,
    selectedNoteId: undefined,
  },
)

defineEmits(['selected', 'createNote'])

const route = useRoute()
const { notes, addNote, getNote, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()

const data = ref<Note>({} as Note)
const contentRef = ref()
const showAddFolderAlert = ref(false)
const publicPage = ref(0)
const publicTotalPages = ref(0)
const publicPageLoading = ref(false)
let loadedPublicFolderId = ''

const routeUsername = computed(() => route.params.username as string)
const activeMobileFolderPath = ref('')
const activeMobileFolderId = ref('')
const activeMobileUsername = ref('')

const username = computed(() => {
  if (isDesktop.value)
    return routeUsername.value

  return activeMobileUsername.value
})
const isUserContext = computed(() => !!username.value)

function isFolderRoutePath(path: string) {
  return /^\/f\/.+$/.test(path) || /^\/[^/]+\/f\/.+$/.test(path)
}

function resolveFolderIdFromCurrentRoute() {
  if (route.params.pathMatch) {
    const pathMatch = Array.isArray(route.params.pathMatch)
      ? route.params.pathMatch.join('/')
      : route.params.pathMatch
    const segments = pathMatch.split('/')
    return segments[segments.length - 1]
  }

  const segments = route.path.split('/')
  return segments[segments.length - 1]
}

function syncActiveMobileFolderRoute() {
  const currentPath = route.fullPath || route.path
  if (isDesktop.value || !isFolderRoutePath(currentPath))
    return false

  activeMobileFolderPath.value = currentPath
  activeMobileFolderId.value = resolveFolderIdFromCurrentRoute()
  activeMobileUsername.value = routeUsername.value || ''
  return true
}

const folderId = computed(() => {
  // 桌面端：使用 props.currentFolder
  if (isDesktop.value && props.currentFolder) {
    return props.currentFolder
  }

  return activeMobileFolderId.value
})

// 将 folderList 和 noteList 改为计算属性，自动响应 notes 变化
const folderList = computed(() => {
  if (!folderId.value)
    return []

  if (isUserContext.value) {
    return useUserPublicNotes(username.value).getPublicFolderTreeByPUuid(folderId.value)
  }

  if (folderId.value === 'allnotes' || folderId.value === 'unfilednotes') {
    return []
  }

  return getFolderTreeByParentId(folderId.value)
})

const noteList = computed(() => {
  if (!folderId.value)
    return []

  const sourceNotes = isUserContext.value
    ? (useUserPublicNotes(username.value).publicNotes.value ?? [])
    : notes.value

  if (folderId.value === 'allnotes') {
    const allNotes = sourceNotes.filter(d => d.item_type === NOTE_TYPE.NOTE && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
    const allFolders = sourceNotes.filter(d => d.item_type === NOTE_TYPE.FOLDER && d.is_deleted === 0)
    const folderMap = new Map(allFolders.map(folder => [folder.id, folder]))

    allNotes.forEach((note) => {
      if (note.originNote.parent_id) {
        const parentFolder = folderMap.get(note.originNote.parent_id)
        note.folderName = parentFolder ? parentFolder.title : '备忘录'
      }
      else {
        note.folderName = '备忘录'
      }
    })
    return allNotes
  }
  else if (folderId.value === 'unfilednotes') {
    return sourceNotes.filter(d => d.item_type === NOTE_TYPE.NOTE && !d.parent_id && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
  }
  else {
    return sourceNotes.filter(d => d.item_type === NOTE_TYPE.NOTE && d.parent_id === folderId.value && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
  }
})

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
        updated: isoTime,
        item_type: NOTE_TYPE.FOLDER,
        parent_id: folderId.value,
        id: nanoid(12),
        version: 1,
        content: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
      })
      init()
    },
  },
] as const

const isTopFolder = computed(() => {
  const path = isDesktop.value ? route.path : activeMobileFolderPath.value
  const lastId = path.split('/')
  lastId.pop()
  return !/^\d+$/.test(lastId[lastId.length - 1])
})

const folders = computed(() => {
  return folderList.value.toSorted((a, b) => {
    return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
  })
})

const sortedNoteList = computed(() => {
  return noteList.value.toSorted((a, b) => {
    return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
  })
})

const hasChildItems = computed(() => {
  return folders.value.length > 0 || sortedNoteList.value.length > 0
})
const hasMorePublicNotes = computed(() => (
  isUserContext.value
  && publicPage.value < publicTotalPages.value
))

const title = computed(() => {
  switch (data.value.id) {
    case 'allnotes':
      return '全部备忘录'
    case 'unfilednotes':
      return '备忘录'
    default:
      return data.value.title
  }
})

const expandedStateKey = computed(() => {
  const context = isUserContext.value ? `public:${username.value}` : 'private'
  return `folder:${context}:${folderId.value}`
})
const scrollMemoryKey = computed(() => {
  const context = isUserContext.value ? `public:${username.value}` : 'private'
  const path = isDesktop.value ? (route.fullPath || route.path) : activeMobileFolderPath.value
  return `${context}:${path}`
})
const { saveScrollPosition, restoreScrollPosition, scrollToTop } = useIonContentScrollMemory(
  contentRef,
  () => scrollMemoryKey.value,
)
const { resolveFolderEnterMode, shouldSaveFolderLeave } = useRouteStateRestore()

// 智能返回按钮
const { backButtonProps } = useFolderBackButton(
  route,
  () => isTopFolder.value,
  username.value,
)

// 桌面端：监听 props.currentFolder 变化
watch(
  () => props.currentFolder,
  () => {
    if (isDesktop.value && props.currentFolder) {
      init()
    }
  },
  { immediate: true },
)

// 移动端：监听路由变化和组件挂载
watch(
  () => route.path,
  () => {
    if (!isDesktop.value && syncActiveMobileFolderRoute()) {
      init()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (!isDesktop.value) {
    syncActiveMobileFolderRoute()
    init()
  }
})

async function init() {
  if (!isDesktop.value && !syncActiveMobileFolderRoute() && !activeMobileFolderId.value)
    return

  const id = folderId.value

  if (!id)
    return

  try {
    if (isUserContext.value) {
      const { getPublicNote } = useUserPublicNotes(username.value)
      const folderInfo = getPublicNote(id)
      if (folderInfo) {
        data.value = folderInfo
      }
      await loadPublicPage(id !== loadedPublicFolderId)
    }
    else {
      // 当前用户的文件夹上下文
      if (id === 'allnotes') {
        data.value = { id: 'allnotes' } as Note
      }
      else if (id === 'unfilednotes') {
        data.value = { id: 'unfilednotes' } as Note
      }
      else {
        const res = await getNote(id)
        if (res) {
          data.value = res
        }
      }
    }
  }
  catch (error) {
    console.error('初始化文件夹数据失败:', error)
  }
}

async function loadPublicPage(reset = false) {
  if (!isUserContext.value || !folderId.value || publicPageLoading.value) {
    return
  }

  publicPageLoading.value = true
  try {
    const nextPage = reset ? 1 : publicPage.value + 1
    const result = await loadPublicFolderNotes(username.value, folderId.value, nextPage)
    loadedPublicFolderId = folderId.value
    publicPage.value = result.page
    publicTotalPages.value = result.totalPages
  }
  catch (error) {
    console.error('加载公开备忘录列表失败:', error)
  }
  finally {
    publicPageLoading.value = false
  }
}

async function loadMorePublicNotes(event: CustomEvent) {
  await loadPublicPage()
  const target = event.target as HTMLIonInfiniteScrollElement | null
  await target?.complete()
}

onIonViewWillEnter(() => {
  if (!isDesktop.value && syncActiveMobileFolderRoute())
    init()
})

onIonViewDidEnter(() => {
  if (!isDesktop.value) {
    if (resolveFolderEnterMode(scrollMemoryKey.value) === 'restore') {
      void restoreScrollPosition()
    }
    else {
      void scrollToTop()
    }
  }
})

onBeforeRouteLeave(async (to, from) => {
  if (isDesktop.value)
    return

  const toPath = to.fullPath || to.path
  const fromPath = from.fullPath || from.path
  if (shouldSaveFolderLeave(fromPath, toPath)) {
    await saveScrollPosition()
  }
})

// 暴露 refresh 方法给父组件
defineExpose({
  refresh: init,
})
</script>

<template>
  <IonPage>
    <IonHeader v-if="!isDesktop" :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" text="返回" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent
      ref="contentRef"
      class="folder-page-content"
      :fullscreen="true"
    >
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ title }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <div class="folder-page-content__body">
        <div v-if="publicPageLoading && !hasChildItems" class="folder-loading-state">
          <IonSpinner name="crescent" />
        </div>
        <NoteList
          v-else-if="hasChildItems"
          :data-list="[...folders, ...sortedNoteList]"
          :note-uuid="selectedNoteId"
          :show-parent-folder="data.id === 'allnotes'"
          :expanded-state-key="expandedStateKey"
          @selected="$emit('selected', $event)"
        />

        <div v-else class="folder-empty-state">
          无备忘录
        </div>
      </div>
      <IonInfiniteScroll
        v-if="isUserContext"
        :disabled="!hasMorePublicNotes || publicPageLoading"
        threshold="100px"
        @ion-infinite="loadMorePublicNotes"
      >
        <IonInfiniteScrollContent loading-spinner="crescent" />
      </IonInfiniteScroll>
    </IonContent>
    <IonFooter v-if="!isDesktop">
      <IonToolbar>
        <IonButtons v-if="data.id !== 'allnotes' && !isUserContext" slot="start">
          <IonButton @click="showAddFolderAlert = true">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </IonTitle>
        <IonButtons v-if="data.id !== 'allnotes' && !isUserContext" slot="end">
          <IonButton :router-link="`/n/0?parent_id=${folderId}`" router-direction="forward">
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonFooter>
    <IonFooter v-else-if="isDesktop && data.id !== 'allnotes' && !isUserContext">
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton @click="showAddFolderAlert = true">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </IonTitle>
        <IonButtons slot="end">
          <IonButton @click="$emit('createNote', folderId)">
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonFooter>
    <IonAlert
      :is-open="showAddFolderAlert"
      :keyboard-close="false"
      header="请输入文件夹名称"
      :buttons="addButtons"
      :inputs="[{ name: 'newFolderName', placeholder: '请输入文件夹名称' }]"
      @did-present="focusFolderAlertInput"
      @did-dismiss="showAddFolderAlert = false"
    />
  </IonPage>
</template>

<style lang="scss">
.folder-page-content::part(scroll) {
  display: flex;
  flex-direction: column;
}

.folder-page-content__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.folder-empty-state,
.folder-loading-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.folder-empty-state {
  color: var(--ion-color-medium);
  font-size: 16px;
  text-align: center;
}
</style>
