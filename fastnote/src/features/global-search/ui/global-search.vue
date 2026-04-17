<script setup lang="ts">
import type { Note } from '@/entities/note'
import type { AiChatRequestContext } from '@/features/ai-chat/model/request-context'
import type { ChatMessageCardAction } from '@/shared/ui/chat-message'
import { IonContent, IonIcon, IonTextarea } from '@ionic/vue'
import { useDebounceFn } from '@vueuse/core'
import { arrowUpOutline, closeCircle, closeOutline, searchOutline, sparklesOutline, stop } from 'ionicons/icons'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NOTE_TYPE, useNote } from '@/entities/note'
import { toAiChatContextNote } from '@/features/ai-chat/model/request-context'
import { resolveAiChatTarget } from '@/features/ai-chat/model/target-resolution'
import AiChatPanel, { useAiChat } from '@/features/ai-chat'
import { useDesktopActiveNote } from '@/processes/navigation/model/use-desktop-active-note'
import { cleanupIonicOverlayLocks } from '@/shared/lib/ionic'
import NoteList from '@/widgets/note-list'
import { toSearchResultNodes } from '../lib/search-results'
import {
  getGlobalSearchOverlayMode,
  hasGlobalSearchOverlay,
  shouldUseRouteBackForGlobalSearchClose,
  withGlobalSearchHistoryState,
  withGlobalSearchOverlay,
  withoutGlobalSearchOverlay,
} from '../model/search-route'
import { useGlobalSearch } from '../model/use-global-search'

const props = withDefaults(defineProps<{
  puuid?: string | null
  syncWithRoute?: boolean
}>(), {
  puuid: null,
  syncWithRoute: false,
})
const emit = defineEmits<{
  openFolder: [payload: { folderId: string, parentId?: string }]
  openNote: [payload: { isDeleted?: boolean, noteId: string, parentId?: string }]
}>()

const {
  aiDraft,
  inputMode,
  resetGlobalSearch,
  searchKeyword,
  showGlobalSearch,
  showGlobalSearchState,
} = useGlobalSearch()
const noteStore = useNote()
const { getNote, notes } = noteStore
const { chat, currentTask, isBusy: isAiBusy, resumeInterruptedTask, sendMessage: sendAiMessage } = useAiChat()
const { getSnapshot } = useDesktopActiveNote()
const route = useRoute()
const router = useRouter()
const SURFACE_TRANSITION_MS = 320
const CONTENT_TRANSITION_MS = 220
const TEXTAREA_MAX_ROWS = 3

type SearchTextareaEvent = CustomEvent<{
  event?: Event
  value?: string | null
}> & {
  target: HTMLIonTextareaElement
}
type SearchTextareaHost = Pick<HTMLElement, 'blur' | 'focus' | 'style'> & Partial<Pick<HTMLIonTextareaElement, 'setFocus' | 'getInputElement'>>
type SearchTextareaRef = SearchTextareaHost | { $el?: SearchTextareaHost }

const dockRef = ref<HTMLDivElement>()
const inputRef = ref<SearchTextareaRef | null>(null)
const isComposing = ref(false)
const state = reactive({
  notes: [] as Note[],
  panelLeft: 0,
  panelTop: 0,
  panelWidth: 0,
  panelHeight: 0,
  panelBottomInset: 0,
})

let searchRequestId = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null
let enterFrameId: number | null = null

