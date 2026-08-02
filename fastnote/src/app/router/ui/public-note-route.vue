<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import NoteDetailPage from '@/pages/note-detail'
import UserPublicNotesPage from '@/pages/user-public-notes'
import { loadPublicNote } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'
import { onF7ViewDidLeave, useAppRoute } from '@/shared/ui/f7'

const route = useAppRoute()
const { isDesktop } = useDeviceType()
const loading = ref(true)
const error = ref('')
const loadedNoteId = ref('')
let requestVersion = 0

const username = computed(() => route.params.username as string || '')
const noteId = computed(() => route.params.noteId as string || '')

async function loadNote() {
  if (isDesktop.value) {
    requestVersion += 1
    loading.value = false
    error.value = ''
    loadedNoteId.value = ''
    return
  }

  if (!username.value || !noteId.value) {
    requestVersion += 1
    error.value = ''
    return
  }

  const currentRequest = ++requestVersion
  const currentNoteId = noteId.value
  loading.value = true
  error.value = ''
  loadedNoteId.value = ''

  try {
    const note = await loadPublicNote(username.value, noteId.value)
    if (currentRequest !== requestVersion) {
      return
    }
    if (!note) {
      throw new Error('公开备忘录不存在')
    }
    loadedNoteId.value = currentNoteId
  }
  catch (loadError) {
    if (currentRequest !== requestVersion) {
      return
    }
    error.value = loadError instanceof Error ? loadError.message : '无法加载备忘录'
    console.error('加载公开备忘录失败:', loadError)
  }
  finally {
    if (currentRequest === requestVersion) {
      loading.value = false
    }
  }
}

watch([username, noteId, isDesktop], () => {
  void loadNote()
}, { immediate: true, flush: 'sync' })

// Framework7 Router retains routed pages for transition history. Release the
// rich-text detail only after its leave animation completes so it cannot flash
// when this cached route is entered again for another note.
onF7ViewDidLeave(() => {
  if (isDesktop.value) {
    return
  }

  requestVersion += 1
  loading.value = true
  error.value = ''
  loadedNoteId.value = ''
})
</script>

<template>
  <UserPublicNotesPage v-if="isDesktop" />
  <NoteDetailPage
    v-else
    :note-id="loadedNoteId"
    :loading="loading"
    :load-error="error"
  />
</template>
