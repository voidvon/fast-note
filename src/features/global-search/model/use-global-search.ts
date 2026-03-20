import { ref } from 'vue'

const showGlobalSearch = ref(false)
const showGlobalSearchState = ref<'enterStart' | 'enterActive' | 'leaveStart' | 'hide'>('hide')
const searchKeyword = ref('')

function resetGlobalSearch() {
  showGlobalSearch.value = false
  showGlobalSearchState.value = 'hide'
  searchKeyword.value = ''
}

export function useGlobalSearch() {
  return {
    showGlobalSearch,
    showGlobalSearchState,
    searchKeyword,
    resetGlobalSearch,
  }
}