const isSearchMode = computed(() => inputMode.value === 'search')
const currentDraft = computed(() => isSearchMode.value ? searchKeyword.value : aiDraft.value)
const currentFieldIcon = computed(() => isSearchMode.value ? searchOutline : sparklesOutline)
const currentToggleIcon = computed(() => isSearchMode.value ? sparklesOutline : searchOutline)
const currentPlaceholder = computed(() => isSearchMode.value ? '搜索' : '发消息')
const currentToggleLabel = computed(() => isSearchMode.value ? '切换到 AI 对话' : '切换到全局搜索')
const currentEnterKeyHint = computed(() => isSearchMode.value ? 'search' : 'send')
const currentInputMode = computed(() => isSearchMode.value ? 'search' : 'text')
const currentActionIcon = computed(() => isAiBusy.value ? stop : arrowUpOutline)
const currentActionLabel = computed(() => isAiBusy.value ? '停止生成' : '发送消息')
const searchResults = computed(() => toSearchResultNodes(state.notes))
const hasInputValue = computed(() => currentDraft.value.trim().length > 0)
const hasSearchKeyword = computed(() => searchKeyword.value.trim().length > 0)
const showAiActionButton = computed(() => !isSearchMode.value && (hasInputValue.value || isAiBusy.value))
const shouldShowCloseButton = computed(() => isSearchMode.value || !showAiActionButton.value)
const shouldCollapseFieldIcon = computed(() => showGlobalSearchState.value !== 'hide')
const shouldRenderPanel = computed(() => showGlobalSearchState.value !== 'hide')
const shouldSyncWithRoute = computed(() => props.syncWithRoute)
const hasRouteSearchOverlay = computed(() => shouldSyncWithRoute.value && hasGlobalSearchOverlay(route.query))
const routeOverlayMode = computed(() => hasRouteSearchOverlay.value ? getGlobalSearchOverlayMode(route.query) : 'search')
const panelCaption = computed(() => {
  if (!isSearchMode.value) {
    return 'AI 对话'
  }

  return hasSearchKeyword.value ? '搜索结果' : '搜索'
})
const panelIdleMessage = computed(() => {
  return isSearchMode.value
    ? '输入标题或内容关键词搜索备忘录'
    : '输入消息开始与 AI 对话'
})
const panelStyle = computed(() => ({
  left: `${state.panelLeft}px`,
  top: `${state.panelTop}px`,
  width: `${state.panelWidth}px`,
  height: `${state.panelHeight}px`,
  minHeight: `${state.panelHeight}px`,
  '--global-search-panel-bottom-inset': `${state.panelBottomInset}px`,
}))
const recentContextNotes = computed(() => {
  return notes.value
    .filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted === 0)
    .slice()
    .sort((left, right) => new Date(right.updated).getTime() - new Date(left.updated).getTime())
    .slice(0, 5)
    .map(note => toAiChatContextNote(note))
    .filter((note): note is NonNullable<ReturnType<typeof toAiChatContextNote>> => !!note)
})

function resolveCurrentBrowserRoutePath() {
  if (typeof window === 'undefined') {
    return route.path
  }

  const pathname = window.location.pathname || route.path || '/home'
  const normalizedPath = pathname === '/' ? '/home' : pathname
  return `${normalizedPath}${window.location.search || ''}`
}

function resolveRouteNoteId() {
  const routeNoteId = Array.isArray(route.params?.id)
    ? route.params.id[0]
    : route.params?.id

  return typeof routeNoteId === 'string' && routeNoteId !== '0'
    ? routeNoteId
    : ''
}

function resolveFolderContextTitle(folderId: string) {
  switch (folderId) {
    case 'allnotes':
      return '全部备忘录'
    case 'unfilednotes':
      return '未归档备忘录'
    case 'deleted':
      return '已删除'
    default:
      return getNote(folderId)?.title || ''
  }
}

function isSpecialFolderId(folderId: string) {
  return ['allnotes', 'unfilednotes', 'deleted'].includes(folderId)
}

function resolveContextFolder(folderId: string) {
  const title = resolveFolderContextTitle(folderId)
  if (!folderId || !title) {
    return null
  }

  return {
    id: folderId,
    title,
    kind: isSpecialFolderId(folderId) ? 'special' as const : 'folder' as const,
  }
}

function resolveResolvedFolder(folderId: string, fallbackTitle: string, fallbackKind: 'folder' | 'special') {
  if (!folderId) {
    return null
  }

  const resolved = resolveContextFolder(folderId)
  if (resolved) {
    return resolved
  }

  return {
    id: folderId,
    title: fallbackTitle,
    kind: fallbackKind,
  }
}

