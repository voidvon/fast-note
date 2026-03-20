<script setup lang="ts">
import type { Note } from '@/entities/note'
import { IonContent, IonIcon } from '@ionic/vue'
import { useDebounceFn } from '@vueuse/core'
import { closeCircle, closeOutline, searchOutline } from 'ionicons/icons'
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { useNote } from '@/entities/note'
import NoteList from '@/widgets/note-list'
import { toSearchResultNodes } from '../lib/search-results'
import { useGlobalSearch } from '../model/use-global-search'

const props = withDefaults(defineProps<{
  puuid?: string | null
}>(), {
  puuid: null,
})

const { showGlobalSearch, showGlobalSearchState, searchKeyword, resetGlobalSearch } = useGlobalSearch()
const { searchNotesByParentId } = useNote()
const SURFACE_TRANSITION_MS = 320
const CONTENT_TRANSITION_MS = 220

const dockRef = ref<HTMLDivElement>()
const inputRef = ref<HTMLInputElement>()
const isComposing = ref(false)
const state = reactive({
  notes: [] as Note[],
  left: 0,
  width: 0,
  bottom: 0,
  maxHeight: 320,
})

let nativeInput: HTMLInputElement | null = null
let resizeObserver: ResizeObserver | null = null
let searchRequestId = 0
let hideTimer: ReturnType<typeof setTimeout> | null = null
let enterFrameId: number | null = null

const searchResults = computed(() => toSearchResultNodes(state.notes))
const hasKeyword = computed(() => searchKeyword.value.trim().length > 0)
const shouldRenderPanel = computed(() => showGlobalSearchState.value !== 'hide')
const panelStyle = computed(() => ({
  left: `${state.left}px`,
  width: `${state.width}px`,
  bottom: `${state.bottom}px`,
  height: `${state.maxHeight}px`,
  maxHeight: `${state.maxHeight}px`,
}))

function activateSearch() {
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
}

function resolveFooterElement() {
  return dockRef.value?.closest('ion-footer') as HTMLElement | null
}

function updateLayout() {
  const footerRect = resolveFooterElement()?.getBoundingClientRect()
  if (!footerRect) {
    return
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0
  state.left = footerRect.left
  state.width = footerRect.width
  state.bottom = Math.max(0, viewportHeight - footerRect.top)
  state.maxHeight = Math.max(0, footerRect.top - 12)
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

function handleCompositionEnd(event: CompositionEvent) {
  isComposing.value = false
  const value = (event.target as HTMLInputElement | null)?.value || ''
  searchKeyword.value = value
  syncVisibilityByKeyword(value)
  void runSearch(value)
}

function cleanupCompositionListeners() {
  nativeInput = null
}

function onFocus() {
  nativeInput = inputRef.value || null
  activateSearch()
}

function onCancel() {
  nativeInput?.blur()
  searchRequestId++
  showGlobalSearchState.value = 'leaveStart'

  hideTimer = setTimeout(() => {
    hideTimer = null
    state.notes = []
    resetGlobalSearch()
  }, Math.max(SURFACE_TRANSITION_MS, CONTENT_TRANSITION_MS))
}

function syncVisibilityByKeyword(value: string) {
  const keyword = value.trim()

  if (!keyword) {
    state.notes = []
    return
  }

  activateSearch()
}

function onInput(event: Event) {
  const target = event.target as HTMLInputElement | null
  const value = target?.value || ''

  if (
    isComposing.value
    || (typeof InputEvent !== 'undefined' && event instanceof InputEvent && event.isComposing)
  ) {
    return
  }

  searchKeyword.value = value
  syncVisibilityByKeyword(value)
  void debouncedSearch(value)
}

function onClear() {
  searchRequestId++
  state.notes = []
  searchKeyword.value = ''
  activateSearch()
  void nextTick(() => {
    inputRef.value?.focus()
  })
}

function handleViewportChange() {
  if (!showGlobalSearch.value) {
    return
  }

  updateLayout()
}

onMounted(() => {
  updateLayout()

  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      handleViewportChange()
    })

    const footerElement = resolveFooterElement()
    if (footerElement) {
      resizeObserver.observe(footerElement)
    }
  }

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

  cleanupCompositionListeners()
  resetGlobalSearch()
  resizeObserver?.disconnect()
  window.removeEventListener('resize', handleViewportChange)
})
</script>

