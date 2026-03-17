import { ref } from 'vue'

const showGlobalSearch = ref(false)
const showGlobalSearchState = ref<'enterStart' | 'enterActive' | 'leaveStart' | 'hide'>('hide')

export function useGlobalSearch() {
  return {
    showGlobalSearch,
    showGlobalSearchState,
  }
}