const baseAiRequestContext = computed<AiChatRequestContext>(() => {
  const routeNoteId = resolveRouteNoteId()
  const desktopSnapshot = getSnapshot()
  const activeNoteId = routeNoteId || desktopSnapshot?.noteId || ''
  const activeFolderId = desktopSnapshot?.folderId || ''

  return {
    source: 'home_global_search',
    routePath: resolveCurrentBrowserRoutePath(),
    publicUserId: props.puuid || null,
    activeFolder: resolveContextFolder(activeFolderId),
    activeNote: toAiChatContextNote(activeNoteId ? getNote(activeNoteId) : null),
    candidateNotes: state.notes
      .slice(0, 5)
      .map(note => toAiChatContextNote(note))
      .filter((note): note is NonNullable<ReturnType<typeof toAiChatContextNote>> => !!note),
    recentNotes: recentContextNotes.value,
  }
})

function createAiRequestContext(input: string): AiChatRequestContext {
  const context = baseAiRequestContext.value
  const resolvedTarget = resolveAiChatTarget(input, context)
  if (!resolvedTarget) {
    return context
  }

  return {
    ...context,
    resolvedTarget: {
      source: resolvedTarget.source,
      note: resolvedTarget.note?.id
        ? (toAiChatContextNote(getNote(resolvedTarget.note.id)) || resolvedTarget.note)
        : null,
      folder: resolvedTarget.folder?.id
        ? resolveResolvedFolder(resolvedTarget.folder.id, resolvedTarget.folder.title, resolvedTarget.folder.kind)
        : null,
    },
  }
}

if (!hasRouteSearchOverlay.value) {
  resetGlobalSearch()
}

function activateSearch(options: { syncRoute?: boolean } = {}) {
  const { syncRoute = true } = options

  cleanupIonicOverlayLocks()

  if (showGlobalSearch.value && showGlobalSearchState.value !== 'hide') {
    updateLayout()
    if (syncRoute) {
      void syncSearchRoute()
    }
    return
  }

  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (enterFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(enterFrameId)
    enterFrameId = null
  }

  showGlobalSearch.value = true
  showGlobalSearchState.value = 'enterStart'
  void nextTick(() => {
    updateLayout()

    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(() => {
        showGlobalSearchState.value = 'enterActive'
      }, 16)
      return
    }

    requestAnimationFrame(() => {
      enterFrameId = requestAnimationFrame(() => {
        enterFrameId = null
        showGlobalSearchState.value = 'enterActive'
      })
    })
  })

  if (syncRoute) {
    void syncSearchRoute()
  }
}

function resolveInputHost() {
  const input = inputRef.value
  if (!input) {
    return null
  }

  return ('$el' in input && input.$el
    ? input.$el
    : input) as SearchTextareaHost
}

function focusResolvedInput() {
  const input = resolveInputHost()
  if (!input) {
    return
  }

  if (typeof input.setFocus === 'function') {
    void input.setFocus()
    return
  }

  input.focus()
}

function blurResolvedInput() {
  resolveInputHost()?.blur()
}

function scheduleLayoutUpdate() {
  if (typeof requestAnimationFrame === 'undefined') {
    updateLayout()
    return
  }

  requestAnimationFrame(() => {
    updateLayout()
  })
}

function focusInput() {
  void nextTick(() => {
    focusResolvedInput()
  })
}

