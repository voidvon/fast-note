<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { PublicUserInfo } from '@/shared/types/pocketbase'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useUserPublicNotes } from '@/entities/public-note'
import { useDesktopPaneLayout } from '@/features/desktop-pane-layout'
import { ensurePublicNotesReady, loadPublicNote } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'
import { bindLargeNavbarScroll } from '@/shared/lib/framework7'
import { NOTE_TYPE } from '@/shared/types'
import {
  F7BackButton,
  F7Button,
  F7Icon,
  F7Navbar,
  F7Page,
  F7PageContent,
  F7SkeletonText,
  F7Spinner,
  onF7ViewWillEnter,
  useAppRoute,
  useAppRouter,
} from '@/shared/ui/f7'
import { alertCircleOutline, documentTextOutline } from '@/shared/ui/icons'
import PaneSplitter from '@/shared/ui/pane-splitter'
import FolderBrowser from '@/widgets/folder-browser'
import NoteDetailPane from '@/widgets/note-detail-pane'
import NoteList from '@/widgets/note-list'

const route = useAppRoute()
const appRouter = useAppRouter()
const { isDesktop } = useDeviceType()

// 获取路由参数
const username = computed(() => route.params.username as string)

const publicFolders = computed(() => {
  if (!username.value) {
    return []
  }

  return useUserPublicNotes(username.value).getPublicFolderTreeByPUuid()
})
const publicNotes = computed(() => {
  if (!username.value) {
    return []
  }

  return useUserPublicNotes(username.value).publicNotes.value ?? []
})

// 页面状态
const loading = ref(true)
const error = ref('')
const userInfo = ref<PublicUserInfo | null>(null)
const unfiledNotesCount = ref(0)
const allNotesCount = computed(() => publicNotes.value
  .filter(note => note.item_type === NOTE_TYPE.FOLDER)
  .reduce((count, folder) => count + (folder.note_count || 0), unfiledNotesCount.value))
const presentingElement = ref()
const page = ref()
const publicNavigationPaneRef = ref<HTMLElement>()
const publicNavbarRef = ref()
const publicNoteLoading = ref(false)
const publicNoteError = ref('')
let desktopResizeObserver: ResizeObserver | null = null
let detachPublicLargeNavbarScroll: (() => void) | null = null
let publicNoteRequestVersion = 0
let initializedUsername = ''
let pendingInit: { promise: Promise<void>, username: string } | null = null
const desktopContainerWidth = ref(typeof window === 'undefined' ? 0 : window.innerWidth)
const desktopPaneLayout = useDesktopPaneLayout(desktopContainerWidth)
const showDesktopPanes = computed(() => (
  isDesktop.value
  && !loading.value
  && !error.value
  && Boolean(userInfo.value)
))
const desktopLayoutStyle = computed<CSSProperties | undefined>(() => isDesktop.value
  ? {
      '--public-navigation-width': `${desktopPaneLayout.navigationWidth.value}px`,
      '--public-note-list-width': `${desktopPaneLayout.noteListWidth.value}px`,
    } as CSSProperties
  : undefined)

// 状态管理
const state = reactive({
  folderUuid: isDesktop.value ? 'allnotes' : '',
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
    state.folderUuid = targetNote?.parent_id || 'unfilednotes'
    return
  }

  state.folderUuid = resolveRouteFolderId() || 'allnotes'
  state.noteUuid = ''
}

function syncDefaultDesktopNoteSelection() {
  if (
    !isDesktop.value
    || state.folderUuid !== 'allnotes'
    || state.noteUuid
    || publicNoteLoading.value
  ) {
    return
  }

  const firstNote = publicNotes.value
    .filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted === 0)
    .toSorted((a, b) => (b.updated || '').localeCompare(a.updated || ''))[0]
  if (firstNote?.id) {
    void loadDesktopNoteSelection(firstNote.id)
  }
}

