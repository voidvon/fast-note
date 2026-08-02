<script setup lang="ts">
import type { MentionEntity } from '../model/mention-types'
import type { Note } from '@/entities/note'
import type { AiChatRequestContext } from '@/features/ai-chat/model/request-context'
import type { ChatMessageCardAction, ChatMessageCardItem } from '@/shared/ui/chat-message'
import type { F7TextareaElement } from '@/shared/ui/f7'
import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { NOTE_TYPE, useNote } from '@/entities/note'
import AiChatPanel, { useAiChat } from '@/features/ai-chat'
import { extractAiChatMentionedTargets } from '@/features/ai-chat/model/mentioned-targets'
import { toAiChatContextNote } from '@/features/ai-chat/model/request-context'
import { resolveAiChatTarget } from '@/features/ai-chat/model/target-resolution'
import { useDesktopActiveNote } from '@/processes/navigation/model/use-desktop-active-note'
import { cleanupOverlayLocks, useAppRoute, useAppRouter } from '@/shared/lib/framework7'
import ChatMessageCardItemView from '@/shared/ui/chat-message/ui/chat-message-card-item.vue'
import { F7Button, F7Content, F7Icon, F7Searchbar, F7Textarea } from '@/shared/ui/f7'
import { arrowUpOutline, closeOutline, searchOutline, sparklesOutline, stop } from '@/shared/ui/icons'
import NoteList from '@/widgets/note-list'
import { isOpenGlobalSearchShortcut } from '../lib/keyboard-shortcuts'
import { toSearchResultNodes } from '../lib/search-results'
import { formatMentionText, toMentionCardItem } from '../model/mention-format'
import { getMentionSuggestions, parseActiveMention } from '../model/mention-suggestions'
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
const { chat, isBusy: isAiBusy, resumeInterruptedTask, sendMessage: sendAiMessage } = useAiChat()
const { getSnapshot } = useDesktopActiveNote()
const route = useAppRoute()
const router = useAppRouter()
const SURFACE_TRANSITION_MS = 320
const CONTENT_TRANSITION_MS = 220
const TEXTAREA_MAX_ROWS = 3

type SearchTextareaEvent = CustomEvent<{
  event?: Event
  value?: string | null
}> & {
  target: F7TextareaElement
}
type SearchInputHost = HTMLElement & Partial<Pick<F7TextareaElement, 'getInputElement' | 'setFocus'>>
type SearchTextareaHost = SearchInputHost
type SearchTextareaRef = SearchTextareaHost | { $el?: SearchTextareaHost }

const dockRef = ref<HTMLDivElement>()
const searchInputRef = ref<SearchTextareaRef | null>(null)
const aiInputRef = ref<SearchTextareaRef | null>(null)
const mentionListRef = ref<HTMLElement | null>(null)
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
let mentionRequestId = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null
let enterFrameId: number | null = null
let panelContainerResizeObserver: ResizeObserver | null = null
let routePageElement: HTMLElement | null = null