async function syncInputTextareaMaxHeight() {
  const inputHost = resolveInputHost()
  if (!inputHost) {
    return
  }

  const nativeInput = typeof inputHost.getInputElement === 'function'
    ? await inputHost.getInputElement()
    : inputHost instanceof HTMLTextAreaElement
      ? inputHost
      : null

  if (!nativeInput) {
    return
  }

  const styles = window.getComputedStyle(nativeInput)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const maxHeight = Math.ceil(lineHeight * TEXTAREA_MAX_ROWS + paddingTop + paddingBottom)

  inputHost.style.maxHeight = `${maxHeight}px`
  nativeInput.style.maxHeight = `${maxHeight}px`
  nativeInput.style.overflowY = nativeInput.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function syncInputHeightLimits() {
  void nextTick(async () => {
    await syncInputTextareaMaxHeight()
    scheduleLayoutUpdate()
  })
}

function resolvePanelContainer() {
  const desktopSidebar = dockRef.value?.closest('.note-desktop') as HTMLElement | null
  if (desktopSidebar) {
    return desktopSidebar
  }

  return dockRef.value?.closest('.ion-page, ion-page') as HTMLElement | null
}

function updateLayout() {
  const containerRect = resolvePanelContainer()?.getBoundingClientRect()
  const dockRect = dockRef.value?.getBoundingClientRect()
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0

  if (!containerRect) {
    state.panelLeft = 0
    state.panelTop = 0
    state.panelWidth = viewportWidth
    state.panelHeight = viewportHeight
    state.panelBottomInset = dockRect
      ? Math.max(0, viewportHeight - dockRect.top)
      : 0
    return
  }

  state.panelLeft = containerRect.left
  state.panelTop = containerRect.top
  state.panelWidth = containerRect.width
  state.panelHeight = Math.max(0, containerRect.height)
  state.panelBottomInset = dockRect
    ? Math.max(0, containerRect.bottom - Math.min(dockRect.top, containerRect.bottom))
    : 0
}

async function runSearch(searchText: string) {
  const requestId = ++searchRequestId
  const keyword = searchText.trim()

  if (!keyword) {
    state.notes = []
    return
  }

  const matchedNotes = typeof noteStore.searchNotes === 'function'
    ? await noteStore.searchNotes(keyword, {
        parentId: props.puuid || '',
        rootTitle: '全部',
      })
    : await noteStore.searchNotesByParentId?.(props.puuid || '', '全部', keyword) || []

  if (requestId !== searchRequestId) {
    return
  }

  state.notes = matchedNotes
}

const debouncedSearch = useDebounceFn(runSearch, 300)

function handleCompositionStart() {
  isComposing.value = true
}

function applySearchKeyword(value: string) {
  searchKeyword.value = value

  if (!value.trim()) {
    state.notes = []
    return
  }

  activateSearch()
}

function handleCompositionEnd(event: CompositionEvent) {
  isComposing.value = false
  const value = (
    event.target as HTMLIonTextareaElement | HTMLTextAreaElement | null
  )?.value || ''
  if (!isSearchMode.value) {
    aiDraft.value = value
    activateSearch()
    syncInputHeightLimits()
    return
  }

  applySearchKeyword(value)
  void runSearch(value)
  syncInputHeightLimits()
}

function onFocus() {
  activateSearch()
}

async function submitAiDraft() {
  const draft = aiDraft.value
  if (!draft.trim()) {
    activateSearch()
    focusInput()
    return
  }

  aiDraft.value = ''

  const submitted = await sendAiMessage(draft, {
    requestContext: createAiRequestContext(draft),
  })
  if (!submitted) {
    aiDraft.value = draft
  }

  activateSearch()
  focusInput()
}

function startCloseAnimation() {
  blurResolvedInput()
  searchRequestId++
  showGlobalSearchState.value = 'leaveStart'

  hideTimer = setTimeout(() => {
    hideTimer = null
    state.notes = []
    resetGlobalSearch()
  }, Math.max(SURFACE_TRANSITION_MS, CONTENT_TRANSITION_MS))
}

async function syncSearchRoute() {
  if (!shouldSyncWithRoute.value) {
    return
  }

  if (hasGlobalSearchOverlay(route.query) && getGlobalSearchOverlayMode(route.query) === inputMode.value) {
    return
  }

  await router.push({
    path: route.path,
    query: withGlobalSearchOverlay(route.query, inputMode.value),
    hash: route.hash,
    state: withGlobalSearchHistoryState(window.history.state),
  })
}

async function syncSearchCloseToRoute() {
  if (!shouldSyncWithRoute.value || !hasGlobalSearchOverlay(route.query)) {
    startCloseAnimation()
    return
  }

  blurResolvedInput()
  searchRequestId++

  if (shouldUseRouteBackForGlobalSearchClose(window.history.state)) {
    router.back()
    return
  }

  await router.replace({
    path: route.path,
    query: withoutGlobalSearchOverlay(route.query),
    hash: route.hash,
  })
}

function onCancel() {
  void syncSearchCloseToRoute()
}

function onInput(event: SearchTextareaEvent) {
  const value = event.detail.value || ''
  const nativeEvent = event.detail.event

  syncInputHeightLimits()

  if (
    isComposing.value
    || (typeof InputEvent !== 'undefined' && nativeEvent instanceof InputEvent && nativeEvent.isComposing)
  ) {
    return
  }

  if (!isSearchMode.value) {
    aiDraft.value = value
    activateSearch()
    return
  }

  applySearchKeyword(value)
  void debouncedSearch(value)
}

function onClear() {
  searchRequestId++
  state.notes = []
  if (isSearchMode.value) {
    searchKeyword.value = ''
    activateSearch()
  }
  else {
    aiDraft.value = ''
    activateSearch()
  }
  syncInputHeightLimits()
  focusInput()
}

async function onAiAction() {
  if (isAiBusy.value) {
    await chat.stop()
    focusInput()
    return
  }

  await submitAiDraft()
}

function onKeydown(event: KeyboardEvent) {
  if (isSearchMode.value || event.key !== 'Enter' || isComposing.value) {
    return
  }

  if (!event.metaKey && !event.ctrlKey) {
    return
  }

  event.preventDefault()
  void onAiAction()
}

function handleAiPrefill(value: string) {
  aiDraft.value = value
  activateSearch()
  syncInputHeightLimits()
  focusInput()
}

async function handleResumeTask() {
  const resumed = await resumeInterruptedTask({
    requestContext: createAiRequestContext(currentTask.value?.input || ''),
  })

  if (!resumed) {
    return
  }

  activateSearch()
  focusInput()
}

function closeSearchImmediately() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  searchRequestId++
  state.notes = []
  resetGlobalSearch()
}