async function syncPublicLargeNavbarScroll() {
  detachPublicLargeNavbarScroll?.()
  detachPublicLargeNavbarScroll = null

  await nextTick()
  const paneElement = publicNavigationPaneRef.value
  const navbarElement = publicNavbarRef.value?.$el as HTMLElement | undefined
  if (paneElement && navbarElement) {
    detachPublicLargeNavbarScroll = bindLargeNavbarScroll(paneElement, navbarElement)
  }
}

function updateDesktopBrowserUrl(targetPath: string) {
  if (typeof window === 'undefined') {
    return
  }

  const currentPath = window.location.pathname + window.location.search + window.location.hash
  if (currentPath === targetPath) {
    return
  }

  window.history.pushState(window.history.state, '', targetPath)
}

function selectFolder(id: string) {
  state.folderUuid = id
  state.noteUuid = ''
  const targetPath = `/${encodeURIComponent(username.value)}/f/${id}`

  if (isDesktop.value) {
    updateDesktopBrowserUrl(targetPath)
    return
  }

  appRouter.push(targetPath)
}

async function selectNote(id: string) {
  const targetPath = `/${encodeURIComponent(username.value)}/n/${id}`

  if (isDesktop.value) {
    updateDesktopBrowserUrl(targetPath)
    await loadDesktopNoteSelection(id)
    return
  }

  appRouter.push(targetPath)
}

async function loadDesktopNoteSelection(id: string) {
  const requestVersion = ++publicNoteRequestVersion
  publicNoteLoading.value = true
  publicNoteError.value = ''

  try {
    const note = await loadPublicNote(username.value, id)
    if (requestVersion !== publicNoteRequestVersion) {
      return
    }

    if (!note) {
      throw new Error('公开备忘录不存在')
    }

    state.noteUuid = id
  }
  catch (err) {
    if (requestVersion !== publicNoteRequestVersion) {
      return
    }

    state.noteUuid = ''
    publicNoteError.value = err instanceof Error ? err.message : '无法加载备忘录'
    console.error('加载公开备忘录详情失败:', err)
  }
  finally {
    if (requestVersion === publicNoteRequestVersion) {
      publicNoteLoading.value = false
    }
  }
}

// 初始化数据
function init(force = false): Promise<void> {
  const currentUsername = username.value
  if (!currentUsername) {
    error.value = '无效的用户名'
    loading.value = false
    return Promise.resolve()
  }

  if (!force && initializedUsername === currentUsername) {
    syncDesktopSelectionFromRoute()
    return Promise.resolve()
  }

  if (!force && pendingInit?.username === currentUsername) {
    return pendingInit.promise
  }

  const promise = (async () => {
    loading.value = true
    error.value = ''

    try {
      const result = await ensurePublicNotesReady(currentUsername, {
        force,
        folderId: isDesktop.value ? (resolveRouteFolderId() || 'allnotes') : undefined,
        noteId: route.params.noteId as string | undefined,
      })
      if (username.value !== currentUsername) {
        return
      }

      if (!result.userInfo) {
        userInfo.value = null
        unfiledNotesCount.value = 0
        state.noteUuid = ''
        initializedUsername = currentUsername
        error.value = '用户不存在'
        return
      }

      userInfo.value = result.userInfo
      unfiledNotesCount.value = result.unfiledNotesCount
      initializedUsername = currentUsername
      syncDesktopSelectionFromRoute()
      syncDefaultDesktopNoteSelection()
    }
    catch (err) {
      if (username.value !== currentUsername) {
        return
      }

      initializedUsername = ''
      error.value = err instanceof Error ? err.message : '加载用户数据失败'
      console.error('加载用户数据失败:', err)
    }
    finally {
      if (username.value === currentUsername) {
        loading.value = false
      }
    }
  })()

  if (!force) {
    pendingInit = { promise, username: currentUsername }
    void promise.finally(() => {
      if (pendingInit?.promise === promise) {
        pendingInit = null
      }
    })
  }

  return promise
}

