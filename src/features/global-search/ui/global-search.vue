<script setup lang="ts">
import type { SearchbarInputEventDetail } from '@ionic/core/components'
import type { Note } from '@/entities/note'
import { IonContent, IonSearchbar } from '@ionic/vue'
import { useDebounceFn } from '@vueuse/core'
import { computed, onUnmounted, reactive, ref } from 'vue'
import { useNoteRepository } from '@/entities/note'
import NoteList from '@/widgets/note-list'
import { toSearchResultNodes } from '../lib/search-results'
import { useGlobalSearch } from '../model/use-global-search'

const props = withDefaults(defineProps<{
  puuid?: string | null
}>(), {
  puuid: null,
})

const { showGlobalSearch, showGlobalSearchState } = useGlobalSearch()
const { searchNotesByParentId } = useNoteRepository()

const fullScreenRef = ref<HTMLDivElement>()
const isComposing = ref(false)
const state = reactive({
  cacheTop: 0,
  top: 0,
  notes: [] as Note[],
})

let nativeInput: HTMLInputElement | null = null

const searchResults = computed(() => toSearchResultNodes(state.notes))

async function runSearch(searchText: string) {
  const keyword = searchText.trim()

  if (keyword) {
    state.notes = await searchNotesByParentId(props.puuid || '', '全部', keyword)
  }
  else {
    state.notes = []
  }
}

const debouncedSearch = useDebounceFn(runSearch, 300)

function handleCompositionStart() {
  isComposing.value = true
}

function handleCompositionEnd(event: CompositionEvent) {
  isComposing.value = false
  void runSearch((event.target as HTMLInputElement | null)?.value || '')
}

async function ensureCompositionListeners() {
  if (nativeInput) {
    return
  }

  const searchbar = fullScreenRef.value?.querySelector('ion-searchbar') as HTMLIonSearchbarElement | null
  if (!searchbar) {
    return
  }

  nativeInput = await searchbar.getInputElement()
  nativeInput.addEventListener('compositionstart', handleCompositionStart)
  nativeInput.addEventListener('compositionend', handleCompositionEnd)
}

function cleanupCompositionListeners() {
  if (!nativeInput) {
    return
  }

  nativeInput.removeEventListener('compositionstart', handleCompositionStart)
  nativeInput.removeEventListener('compositionend', handleCompositionEnd)
  nativeInput = null
}

function onFocus() {
  void ensureCompositionListeners()
  showGlobalSearch.value = true
  const rect = fullScreenRef.value!.getBoundingClientRect()
  state.cacheTop = rect.top
  state.top = rect.top
  showGlobalSearchState.value = 'enterStart'
  setTimeout(() => {
    showGlobalSearchState.value = 'enterActive'
    state.top = 8
  }, 1)
}

function onCancel() {
  state.top = state.cacheTop
  state.notes = []
  showGlobalSearch.value = false
  showGlobalSearchState.value = 'leaveStart'
  setTimeout(() => {
    showGlobalSearchState.value = 'hide'
  }, 300)
}

function onInput(event: CustomEvent<SearchbarInputEventDetail>) {
  const value = event.detail.value || ''
  const nativeEvent = event.detail.event

  if (
    isComposing.value
    || (typeof InputEvent !== 'undefined' && nativeEvent instanceof InputEvent && nativeEvent.isComposing)
  ) {
    return
  }

  void debouncedSearch(value)
}

onUnmounted(() => {
  cleanupCompositionListeners()
})
</script>

<template>
  <div class="global-search h-[36px]">
    <div
      ref="fullScreenRef"
      :class="{
        'global-search__full-screen': ['enterActive', 'leaveStart'].includes(showGlobalSearchState),
        'enter-active': showGlobalSearchState === 'enterActive',
        'leave-start': showGlobalSearchState === 'leaveStart',
      }"
      :style="{ top: `${state.top}px` }"
      class="flex global-search__full-container flex-col"
    >
      <IonSearchbar
        :debounce="0"
        :show-cancel-button="showGlobalSearch ? 'always' : 'never'"
        placeholder="搜索"
        cancel-button-text="取消"
        @ion-focus="onFocus"
        @ion-cancel="onCancel"
        @ion-input="onInput"
      />
      <div class="flex-1">
        <IonContent>
          <template v-if="state.notes.length > 0">
            <div class="flex px-4 justify-between">
              <h2 class="mb0">
                备忘录
              </h2>
              <h2 class="mb0 text-gray-400">
                共<span class="mx-1">{{ state.notes.length }}</span>条结果
              </h2>
            </div>
            <NoteList
              :data-list="searchResults"
              :all-notes-count="state.notes.length"
              show-parent-folder
            />
          </template>
          <div class="h-11" />
        </IonContent>
      </div>
    </div>
  </div>
</template>

<style lang="scss">
.global-search {
  padding: 0;
  &__full-container {
    background-color: transparent;
  }
  &__full-screen {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    transition: all 300ms ease-in-out;
    background-color: black;
    &.enter-active {
      background-color: black;
      ion-content {
        opacity: 1;
      }
    }
    &.leave-start {
      background-color: transparent;
      ion-content {
        opacity: 0;
      }
    }
    ion-searchbar {
      padding-bottom: 8px !important;
    }
  }
  ion-content {
    --background: transparent;
    transition: opacity 300ms ease-in-out;
    opacity: 0;
  }
}
</style>
