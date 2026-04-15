<script setup lang="ts">
import type { Note } from '@/entities/note'
import { IonContent, IonIcon } from '@ionic/vue'
import { useDebounceFn } from '@vueuse/core'
import { arrowUpOutline, closeCircle, closeOutline, searchOutline, sparklesOutline, stopCircleOutline } from 'ionicons/icons'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useNote } from '@/entities/note'
import AiChatPanel, { useAiChat } from '@/features/ai-chat'
import { cleanupIonicOverlayLocks } from '@/shared/lib/ionic'
import NoteList from '@/widgets/note-list'
import { toSearchResultNodes } from '../lib/search-results'
import {
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

const {
  aiDraft,
  inputMode,
  resetGlobalSearch,
  searchKeyword,
  showGlobalSearch,
  showGlobalSearchState,
} = useGlobalSearch()
const { searchNotesByParentId } = useNote()
const { chat, isBusy: isAiBusy, sendMessage: sendAiMessage } = useAiChat()
const route = useRoute()
const router = useRouter()
const SURFACE_TRANSITION_MS = 320
const CONTENT_TRANSITION_MS = 220
const TEXTAREA_MAX_ROWS = 3
const FIELD_SHELL_MIN_HEIGHT = 44
const FIELD_SHELL_VERTICAL_PADDING = 12
const FIELD_SHELL_BORDER_WIDTH = 2

const dockRef = ref<HTMLDivElement>()
const fieldShellRef = ref<HTMLDivElement>()
const inputRef = ref<HTMLTextAreaElement>()
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
const currentActionIcon = computed(() => isAiBusy.value ? stopCircleOutline : arrowUpOutline)
const currentActionLabel = computed(() => isAiBusy.value ? '停止生成' : '发送消息')
const searchResults = computed(() => toSearchResultNodes(state.notes))
const hasInputValue = computed(() => currentDraft.value.trim().length > 0)
const hasSearchKeyword = computed(() => searchKeyword.value.trim().length > 0)
const showAiActionButton = computed(() => !isSearchMode.value && (hasInputValue.value || isAiBusy.value))
const shouldCollapseFieldIcon = computed(() => showGlobalSearchState.value !== 'hide')
const shouldRenderPanel = computed(() => showGlobalSearchState.value !== 'hide')
const shouldSyncWithRoute = computed(() => props.syncWithRoute)
const hasRouteSearchOverlay = computed(() => shouldSyncWithRoute.value && hasGlobalSearchOverlay(route.query))
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

  if (syncRoute && isSearchMode.value) {
    void syncSearchRoute()
  }
}