// 刷新数据
async function refresh(done: () => void) {
  try {
    await init(true)
  }
  finally {
    done()
  }
}

onF7ViewWillEnter(() => {
  presentingElement.value = page.value?.$el || page.value
  void init()
})

onMounted(() => {
  void init()
  void syncPublicLargeNavbarScroll()

  if (typeof ResizeObserver === 'undefined') {
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
  detachPublicLargeNavbarScroll?.()
  detachPublicLargeNavbarScroll = null
  desktopResizeObserver?.disconnect()
  desktopResizeObserver = null
})

watch(isDesktop, () => {
  if (isDesktop.value && !state.folderUuid) {
    state.folderUuid = 'allnotes'
  }
  syncDefaultDesktopNoteSelection()
  void syncPublicLargeNavbarScroll()
}, { flush: 'post' })

watch(publicNotes, syncDefaultDesktopNoteSelection, { deep: true })

watch(
  () => route.fullPath,
  () => syncDesktopSelectionFromRoute(),
)
</script>

<template>
  <F7Page ref="page" :class="{ 'public-note-desktop': isDesktop }" :style="desktopLayoutStyle">
    <div
      id="public-navigation-pane"
      ref="publicNavigationPaneRef"
      class="public-navigation"
    >
      <F7Navbar
        ref="publicNavbarRef"
        class="app-navbar public-navbar"
        :title="userInfo?.username || username"
        :title-large="userInfo?.username || username"
        large
      >
        <template #nav-left>
          <F7BackButton default-href="/home" text="返回" deterministic />
        </template>
      </F7Navbar>

      <F7PageContent
        class="app-content public-navigation-content"
        :ptr="true"
        ptr-preloader
        @ptr:refresh="refresh"
      >
        <div v-if="loading" class="public-home-skeleton" aria-label="正在加载个人中心">
          <div class="public-home-skeleton__row">
            <F7SkeletonText animated class="public-home-skeleton__icon" />
            <div class="public-home-skeleton__content">
              <F7SkeletonText animated style="width: 72%" />
              <F7SkeletonText animated style="width: 48%" />
            </div>
          </div>
        </div>

        <div v-else-if="error" class="error-container">
          <F7Icon :icon="alertCircleOutline" class="public-state-icon" />
          <h2>无法加载用户数据</h2>
          <p>{{ error }}</p>
          <F7Button @click="appRouter.push('/home')">
            返回首页
          </F7Button>
        </div>

        <div v-else>
          <NoteList
            :note-uuid="state.folderUuid"
            :data-list="publicFolders"
            :show-unfiled-notes="unfiledNotesCount > 0"
            :all-notes-count="allNotesCount"
            :unfiled-notes-count="unfiledNotesCount"
            :expanded-state-key="expandedStateKey"
            :presenting-element="presentingElement"
            :disabled-route="true"
            show-all-notes
            @refresh="init"
            @selected="selectFolder"
          />

          <div v-if="publicFolders.length === 0 && unfiledNotesCount === 0" class="empty-state">
            <F7Icon :icon="documentTextOutline" class="public-state-icon" />
            <h2>暂无公开内容</h2>
            <p>该用户还没有公开任何备忘录</p>
          </div>
        </div>
      </F7PageContent>
    </div>

    <PaneSplitter
      v-if="showDesktopPanes"
      v-model="desktopPaneLayout.navigationWidth.value"
      controls="public-navigation-pane public-note-list-pane"
      label="调整公开文件夹导航栏宽度"
      :min="desktopPaneLayout.navigationMin"
      :max="desktopPaneLayout.navigationMax.value"
      @reset="desktopPaneLayout.resetNavigationWidth"
      @resize-end="desktopPaneLayout.persist"
    />
    <div v-if="showDesktopPanes" id="public-note-list-pane" class="home-list">
      <FolderBrowser
        :current-folder="state.folderUuid"
        :selected-note-id="state.noteUuid"
        @selected="selectNote"
      />
    </div>
    <PaneSplitter
      v-if="showDesktopPanes"
      v-model="desktopPaneLayout.noteListWidth.value"
      controls="public-note-list-pane public-note-detail-pane"
      label="调整公开备忘录列表栏宽度"
      :min="desktopPaneLayout.noteListMin"
      :max="desktopPaneLayout.noteListMax.value"
      @reset="desktopPaneLayout.resetNoteListWidth"
      @resize-end="desktopPaneLayout.persist"
    />
    <div v-if="showDesktopPanes" id="public-note-detail-pane" class="home-detail">
      <NoteDetailPane :note-id="state.noteUuid" public-context />
      <div v-if="!state.noteUuid && !publicNoteLoading" class="public-note-detail-empty">
        <F7Icon :icon="documentTextOutline" class="public-state-icon" />
        <div class="public-note-detail-empty__title">
          暂无选中的备忘录
        </div>
        <div class="public-note-detail-empty__desc">
          公开内容将在这里显示
        </div>
      </div>
      <div v-if="publicNoteLoading" class="public-note-detail-state">
        <F7Spinner name="crescent" />
      </div>
      <div v-else-if="publicNoteError" class="public-note-detail-state public-note-detail-state--error">
        <F7Icon :icon="alertCircleOutline" class="public-state-icon" />
        <p>{{ publicNoteError }}</p>
      </div>
    </div>
  </F7Page>
</template>

<style lang="scss">
.error-container,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
  gap: 1rem;
  text-align: center;
  color: var(--c-text-secondary);
}

