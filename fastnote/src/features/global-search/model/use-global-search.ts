import { ref, watch } from 'vue'
import { createScopedStorageKey } from '@/shared/lib/user-scope'

export type GlobalSearchInputMode = 'search' | 'ai'

const GLOBAL_SEARCH_INPUT_MODE_STORAGE_KEY = 'global-search-input-mode'

const showGlobalSearch = ref(false)
const showGlobalSearchState = ref<'enterStart' | 'enterActive' | 'leaveStart' | 'hide'>('hide')
const inputMode = ref<GlobalSearchInputMode>('search')
const searchKeyword = ref('')
const aiDraft = ref('')
const hasHydrated = ref(false)

function getStorageKey() {
  return createScopedStorageKey(GLOBAL_SEARCH_INPUT_MODE_STORAGE_KEY)
}

function normalizeInputMode(value: unknown): GlobalSearchInputMode {
  return value === 'ai' ? 'ai' : 'search'
}

function hydrateInputMode() {
  if (hasHydrated.value || typeof localStorage === 'undefined') {
    hasHydrated.value = true
    return
  }

  const stored = localStorage.getItem(getStorageKey())
  if (!stored) {
    hasHydrated.value = true
    return
  }

  try {
    inputMode.value = normalizeInputMode(JSON.parse(stored))
  }
  catch {
    localStorage.removeItem(getStorageKey())
  }

  hasHydrated.value = true
}

function persistInputMode() {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(getStorageKey(), JSON.stringify(inputMode.value))
}

function resetGlobalSearch(options: { preserveInputMode?: boolean } = {}) {
  const { preserveInputMode = true } = options

  hydrateInputMode()
  showGlobalSearch.value = false
  showGlobalSearchState.value = 'hide'
  searchKeyword.value = ''
  aiDraft.value = ''

  if (!preserveInputMode) {
    inputMode.value = 'search'
    persistInputMode()
  }
}

export function useGlobalSearch() {
  hydrateInputMode()

  return {
    aiDraft,
    inputMode,
    resetGlobalSearch,
    searchKeyword,
    showGlobalSearch,
    showGlobalSearchState,
  }
}

watch(inputMode, () => {
  if (!hasHydrated.value) {
    return
  }

  persistInputMode()
})
