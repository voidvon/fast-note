<script setup lang="ts">
import type { FolderTreeNode, Note } from '@/shared/types'
import { nanoid } from 'nanoid'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useNote } from '@/entities/note'
import { useUserPublicNotes } from '@/entities/public-note'
import { promptFolderName } from '@/features/note-write'
import { useFolderBackButton, useRouteStateRestore } from '@/processes/navigation'
import { loadPublicFolderNotes } from '@/processes/public-notes'
import { getTime } from '@/shared/lib/date'
import { useDeviceType } from '@/shared/lib/device'
import { useAppRoute, useAppRouter, usePageScrollMemory } from '@/shared/lib/framework7'
import { NOTE_TYPE } from '@/shared/types'
import {
  F7BackButton,
  F7Button,
  F7Buttons,
  F7Content,
  F7Footer,
  F7Header,
  F7Icon,
  F7Navbar,
  F7Page,
  F7SkeletonText,
  F7Title,
  F7Toolbar,
  onF7ViewDidEnter,
  onF7ViewWillEnter,
} from '@/shared/ui/f7'
import { addOutline, createOutline } from '@/shared/ui/icons'
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

const route = useAppRoute()
const appRouter = useAppRouter()
const { notes, addNote, getNote, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()

const data = ref<Note>({} as Note)
const contentRef = ref()
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

async function handleAddFolder(name: string) {
  const isoTime = getTime()
  await addNote({
    title: name,
    created: isoTime,
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
}

async function openAddFolderDialog() {
  const name = await promptFolderName()
  if (name === null)
    return

  await handleAddFolder(name)
}

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
      return isUserContext.value
        ? useUserPublicNotes(username.value).getPublicNote(folderId.value)?.title || data.value.title
        : data.value.title
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
const { saveScrollPosition, restoreScrollPosition, scrollToTop } = usePageScrollMemory(
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
      if (id === 'allnotes' || id === 'unfilednotes') {
        data.value = { id } as Note
      }
      else {
        const folderInfo = getPublicNote(id)
        if (folderInfo) {
          data.value = folderInfo
        }
      }
      if (id !== loadedPublicFolderId) {
        await loadPublicPage(true)
      }
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

async function loadMorePublicNotes() {
  await loadPublicPage()
}

onF7ViewWillEnter(() => {
  if (!isDesktop.value && syncActiveMobileFolderRoute())
    init()
})

onF7ViewDidEnter(() => {
  if (!isDesktop.value) {
    if (resolveFolderEnterMode(scrollMemoryKey.value) === 'restore') {
      void restoreScrollPosition()
    }
    else {
      void scrollToTop()
    }
  }
})

const removeRouteAfterEach = appRouter.afterEach(async (to, from) => {
  if (isDesktop.value)
    return

  const toPath = to.fullPath || to.path
  const fromPath = from.fullPath || from.path
  if (shouldSaveFolderLeave(fromPath, toPath)) {
    await saveScrollPosition()
  }
})

onBeforeUnmount(removeRouteAfterEach)

// 暴露 refresh 方法给父组件
defineExpose({
  refresh: init,
})
</script>

<template>
  <F7Page>
    <F7Navbar
      v-if="!isDesktop"
      class="app-navbar folder-navbar"
      :title="title"
      :title-large="title"
      large
    >
      <template #nav-left>
        <F7BackButton v-bind="backButtonProps" text="返回" />
      </template>
    </F7Navbar>

    <F7Content
      ref="contentRef"
      class="folder-page-content"
      :fullscreen="true"
      :infinite="isUserContext && hasMorePublicNotes"
      :infinite-preloader="isUserContext && publicPageLoading"
      :infinite-distance="100"
      @infinite="loadMorePublicNotes"
    >
      <F7Header v-if="isDesktop" collapse="condense">
        <F7Toolbar>
          <F7Title size="large">
            {{ title }}
          </F7Title>
        </F7Toolbar>
      </F7Header>

      <div class="folder-page-content__body">
        <div v-if="publicPageLoading && !hasChildItems" class="folder-loading-state" aria-label="正在加载文件夹">
          <div class="folder-loading-state__row">
            <F7SkeletonText animated class="folder-loading-state__icon" />
            <div class="folder-loading-state__content">
              <F7SkeletonText animated style="width: 72%" />
              <F7SkeletonText animated style="width: 48%" />
            </div>
          </div>
        </div>
        <NoteList
          v-else-if="hasChildItems"
          :data-list="[...folders, ...sortedNoteList]"
          :note-uuid="selectedNoteId"
          :show-parent-folder="data.id === 'allnotes'"
          :expanded-state-key="expandedStateKey"
          media-list
          @selected="$emit('selected', $event)"
        />

        <div v-else class="folder-empty-state">
          无备忘录
        </div>
      </div>
    </F7Content>
    <F7Footer v-if="!isDesktop">
      <F7Toolbar>
        <F7Buttons v-if="data.id !== 'allnotes' && !isUserContext" position="start">
          <F7Button @click="openAddFolderDialog">
            <F7Icon :icon="addOutline" />
          </F7Button>
        </F7Buttons>
        <F7Title>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </F7Title>
        <F7Buttons v-if="data.id !== 'allnotes' && !isUserContext" position="end">
          <F7Button :router-link="`/n/0?parent_id=${folderId}`" router-direction="forward">
            <F7Icon :icon="createOutline" />
          </F7Button>
        </F7Buttons>
      </F7Toolbar>
    </F7Footer>
    <F7Footer v-else-if="isDesktop && data.id !== 'allnotes' && !isUserContext">
      <F7Toolbar>
        <F7Buttons position="start">
          <F7Button @click="openAddFolderDialog">
            <F7Icon :icon="addOutline" />
          </F7Button>
        </F7Buttons>
        <F7Title>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </F7Title>
        <F7Buttons position="end">
          <F7Button @click="$emit('createNote', folderId)">
            <F7Icon :icon="createOutline" />
          </F7Button>
        </F7Buttons>
      </F7Toolbar>
    </F7Footer>
  </F7Page>
</template>

<style lang="scss">
.folder-page-content {
  --background: var(--c-page-background);
}

.folder-page-content::part(scroll) {
  display: flex;
  flex-direction: column;
}

.folder-page-content__body {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.folder-empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.folder-empty-state {
  color: var(--c-text-secondary);
  font-size: 16px;
  text-align: center;
}

.folder-loading-state {
  padding: 8px 16px;
}

.folder-loading-state__row {
  display: grid;
  min-height: 68px;
  align-items: center;
  border-bottom: 1px solid var(--c-border);
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
}

.folder-loading-state__icon {
  width: 32px;
  height: 32px;
  margin: 0;
}

.folder-loading-state__content {
  display: grid;
  gap: 8px;
}

.folder-loading-state__content .skeleton-text {
  height: 14px;
  margin: 0;
}
</style>
