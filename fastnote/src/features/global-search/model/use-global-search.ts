import { ref } from 'vue'

export type GlobalSearchInputMode = 'search' | 'ai'

const showGlobalSearch = ref(false)
const showGlobalSearchState = ref<'enterStart' | 'enterActive' | 'leaveStart' | 'hide'>('hide')
const inputMode = ref<GlobalSearchInputMode>('search')
const searchKeyword = ref('')
const aiDraft = ref('')

function resetGlobalSearch() {
  showGlobalSearch.value = false
  showGlobalSearchState.value = 'hide'
  searchKeyword.value = ''
  aiDraft.value = ''
  inputMode.value = 'search'
}

export function useGlobalSearch() {
  return {
    aiDraft,
    inputMode,
    resetGlobalSearch,
    searchKeyword,
    showGlobalSearch,
    showGlobalSearchState,
  }
}