<template>
  <div ref="dockRef" :class="{ 'global-search--active': showGlobalSearch }" class="global-search">
    <div class="global-search__dock">
      <div
        v-if="showGlobalSearch"
        class="global-search__side-spacer"
        aria-hidden="true"
      />

      <div class="global-search__field">
        <div class="global-search__field-shell">
          <IonIcon :icon="searchOutline" class="global-search__search-icon" />
          <input
            ref="inputRef"
            :value="searchKeyword"
            type="search"
            inputmode="search"
            enterkeyhint="search"
            autocomplete="off"
            placeholder="搜索"
            class="global-search__input"
            @focus="onFocus"
            @input="onInput"
            @compositionstart="handleCompositionStart"
            @compositionend="handleCompositionEnd"
          >
          <button
            v-if="hasKeyword"
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
        v-if="showGlobalSearch"
        type="button"
        class="global-search__close-button"
        aria-label="关闭搜索"
        @click="onCancel"
      >
        <IonIcon :icon="closeOutline" />
      </button>
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
          <div class="global-search__panel-header">
            <p class="global-search__panel-caption">
              {{ hasKeyword ? '搜索结果' : '搜索' }}
            </p>
            <p v-if="hasKeyword" class="global-search__panel-meta">
              共 {{ state.notes.length }} 条结果
            </p>
          </div>

          <IonContent class="global-search__panel-content">
            <template v-if="hasKeyword && state.notes.length > 0">
              <NoteList
                :data-list="searchResults"
                :all-notes-count="state.notes.length"
                show-parent-folder
              />
            </template>
            <div v-else-if="hasKeyword" class="global-search__empty">
              没有找到相关备忘录
            </div>
            <div v-else class="global-search__empty global-search__empty--idle">
              输入标题或内容关键词搜索备忘录
            </div>
            <div class="h-4" />
          </IonContent>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.global-search {
  display: flex;
  align-items: center;
  min-height: 36px;
  padding: 0;
  position: relative;

  &__dock {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 36px;
  }

  &__field {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  &__side-spacer {
    width: 36px;
    min-width: 36px;
    height: 36px;
    flex: 0 0 36px;
    visibility: hidden;
    pointer-events: none;
  }

  &__field-shell {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 36px;
    min-height: 36px;
    padding: 0 12px;
    border-radius: 9999px;
    background: rgba(28, 28, 30, 0.96);
    overflow: hidden;
    backdrop-filter: blur(28px);
  }

  &__search-icon {
    flex: 0 0 auto;
    font-size: 16px;
    color: #d1d1d6;
  }

  &__input {
    flex: 1;
    min-width: 0;
    height: 36px;
    border: 0;
    padding: 0;
    background: transparent;
    color: #f5f5f7;
    font-size: 16px;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }

  &__input::placeholder {
    color: #8e8e93;
  }

  &__input::-webkit-search-cancel-button {
    display: none;
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

  &__close-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    min-width: 36px;
    height: 36px;
    border: 0;
    padding: 0;
    border-radius: 50%;
    background: rgba(28, 28, 30, 0.96);
    color: #f5f5f7;
    box-shadow: none;
    backdrop-filter: blur(28px);
    appearance: none;
    -webkit-appearance: none;
    flex: 0 0 36px;
  }

  &__close-button ion-icon {
    font-size: 20px;
  }

  &__panel {
    position: fixed;
    z-index: 999;
    padding: max(16px, env(safe-area-inset-top)) 0 8px;
  }

  &__panel-surface {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: 0;
    background: rgba(10, 10, 12, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.015);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.01);
    backdrop-filter: blur(0) saturate(100%);
    -webkit-backdrop-filter: blur(0) saturate(100%);
    max-height: inherit;
    transition:
      background-color 320ms ease,
      border-color 320ms ease,
      box-shadow 320ms ease,
      backdrop-filter 320ms ease,
      -webkit-backdrop-filter 320ms ease;
  }

  &__panel-surface--active {
    background: rgba(10, 10, 12, 0.38);
    border-color: rgba(255, 255, 255, 0.04);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(26px) saturate(150%);
    -webkit-backdrop-filter: blur(26px) saturate(150%);
  }

  &__panel-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 16px 12px;
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
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
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