.public-state-icon {
  width: 24px;
  height: 24px;
  flex: 0 0 24px;
  font-size: 24px;
}

.public-home-skeleton {
  padding: 8px 16px;
}

.public-home-skeleton__row {
  display: grid;
  min-height: 68px;
  align-items: center;
  border-bottom: 1px solid var(--c-border);
  grid-template-columns: 36px minmax(0, 1fr);
  gap: 12px;
}

.public-home-skeleton__icon {
  width: 32px;
  height: 32px;
  margin: 0;
}

.public-home-skeleton__content {
  display: grid;
  gap: 8px;
}

.public-home-skeleton__content .skeleton-text {
  height: 14px;
  margin: 0;
}

.public-navigation {
  --background: var(--c-page-background);
  position: relative;
  display: grid;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  background: var(--background);
}

.public-navigation > .public-navbar,
.public-navigation > .public-navigation-content {
  grid-area: 1 / 1;
}

.public-navigation > .public-navigation-content {
  --f7-page-navbar-offset: calc(
    var(--f7-navbar-height) + var(--f7-navbar-large-title-height) + var(--f7-safe-area-top)
  );
}

.public-navigation > .public-navbar {
  z-index: 20;
  align-self: start;
}

.public-navigation-content {
  --background: var(--c-page-background);
  --f7-list-margin-vertical: 8px;
  --f7-page-toolbar-top-offset: 0px;
  --f7-page-subnavbar-offset: 0px;
  --f7-page-searchbar-offset: 0px;
  --f7-page-content-extra-padding-top: 0px;
  --padding-top: 0px;
  --padding-bottom: 0px;

  height: 100%;
  min-height: 0;
}

.public-note-desktop {
  background: var(--c-page-background);
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

.public-note-detail-state {
  display: flex;
  position: absolute;
  inset: 0;
  z-index: 1;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  background: var(--c-page-background);
  color: var(--c-text-secondary);
}

.public-note-detail-state--error {
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.public-note-detail-empty {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--c-text-secondary);
  text-align: center;
}

.public-note-detail-empty__title {
  color: var(--c-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.public-note-detail-empty__desc {
  font-size: 13px;
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

.public-note-desktop .home-list,
.public-note-desktop .home-detail {
  isolation: isolate;
}
</style>
