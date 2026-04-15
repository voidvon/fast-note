import { afterEach, describe, expect, it } from 'vitest'
import { useGlobalSearch } from '@/features/global-search'

function resetGlobalSearchState() {
  const { resetGlobalSearch } = useGlobalSearch()
  resetGlobalSearch({ preserveInputMode: false })
}

describe('useGlobalSearch integration', () => {
  afterEach(() => {
    resetGlobalSearchState()
  })

  it('shares state between callers', () => {
    const first = useGlobalSearch()
    const second = useGlobalSearch()

    first.showGlobalSearch.value = true
    first.showGlobalSearchState.value = 'enterActive'
    first.inputMode.value = 'ai'
    first.searchKeyword.value = '会议'
    first.aiDraft.value = '帮我整理今天的会议纪要'

    expect(second.showGlobalSearch.value).toBe(true)
    expect(second.showGlobalSearchState.value).toBe('enterActive')
    expect(second.inputMode.value).toBe('ai')
    expect(second.searchKeyword.value).toBe('会议')
    expect(second.aiDraft.value).toBe('帮我整理今天的会议纪要')
  })
})