function focusInput() {
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function syncInputHeight() {
  const textarea = inputRef.value
  if (!textarea) {
    return
  }

  const shell = fieldShellRef.value
  const previousInputHeight = textarea.getBoundingClientRect().height || 32
  const previousShellHeight = shell?.getBoundingClientRect().height || FIELD_SHELL_MIN_HEIGHT

  textarea.style.height = 'auto'

  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0
  const borderTop = Number.parseFloat(styles.borderTopWidth) || 0
  const borderBottom = Number.parseFloat(styles.borderBottomWidth) || 0
  const maxHeight = lineHeight * TEXTAREA_MAX_ROWS + paddingTop + paddingBottom + borderTop + borderBottom
  const nextHeight = Math.min(textarea.scrollHeight, maxHeight)
  const nextShellHeight = Math.max(
    FIELD_SHELL_MIN_HEIGHT,
    Math.ceil(nextHeight + FIELD_SHELL_VERTICAL_PADDING + FIELD_SHELL_BORDER_WIDTH),
  )

  textarea.style.height = `${previousInputHeight}px`
  if (shell) {
    shell.style.height = `${previousShellHeight}px`
  }

  // Force a layout read so the browser can animate between concrete heights.
  void textarea.offsetHeight

  textarea.style.height = `${nextHeight}px`
  if (shell) {
    shell.style.height = `${nextShellHeight}px`
  }
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'

  if (typeof requestAnimationFrame === 'undefined') {
    updateLayout()
    return
  }

  requestAnimationFrame(() => {
    updateLayout()
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

  const matchedNotes = await searchNotesByParentId(props.puuid || '', '全部', keyword)

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
  const value = (event.target as HTMLTextAreaElement | null)?.value || ''
  if (!isSearchMode.value) {
    aiDraft.value = value
    activateSearch({ syncRoute: false })
    void nextTick(syncInputHeight)
    return
  }

  applySearchKeyword(value)
  void runSearch(value)
  void nextTick(syncInputHeight)
}

function onFocus() {
  activateSearch({ syncRoute: isSearchMode.value })
}

async function submitAiDraft() {
  const draft = aiDraft.value
  if (!draft.trim()) {
    activateSearch({ syncRoute: false })
    focusInput()
    return
  }

  aiDraft.value = ''

  const submitted = await sendAiMessage(draft)
  if (!submitted) {
    aiDraft.value = draft
  }

  activateSearch({ syncRoute: false })
  focusInput()
}

function startCloseAnimation() {
  inputRef.value?.blur()
  searchRequestId++
  showGlobalSearchState.value = 'leaveStart'

  hideTimer = setTimeout(() => {
    hideTimer = null
    state.notes = []
    resetGlobalSearch()
  }, Math.max(SURFACE_TRANSITION_MS, CONTENT_TRANSITION_MS))
}

async function syncSearchRoute() {
  if (!shouldSyncWithRoute.value || hasGlobalSearchOverlay(route.query)) {
    return
  }

  await router.push({
    path: route.path,
    query: withGlobalSearchOverlay(route.query),
    hash: route.hash,
    state: withGlobalSearchHistoryState(window.history.state),
  })
}

async function clearSearchRouteOverlay() {
  if (!shouldSyncWithRoute.value || !hasGlobalSearchOverlay(route.query)) {
    return
  }

  await router.replace({
    path: route.path,
    query: withoutGlobalSearchOverlay(route.query),
    hash: route.hash,
  })
}

async function syncSearchCloseToRoute() {
  if (!shouldSyncWithRoute.value || !hasGlobalSearchOverlay(route.query)) {
    startCloseAnimation()
    return
  }

  inputRef.value?.blur()
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

function onInput(event: Event) {
  const target = event.target as HTMLTextAreaElement | null
  const value = target?.value || ''

  syncInputHeight()

  if (
    isComposing.value
    || (typeof InputEvent !== 'undefined' && event instanceof InputEvent && event.isComposing)
  ) {
    return
  }

  if (!isSearchMode.value) {
    aiDraft.value = value
    activateSearch({ syncRoute: false })
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
    activateSearch({ syncRoute: false })
  }
  void nextTick(syncInputHeight)
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
  activateSearch({ syncRoute: false })
  void nextTick(syncInputHeight)
  focusInput()
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
    await clearSearchRouteOverlay()
    activateSearch({ syncRoute: false })
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
    inputMode.value = 'search'
    activateSearch({ syncRoute: false })

    if (!previousVisible && searchKeyword.value.trim()) {
      void runSearch(searchKeyword.value)
    }
    return
  }

  if (previousVisible && isSearchMode.value && (showGlobalSearch.value || showGlobalSearchState.value !== 'hide')) {
    startCloseAnimation()
  }
}, { immediate: true })

watch(currentDraft, () => {
  void nextTick(syncInputHeight)
})

watch(isSearchMode, () => {
  void nextTick(syncInputHeight)
})

onMounted(() => {
  updateLayout()
  syncInputHeight()
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
          ref="fieldShellRef"
          :class="{ 'global-search__field-shell--panel-visible': shouldCollapseFieldIcon }"
          class="global-search__field-shell"
        >
          <IonIcon
            :icon="currentFieldIcon"
            class="global-search__search-icon"
          />
          <textarea
            ref="inputRef"
            :value="currentDraft"
            :inputmode="currentInputMode"
            :enterkeyhint="currentEnterKeyHint"
            autocomplete="off"
            :placeholder="currentPlaceholder"
            rows="1"
            spellcheck="false"
            class="global-search__input"
            @focus="onFocus"
            @input="onInput"
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
          <button
            v-else-if="showAiActionButton"
            type="button"
            class="global-search__submit-button"
            :aria-label="currentActionLabel"
            @click="onAiAction"
          >
            <IonIcon :icon="currentActionIcon" />
          </button>
        </div>
      </div>

      <button
        v-if="showGlobalSearch"
        type="button"
        class="app-glass-circle-button"
        aria-label="关闭搜索"
        @click="onCancel"
      >
        <IonIcon :icon="closeOutline" />
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
            @prefill="handleAiPrefill"
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
    height: 44px;
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
    flex: 1;
    min-width: 0;
    height: 32px;
    min-height: 32px;
    max-height: calc(22px * 3 + 12px);
    border: 0;
    padding: 5px 0;
    background: transparent;
    color: #f5f5f7;
    font-size: 16px;
    line-height: 22px;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
    resize: none;
    overflow-y: hidden;
    field-sizing: content;
    transition: height 180ms ease;
  }

  &__input::placeholder {
    color: #8e8e93;
  }

  &__input::-webkit-scrollbar {
    width: 4px;
  }

  &__input::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.2);
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

  &__submit-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex: 0 0 24px;
    border: 0;
    border-radius: 999px;
    padding: 0;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.96), rgba(34, 197, 94, 0.96));
    color: #04111f;
  }

  &__submit-button ion-icon {
    font-size: 14px;
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