function handleAiAction(action: ChatMessageCardAction) {
  closeSearchImmediately()

  if (action.type === 'open-note') {
    emit('openNote', {
      isDeleted: action.isDeleted,
      noteId: action.noteId,
      parentId: action.parentId,
    })
    return
  }

  emit('openFolder', {
    folderId: action.folderId,
    parentId: action.parentId,
  })
}

async function toggleInputMode() {
  inputMode.value = isSearchMode.value ? 'ai' : 'search'
  searchRequestId++

  if (isSearchMode.value) {
    activateSearch()
    if (searchKeyword.value.trim()) {
      await runSearch(searchKeyword.value)
    }
    else {
      state.notes = []
    }
  }
  else {
    state.notes = []
    activateSearch()
  }

  focusInput()
}

function handleViewportChange() {
  if (!showGlobalSearch.value) {
    return
  }

  updateLayout()
}

watch(hasRouteSearchOverlay, (visible, previousVisible) => {
  if (visible) {
    inputMode.value = routeOverlayMode.value
    activateSearch({ syncRoute: false })

    if (!previousVisible && inputMode.value === 'search' && searchKeyword.value.trim()) {
      void runSearch(searchKeyword.value)
    }
    return
  }

  if (previousVisible && isSearchMode.value && (showGlobalSearch.value || showGlobalSearchState.value !== 'hide')) {
    startCloseAnimation()
  }
}, { immediate: true })

watch(routeOverlayMode, (mode) => {
  if (!hasRouteSearchOverlay.value || inputMode.value === mode) {
    return
  }

  inputMode.value = mode
})

watch(currentDraft, () => {
  syncInputHeightLimits()
})

watch(isSearchMode, () => {
  syncInputHeightLimits()
})