const isSearchMode = computed(() => inputMode.value === 'search')
const currentDraft = computed(() => isSearchMode.value ? searchKeyword.value : aiDraft.value)
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
  'left': `${state.panelLeft}px`,
  'top': `${state.panelTop}px`,
  'width': `${state.panelWidth}px`,
  'height': `${state.panelHeight}px`,
  'minHeight': `${state.panelHeight}px`,
  '--global-search-panel-bottom-inset': `${state.panelBottomInset}px`,
}))
const aiSelectionStart = ref(0)
const mentionSuggestions = ref<MentionEntity[]>([])
const activeMentionIndex = ref(0)
const activeMentionRange = ref<{ end: number, start: number } | null>(null)
const recentContextNotes = computed(() => {
  return notes.value
    .filter(note => note.item_type === NOTE_TYPE.NOTE && note.is_deleted === 0)
    .slice()
    .sort((left, right) => new Date(right.updated).getTime() - new Date(left.updated).getTime())
    .slice(0, 5)
    .map(note => toAiChatContextNote(note))
    .filter((note): note is NonNullable<ReturnType<typeof toAiChatContextNote>> => !!note)
})
const showMentionSuggestions = computed(() => !isSearchMode.value && !!activeMentionRange.value)
const mentionSuggestionItems = computed<ChatMessageCardItem[]>(() => {
  return mentionSuggestions.value.map(entity => toMentionCardItem(entity))
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
  const mentionedTargets = extractAiChatMentionedTargets(input, context)
  const resolvedTarget = resolveAiChatTarget(input, context)
  if (!resolvedTarget) {
    return mentionedTargets.length
      ? {
          ...context,
          mentionedTargets,
        }
      : context
  }

  return {
    ...context,
    mentionedTargets,
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

  cleanupOverlayLocks()

  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (showGlobalSearch.value && showGlobalSearchState.value !== 'hide') {
    showGlobalSearchState.value = 'enterActive'
    updateLayout()
    if (syncRoute) {
      void syncSearchRoute()
    }
    return
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

function resolveInputHost(): SearchInputHost | null {
  const input = isSearchMode.value ? searchInputRef.value : aiInputRef.value
  if (!input) {
    return null
  }

  const host = ('$el' in input && input.$el
    ? input.$el
    : input) as SearchInputHost

  if (typeof host.getInputElement === 'function' || host.matches('input, textarea')) {
    return host
  }

  return host.querySelector<SearchInputHost>('input, textarea') || host
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

function syncActiveMentionIntoView() {
  if (!showMentionSuggestions.value) {
    return
  }

  const listElement = mentionListRef.value
  const activeElement = listElement?.querySelectorAll<HTMLElement>('.chat-message__card-item')[activeMentionIndex.value]
  if (typeof activeElement?.scrollIntoView !== 'function') {
    return
  }

  activeElement.scrollIntoView({
    block: 'nearest',
  })
}

function focusInput() {
  void nextTick(() => {
    focusResolvedInput()
  })
}

function focusCurrentRouteInput() {
  void nextTick(() => {
    const focus = () => {
      const page = dockRef.value?.closest('.page')
      if (page && (!page.classList.contains('page-current') || page.getAttribute('aria-hidden') === 'true')) {
        return
      }

      focusResolvedInput()
    }

    if (typeof requestAnimationFrame === 'undefined') {
      focus()
      return
    }

    requestAnimationFrame(focus)
  })
}

function handleRoutePageAfterIn() {
  if (hasRouteSearchOverlay.value) {
    focusCurrentRouteInput()
  }
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
  const explicitContainer = dockRef.value?.closest('[data-global-search-container]') as HTMLElement | null
  if (explicitContainer) {
    return explicitContainer
  }

  const desktopSidebar = dockRef.value?.closest('.note-desktop') as HTMLElement | null
  if (desktopSidebar) {
    return desktopSidebar
  }

  return dockRef.value?.closest('.page') as HTMLElement | null
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

async function searchNotesByKeyword(keyword: string, limit = 0) {
  const matchedNotes = typeof noteStore.searchNotes === 'function'
    ? await noteStore.searchNotes(keyword, {
        limit,
        parentId: props.puuid || '',
        rootTitle: '全部',
      })
    : await noteStore.searchNotesByParentId?.(props.puuid || '', '全部', keyword) || []

  return limit > 0 ? matchedNotes.slice(0, limit) : matchedNotes
}

function clearMentionSuggestions() {
  mentionRequestId += 1
  mentionSuggestions.value = []
  activeMentionIndex.value = 0
  activeMentionRange.value = null
}

async function updateMentionSuggestions(value: string, selectionStart: number) {
  const mention = parseActiveMention(value, selectionStart)
  if (!mention) {
    clearMentionSuggestions()
    return
  }

  activeMentionRange.value = mention.range
  activeMentionIndex.value = 0

  const requestId = ++mentionRequestId
  const matchedSuggestions = await getMentionSuggestions(mention.query, {
    getNote,
    notes: notes.value,
    searchNotesByKeyword,
  }, 6)
  if (requestId !== mentionRequestId) {
    return
  }

  mentionSuggestions.value = matchedSuggestions
}

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
  const target = event.target as F7TextareaElement | HTMLTextAreaElement | null
  const value = target?.value || ''
  if (!isSearchMode.value) {
    aiDraft.value = value
    aiSelectionStart.value = (target as HTMLTextAreaElement | null)?.selectionStart || value.length
    void updateMentionSuggestions(value, aiSelectionStart.value)
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
  clearMentionSuggestions()

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
  clearMentionSuggestions()
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

  const target = {
    path: route.path,
    query: withGlobalSearchOverlay(route.query, inputMode.value),
    hash: route.hash,
    state: withGlobalSearchHistoryState(window.history.state),
  }

  if (typeof router.pushQueryState === 'function') {
    router.pushQueryState(target)
    return
  }

  await router.push(target)
}

async function syncSearchCloseToRoute() {
  if (!shouldSyncWithRoute.value || !hasGlobalSearchOverlay(route.query)) {
    startCloseAnimation()
    return
  }

  blurResolvedInput()
  searchRequestId++

  if (shouldUseRouteBackForGlobalSearchClose(window.history.state)) {
    if (typeof router.backQueryState === 'function') {
      router.backQueryState()
    }
    else {
      router.back()
    }
    return
  }

  const target = {
    path: route.path,
    query: withoutGlobalSearchOverlay(route.query),
    hash: route.hash,
  }

  if (typeof router.replaceQueryState === 'function') {
    router.replaceQueryState(target)
    return
  }

  await router.replace(target)
}

function onCancel() {
  void syncSearchCloseToRoute()
}

function onInput(event: SearchTextareaEvent) {
  const value = event.detail.value || ''
  const nativeEvent = event.detail.event
  const target = nativeEvent?.target as HTMLTextAreaElement | null
  const selectionStart = target?.selectionStart ?? value.length

  syncInputHeightLimits()

  if (
    isComposing.value
    || (typeof InputEvent !== 'undefined' && nativeEvent instanceof InputEvent && nativeEvent.isComposing)
  ) {
    return
  }

  if (!isSearchMode.value) {
    aiDraft.value = value
    aiSelectionStart.value = selectionStart
    void updateMentionSuggestions(value, selectionStart)
    activateSearch()
    return
  }

  applySearchKeyword(value)
  void debouncedSearch(value)
}

function onSearchbarInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  onInput({
    detail: {
      event,
      value: target?.value || '',
    },
    target: target || event.target,
  } as SearchTextareaEvent)
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
    clearMentionSuggestions()
    activateSearch()
  }
  syncInputHeightLimits()
  focusInput()
}

async function setInputSelection(position: number) {
  const inputHost = resolveInputHost()
  if (!inputHost || typeof inputHost.getInputElement !== 'function') {
    return
  }

  const nativeInput = await inputHost.getInputElement()
  if (!nativeInput)
    return
  nativeInput.setSelectionRange(position, position)
  nativeInput.focus()
  aiSelectionStart.value = position
}

async function handleMentionSelect(entity: MentionEntity) {
  const range = activeMentionRange.value
  if (!range) {
    return
  }

  const mentionText = formatMentionText(entity)
  const nextDraft = `${aiDraft.value.slice(0, range.start)}${mentionText}${aiDraft.value.slice(range.end)}`
  const nextCursor = range.start + mentionText.length
  aiDraft.value = nextDraft
  clearMentionSuggestions()
  activateSearch()
  syncInputHeightLimits()
  await nextTick()
  await setInputSelection(nextCursor)
}

function handleMentionCardAction(action: ChatMessageCardAction) {
  const matchedEntity = action.type === 'open-note'
    ? mentionSuggestions.value.find(entity => entity.type === 'note' && entity.id === action.noteId)
    : action.type === 'open-folder'
      ? mentionSuggestions.value.find(entity => entity.type === 'folder' && entity.id === action.folderId)
      : null

  if (!matchedEntity) {
    return
  }

  void handleMentionSelect(matchedEntity)
}

async function onAiAction() {
  if (isAiBusy.value) {
    await chat.stop()
    focusInput()
    return
  }

  await submitAiDraft()
}

async function selectInputMode(mode: 'search' | 'ai') {
  inputMode.value = mode
  searchRequestId++

  if (mode === 'search') {
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

function handleGlobalKeydown(event: KeyboardEvent) {
  if (event.isComposing || isComposing.value) {
    return
  }

  if (isOpenGlobalSearchShortcut(event)) {
    event.preventDefault()
    if (!event.repeat) {
      void selectInputMode('search')
    }
    return
  }

  if (
    event.key === 'Escape'
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && showGlobalSearch.value
  ) {
    event.preventDefault()
    void syncSearchCloseToRoute()
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!isSearchMode.value) {
    const target = event.target as HTMLTextAreaElement | null
    aiSelectionStart.value = target?.selectionStart ?? aiDraft.value.length

    if (showMentionSuggestions.value) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (mentionSuggestions.value.length > 0) {
          activeMentionIndex.value = (activeMentionIndex.value + 1) % mentionSuggestions.value.length
        }
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (mentionSuggestions.value.length > 0) {
          activeMentionIndex.value = (activeMentionIndex.value - 1 + mentionSuggestions.value.length) % mentionSuggestions.value.length
        }
        return
      }

      if ((event.key === 'Enter' && !event.metaKey && !event.ctrlKey) || event.key === 'Tab') {
        const note = mentionSuggestions.value[activeMentionIndex.value]
        if (note) {
          event.preventDefault()
          void handleMentionSelect(note)
          return
        }
      }

      if (event.key === 'Escape') {
        clearMentionSuggestions()
        return
      }
    }
  }

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
  clearMentionSuggestions()
  activateSearch()
  syncInputHeightLimits()
  focusInput()
}

async function handleResumeTask() {
  const resumed = await resumeInterruptedTask()

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
  clearMentionSuggestions()
  state.notes = []
  resetGlobalSearch()
}

function handleSearchResultSelected(noteId: string) {
  const targetNote = state.notes.find(note => note.id === noteId)
  if (!targetNote) {
    return
  }

  closeSearchImmediately()
  emit('openNote', {
    isDeleted: targetNote.is_deleted === 1,
    noteId: targetNote.id,
    parentId: targetNote.is_deleted === 1
      ? 'deleted'
      : targetNote.parent_id || 'allnotes',
  })
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

function handleAiConfigurationCancel() {
  void selectInputMode('search')
}

async function toggleInputMode() {
  await selectInputMode(isSearchMode.value ? 'ai' : 'search')
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
    focusCurrentRouteInput()

    if (!previousVisible && inputMode.value === 'search' && searchKeyword.value.trim()) {
      void runSearch(searchKeyword.value)
    }
    return
  }

  if (previousVisible && (showGlobalSearch.value || showGlobalSearchState.value !== 'hide')) {
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
  if (isSearchMode.value) {
    clearMentionSuggestions()
  }
  syncInputHeightLimits()
})

watch([showMentionSuggestions, activeMentionIndex, mentionSuggestions], ([visible]) => {
  if (!visible) {
    return
  }

  void nextTick(() => {
    syncActiveMentionIntoView()
  })
})

onMounted(() => {
  updateLayout()
  syncInputHeightLimits()
  routePageElement = dockRef.value?.closest('.page') || null
  routePageElement?.addEventListener('page:afterin', handleRoutePageAfterIn)
  if (hasRouteSearchOverlay.value) {
    focusCurrentRouteInput()
  }
  if (typeof ResizeObserver !== 'undefined') {
    const panelContainer = resolvePanelContainer()
    if (panelContainer) {
      panelContainerResizeObserver = new ResizeObserver(scheduleLayoutUpdate)
      panelContainerResizeObserver.observe(panelContainer)
    }
  }
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', handleViewportChange)
})

onUnmounted(() => {
  routePageElement?.removeEventListener('page:afterin', handleRoutePageAfterIn)
  routePageElement = null
  panelContainerResizeObserver?.disconnect()
  panelContainerResizeObserver = null
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }

  if (enterFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(enterFrameId)
    enterFrameId = null
  }

  window.removeEventListener('keydown', handleGlobalKeydown)
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

      <F7Button
        v-if="showGlobalSearch"
        href="false"
        class="app-glass-circle-button"
        :aria-label="currentToggleLabel"
        @pointerdown.prevent
        @click="toggleInputMode"
      >
        <F7Icon :icon="currentToggleIcon" />
      </F7Button>

      <div class="global-search__field">
        <F7Searchbar
          v-if="isSearchMode"
          ref="searchInputRef"
          :value="currentDraft"
          :clear-button="hasInputValue"
          :custom-search="true"
          :disable-button="false"
          :form="false"
          :inline="true"
          :outline="false"
          autocomplete="off"
          :placeholder="currentPlaceholder"
          :spellcheck="false"
          class="global-search__input"
          @focus="onFocus"
          @input="onSearchbarInput"
          @keydown="onKeydown"
          @compositionstart="handleCompositionStart"
          @compositionend="handleCompositionEnd"
          @click:clear="onClear"
        />
        <div
          v-else
          :class="{ 'global-search__field-shell--panel-visible': shouldCollapseFieldIcon }"
          class="global-search__field-shell"
        >
          <F7Icon
            :icon="sparklesOutline"
            class="global-search__search-icon"
          />
          <F7Textarea
            ref="aiInputRef"
            :value="currentDraft"
            auto-grow
            :inputmode="currentInputMode"
            :enterkeyhint="currentEnterKeyHint"
            autocomplete="off"
            :placeholder="currentPlaceholder"
            :rows="1"
            :spellcheck="false"
            class="global-search__input"
            style="--padding-top: 5px; --padding-bottom: 5px;"
            @f7-focus="onFocus"
            @f7-input="onInput"
            @keydown="onKeydown"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          />
        </div>
      </div>

      <F7Button
        v-if="showGlobalSearch && shouldShowCloseButton"
        href="false"
        class="app-glass-circle-button"
        aria-label="关闭搜索"
        @click="onCancel"
      >
        <F7Icon :icon="closeOutline" />
      </F7Button>
      <F7Button
        v-else-if="showGlobalSearch && showAiActionButton"
        href="false"
        class="app-glass-circle-button"
        :aria-label="currentActionLabel"
        @click="onAiAction"
      >
        <F7Icon :icon="currentActionIcon" />
      </F7Button>

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

          <F7Content
            v-if="isSearchMode"
            :fullscreen="true"
            class="global-search__panel-content"
          >
            <template v-if="hasSearchKeyword && state.notes.length > 0">
              <NoteList
                :data-list="searchResults"
                :all-notes-count="state.notes.length"
                disabled-route
                media-list
                show-parent-folder
                @selected="handleSearchResultSelected"
              />
            </template>
            <div v-else-if="isSearchMode && hasSearchKeyword" class="global-search__empty">
              没有找到相关备忘录
            </div>
            <div v-else class="global-search__empty global-search__empty--idle">
              {{ panelIdleMessage }}
            </div>
            <div class="h-4" />
          </F7Content>

          <AiChatPanel
            v-else
            class="global-search__ai-panel"
            @action="handleAiAction"
            @cancel-configuration="handleAiConfigurationCancel"
            @prefill="handleAiPrefill"
            @resume-task="handleResumeTask"
          />
          <div v-if="showMentionSuggestions" class="global-search__mention-panel">
            <p class="global-search__mention-caption">
              引用建议
            </p>
            <ul
              v-if="mentionSuggestions.length"
              ref="mentionListRef"
              class="global-search__mention-list"
            >
              <ChatMessageCardItemView
                v-for="(item, index) in mentionSuggestionItems"
                :key="item.id"
                :item="item"
                :selected="index === activeMentionIndex"
                class="global-search__mention-card-item"
                @action="handleMentionCardAction"
              />
            </ul>
            <div v-else class="global-search__mention-empty">
              没有找到相关备忘录
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
:root:not(.app-theme-dark) .global-search {
  .global-search__search-icon,
  .global-search__input .searchbar-icon,
  .global-search__input .input-clear-button {
    color: var(--c-icon);
  }

  .global-search__input,
  .global-search__input input {
    --color: var(--c-text-primary);
    --placeholder-color: var(--c-placeholder);
  }
}

.page-with-navbar-large .global-search .global-search__input.searchbar {
  top: auto;
  transform: none;
}

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
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    gap: 8px;
    height: auto;
    min-height: 44px;
    padding: 0 12px;
    border-radius: 24px;
    border: 1px solid var(--c-global-search-control-border);
    background: var(--c-global-search-control-background);
    box-shadow:
      inset 0 1px 0 var(--c-global-search-control-highlight),
      0 8px 20px var(--c-global-search-control-shadow);
    overflow: hidden;
    transition:
      height 180ms ease,
      gap 180ms ease,
      border-radius 180ms ease,
      box-shadow 180ms ease;
    -webkit-backdrop-filter: blur(14px) saturate(150%) contrast(102%);
    backdrop-filter: blur(14px) saturate(150%) contrast(102%);
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
    --color: var(--c-text-primary);
    --padding-start: 0;
    --padding-end: 0;
    --placeholder-color: var(--c-placeholder);
    flex: 1;
    min-width: 0;
    min-height: 32px;
    max-height: calc(22px * 3 + 10px);
    font-size: 16px;
    line-height: 22px;
    transition: min-height 180ms ease;
  }

  &__input.searchbar {
    --f7-searchbar-bg-color: transparent;
    --f7-searchbar-input-bg-color: var(--c-global-search-control-background);
    --f7-searchbar-input-text-color: var(--c-text-primary);
    --f7-searchbar-placeholder-color: var(--c-placeholder);
    --f7-searchbar-search-icon-color: var(--c-icon);
    --f7-searchbar-input-font-size: 16px;
    flex: 1;
    display: block;
    position: relative;
    top: auto;
    width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    transform: none;
  }

  &__field-shell &__input {
    min-height: 32px;
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
    background: var(--c-global-search-panel-overlay);
    -webkit-backdrop-filter: blur(0) saturate(100%);
    backdrop-filter: blur(0) saturate(100%);
    transition:
      background-color 320ms ease,
      -webkit-backdrop-filter 320ms ease,
      backdrop-filter 320ms ease;
  }

  &__panel-surface--active::before {
    background: var(--c-global-search-panel-active-overlay);
    -webkit-backdrop-filter: blur(26px) saturate(150%);
    backdrop-filter: blur(26px) saturate(150%);
  }

  &__panel-header {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-end;
    gap: 4px;
    box-sizing: border-box;
    height: var(--global-search-panel-header-height);
    padding: max(20px, env(safe-area-inset-top)) 16px 12px;
    border-bottom: 1px solid var(--c-global-search-control-border);
    background: var(--c-global-search-control-background);
    -webkit-backdrop-filter: blur(18px) saturate(160%) contrast(104%);
    backdrop-filter: blur(18px) saturate(160%) contrast(104%);
    pointer-events: none;
  }

  &__panel-caption {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    line-height: 20px;
    color: var(--c-text-primary);
  }

  &__panel-meta {
    margin: 0;
    font-size: 13px;
    line-height: 18px;
    color: var(--c-text-primary);
  }

  &__panel-body {
    position: relative;
    z-index: 1;
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
    box-sizing: border-box;
    color: var(--c-text-primary);
    overflow: hidden;
    opacity: 0;
    --global-search-panel-header-height: calc(max(20px, env(safe-area-inset-top)) + 54px);
    transition: opacity 220ms ease;
  }

  &__panel-body--active {
    opacity: 1;
  }

  &__panel-content {
    position: absolute;
    inset: 0;
    z-index: 1;
    width: 100%;
    height: 100%;
    --background: transparent;
    --padding-top: var(--global-search-panel-header-height);
    --padding-bottom: calc(var(--global-search-panel-bottom-inset) + 12px);
  }

  &__ai-panel {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &__mention-panel {
    position: absolute;
    z-index: 120;
    left: 16px;
    right: 16px;
    bottom: calc(var(--global-search-panel-bottom-inset, 0px) + 12px);
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: min(320px, 42vh);
    padding: 12px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px;
    background: rgba(15, 23, 42, 0.88);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.28);
    -webkit-backdrop-filter: blur(22px);
    backdrop-filter: blur(22px);
  }

  &__mention-caption {
    margin: 0;
    color: #94a3b8;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  &__mention-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  &__mention-card-item {
    flex: 0 0 auto;
    margin: 0;
  }

  &__mention-empty {
    color: #94a3b8;
    font-size: 13px;
    line-height: 1.5;
  }

  &__empty {
    padding: 24px 16px 12px;
    color: var(--c-text-primary);
    line-height: 1.5;
  }

  &__empty--idle {
    padding-top: 8px;
  }
}
</style>
