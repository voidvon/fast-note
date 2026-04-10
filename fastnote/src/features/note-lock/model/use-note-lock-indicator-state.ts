import type { Ref } from 'vue'
import type { FolderTreeNode, Note } from '@/shared/types'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NOTE_TYPE } from '@/shared/types'
import { onNoteLockSessionChanged, useNoteLock } from './use-note-lock'

export type NoteLockIndicatorState = 'locked' | 'unlocked' | 'placeholder'

function flattenNotes(nodes: FolderTreeNode[]): Note[] {
  const notes: Note[] = []

  function walk(branches: FolderTreeNode[]) {
    branches.forEach((node) => {
      if (node.originNote?.item_type === NOTE_TYPE.NOTE) {
        notes.push(node.originNote)
      }

      if (node.children?.length) {
        walk(node.children)
      }
    })
  }

  walk(nodes)
  return notes
}

export function useNoteLockIndicatorState(dataList: Ref<FolderTreeNode[]>) {
  const noteLock = useNoteLock()
  const indicatorStateMap = ref<Record<string, NoteLockIndicatorState>>({})
  const visibleNotes = computed(() => flattenNotes(dataList.value || []))
  const visibleNoteIds = computed(() => new Set(visibleNotes.value.map(note => note.id)))
  const noteSignature = computed(() => {
    return visibleNotes.value
      .map(note => `${note.id}:${note.is_locked}:${note.updated}:${note.parent_id}`)
      .join('|')
  })
  let activeRefreshToken = 0
  let expiryTimer: number | null = null
  let unsubscribeSessionChange: (() => void) | null = null

  function clearExpiryTimer() {
    if (expiryTimer !== null) {
      window.clearTimeout(expiryTimer)
      expiryTimer = null
    }
  }

  function scheduleExpiryRefresh(expiresAt: number | null) {
    clearExpiryTimer()
    if (typeof window === 'undefined' || !expiresAt) {
      return
    }

    const delay = Math.max(expiresAt - Date.now(), 0) + 16
    expiryTimer = window.setTimeout(() => {
      void refreshIndicatorStates()
    }, delay)
  }

  async function refreshIndicatorStates() {
    const refreshToken = ++activeRefreshToken
    const notes = visibleNotes.value
    let nextExpiryAt: number | null = null
    const nextStateMap = await Promise.all(notes.map(async (note) => {
      if (note.item_type !== NOTE_TYPE.NOTE || note.is_locked !== 1) {
        return [note.id, 'placeholder'] as const
      }

      try {
        const snapshot = await noteLock.getLockViewState(note.id, note)
        if (snapshot.viewState === 'unlocked') {
          const expiresAt = snapshot.session?.expires_at ?? null
          if (expiresAt && expiresAt > Date.now() && (!nextExpiryAt || expiresAt < nextExpiryAt)) {
            nextExpiryAt = expiresAt
          }

          return [note.id, 'unlocked'] as const
        }
      }
      catch (error) {
        console.error('读取列表锁状态失败:', error)
      }

      return [note.id, 'locked'] as const
    }))

    if (refreshToken !== activeRefreshToken) {
      return
    }

    indicatorStateMap.value = Object.fromEntries(nextStateMap)
    scheduleExpiryRefresh(nextExpiryAt)
  }

  function refreshIfVisible(noteId?: string) {
    if (noteId && !visibleNoteIds.value.has(noteId)) {
      return
    }

    void refreshIndicatorStates()
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      refreshIfVisible()
    }
  }

  function handleWindowFocus() {
    refreshIfVisible()
  }

  watch(noteSignature, () => {
    void refreshIndicatorStates()
  }, { immediate: true })

  onMounted(() => {
    unsubscribeSessionChange = onNoteLockSessionChanged(({ noteId }) => {
      refreshIfVisible(noteId)
    })

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
  })

  onBeforeUnmount(() => {
    unsubscribeSessionChange?.()
    clearExpiryTimer()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    window.removeEventListener('focus', handleWindowFocus)
  })

  return {
    indicatorStateMap,
    refreshIndicatorStates,
  }
}