onMounted(() => {
  updateLayout()
  syncInputHeightLimits()
  window.addEventListener('resize', handleViewportChange)
})

onUnmounted(() => {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (enterFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(enterFrameId)
    enterFrameId = null
  }

  window.removeEventListener('resize', handleViewportChange)
})
</script>

<template>
  <div ref="dockRef" class="global-search">
    <div class="global-search__dock">
      <div
        v-if="!showGlobalSearch"
        class="global-search__slot-button"
      >
        <slot name="leading" :panel-visible="showGlobalSearch" />
      </div>

      <button
        v-if="showGlobalSearch"
        type="button"
        class="app-glass-circle-button"
        :aria-label="currentToggleLabel"
        @pointerdown.prevent
        @click="toggleInputMode"
      >
        <IonIcon :icon="currentToggleIcon" />
      </button>

      <div class="global-search__field">
        <div
          :class="{ 'global-search__field-shell--panel-visible': shouldCollapseFieldIcon }"
          class="global-search__field-shell"
        >
          <IonIcon
            :icon="currentFieldIcon"
            class="global-search__search-icon"
          />
          <IonTextarea
            ref="inputRef"
            :value="currentDraft"
            auto-grow
            :inputmode="currentInputMode"
            :enterkeyhint="currentEnterKeyHint"
            autocomplete="off"
            :placeholder="currentPlaceholder"
            :rows="1"
            :spellcheck="false"
            class="global-search__input"
            @ionFocus="onFocus"
            @ionInput="onInput"
            @keydown="onKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          />
          <button
            v-if="isSearchMode && hasInputValue"
            type="button"
            class="global-search__clear-button"
            aria-label="清空搜索"
            @click="onClear"
          >
            <IonIcon :icon="closeCircle" />
          </button>
        </div>
      </div>

      <button
        v-if="showGlobalSearch && shouldShowCloseButton"
        type="button"
        class="app-glass-circle-button"
        aria-label="关闭搜索"
        @click="onCancel"
      >
        <IonIcon :icon="closeOutline" />
      </button>
      <button
        v-else-if="showGlobalSearch && showAiActionButton"
        type="button"
        class="app-glass-circle-button"
        :aria-label="currentActionLabel"
        @click="onAiAction"
      >
        <IonIcon :icon="currentActionIcon" />
      </button>

      <div
        v-if="!showGlobalSearch"
        class="global-search__slot-button"
      >
        <slot name="trailing" :panel-visible="showGlobalSearch" />
      </div>
    </div>

    <div
      v-if="shouldRenderPanel"
      :style="panelStyle"
      class="global-search__panel"
    >
      <div
        :class="{ 'global-search__panel-surface--active': showGlobalSearchState === 'enterActive' }"
        class="global-search__panel-surface"
      >
        <div
          :class="{ 'global-search__panel-body--active': showGlobalSearchState === 'enterActive' }"
          class="global-search__panel-body"
        >
          <div v-if="isSearchMode" class="global-search__panel-header">
            <p class="global-search__panel-caption">
              {{ panelCaption }}
            </p>
            <p v-if="hasSearchKeyword" class="global-search__panel-meta">
              共 {{ state.notes.length }} 条结果
            </p>
          </div>

          <IonContent v-if="isSearchMode" class="global-search__panel-content">
            <template v-if="hasSearchKeyword && state.notes.length > 0">
              <NoteList
                :data-list="searchResults"
                :all-notes-count="state.notes.length"
                show-parent-folder
              />
            </template>
            <div v-else-if="isSearchMode && hasSearchKeyword" class="global-search__empty">
              没有找到相关备忘录
            </div>
            <div v-else class="global-search__empty global-search__empty--idle">
              {{ panelIdleMessage }}
            </div>
            <div class="h-4" />
          </IonContent>

          <AiChatPanel
            v-else
            class="global-search__ai-panel"
            @action="handleAiAction"
            @prefill="handleAiPrefill"
            @resume-task="handleResumeTask"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.global-search {
  display: flex;
  align-items: flex-end;
  min-height: 44px;
  padding: 0;
  position: relative;
  z-index: 1002;

  &__dock {
    display: flex;
    align-items: flex-end;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    position: relative;
    z-index: 2;
  }

  &__slot-button {
    display: contents;
  }

  &__field {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: flex-end;
  }

  &__field-shell {
    display: flex;
    align-items: center;
    width: 100%;
    min-width: 0;
    gap: 8px;
    height: auto;
    min-height: 44px;
    padding: 6px 12px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0.08)), rgba(20, 20, 24, 0.12);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 12px 30px rgba(0, 0, 0, 0.14);
    overflow: hidden;
    transition:
      height 180ms ease,
      gap 180ms ease,
      border-radius 180ms ease,
      box-shadow 180ms ease;
    backdrop-filter: blur(28px) saturate(180%);
    -webkit-backdrop-filter: blur(28px) saturate(180%);
  }

  &__field-shell--panel-visible {
    gap: 0;
  }

  &__search-icon {
    width: 16px;
    min-width: 16px;
    flex: 0 0 16px;
    font-size: 16px;
    color: #d1d1d6;
    opacity: 1;
    transform: translateX(0) scale(1);
    transform-origin: left center;
    transition:
      opacity 160ms ease,
      transform 180ms ease,
      width 160ms ease,
      min-width 160ms ease,
      margin 160ms ease,
      flex-basis 160ms ease;
  }

  &__field-shell--panel-visible &__search-icon {
    width: 0;
    min-width: 0;
    margin: 0;
    opacity: 0;
    overflow: hidden;
    flex-basis: 0;
    transform: translateX(-6px) scale(0.84);
  }

  &__input {
    --background: transparent;
    --color: #f5f5f7;
    --padding-top: 5px;
    --padding-bottom: 5px;
    --padding-start: 0;
    --padding-end: 0;
    --placeholder-color: #8e8e93;
    flex: 1;
    min-width: 0;
    min-height: 32px;
    max-height: calc(22px * 3 + 10px);
    font-size: 16px;
    line-height: 22px;
    transition: min-height 180ms ease;
  }

  &__clear-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    flex: 0 0 18px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #8e8e93;
  }

  &__clear-button ion-icon {
    font-size: 18px;
  }

  &__panel {
    position: fixed;
    z-index: 1;
    padding: 0;
    overflow: hidden;
    pointer-events: auto;
  }

  &__panel-surface {
    position: relative;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: 0;
    isolation: isolate;
    background: transparent;
    border: 0;
    box-shadow: none;
    max-height: none;
  }

  &__panel-surface::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background: rgba(10, 10, 12, 0.08);
    backdrop-filter: blur(0) saturate(100%);
    -webkit-backdrop-filter: blur(0) saturate(100%);
    transition:
      background-color 320ms ease,
      backdrop-filter 320ms ease,
      -webkit-backdrop-filter 320ms ease;
  }

  &__panel-surface--active::before {
    background: rgba(10, 10, 12, 0.38);
    backdrop-filter: blur(26px) saturate(150%);
    -webkit-backdrop-filter: blur(26px) saturate(150%);
  }

  &__panel-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: max(20px, env(safe-area-inset-top)) 16px 12px;
  }

  &__panel-caption {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #8e8e93;
  }

  &__panel-meta {
    margin: 0;
    font-size: 13px;
    color: #8e8e93;
  }

  &__panel-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
    padding-bottom: var(--global-search-panel-bottom-inset, 0px);
    overflow: hidden;
    opacity: 0;
    transition: opacity 220ms ease;
  }

  &__panel-body--active {
    opacity: 1;
  }

  &__panel-content {
    flex: 1;
    min-height: 0;
    --background: transparent;
    --padding-bottom: 0px;
  }

  &__ai-panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &__empty {
    padding: 24px 16px 12px;
    color: #8e8e93;
    line-height: 1.5;
  }

  &__empty--idle {
    padding-top: 8px;
  }
}
</style>
