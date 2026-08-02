<script setup lang="ts">
import { computed, watch } from 'vue'
import FolderPage from '@/pages/folder'
import UserPublicNotesPage from '@/pages/user-public-notes'
import { loadPublicNote } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'
import { useAppRoute } from '@/shared/lib/framework7'

const route = useAppRoute()
const { isDesktop } = useDeviceType()

const username = computed(() => route.params.username as string || '')
const folderId = computed(() => {
  const pathMatch = route.params.pathMatch
  const path = Array.isArray(pathMatch) ? pathMatch.join('/') : pathMatch || ''
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] || ''
})

watch([username, folderId, isDesktop], ([currentUsername, currentFolderId, desktop]) => {
  if (desktop || !currentUsername || !currentFolderId || currentFolderId === 'allnotes' || currentFolderId === 'unfilednotes') {
    return
  }

  void loadPublicNote(currentUsername, currentFolderId).catch((error) => {
    console.error('加载公开文件夹信息失败:', error)
  })
}, { immediate: true })
</script>

<template>
  <UserPublicNotesPage v-if="isDesktop" />
  <FolderPage v-else />
</template>
