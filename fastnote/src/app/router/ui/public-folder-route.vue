<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
const FolderPage = defineAsyncComponent(() => import('@/pages/folder'))
const UserPublicNotesPage = defineAsyncComponent(() => import('@/pages/user-public-notes'))
</script>

<template>
  <UserPublicNotesPage v-if="isDesktop" />
  <FolderPage v-else />
</template>
