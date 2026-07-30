<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
const NoteDetailPage = defineAsyncComponent(() => import('@/pages/note-detail'))
const UserPublicNotesPage = defineAsyncComponent(() => import('@/pages/user-public-notes'))
</script>

<template>
  <UserPublicNotesPage v-if="isDesktop" />
  <NoteDetailPage v-else />
</template>
