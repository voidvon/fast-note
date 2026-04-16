<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
const HomePage = defineAsyncComponent(() => import('@/pages/home'))
const NoteDetailPage = defineAsyncComponent(() => import('@/pages/note-detail'))
</script>

<template>
  <HomePage v-if="isDesktop" />
  <NoteDetailPage v-else />
</template>
