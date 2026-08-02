<script setup lang="ts">
import HomePage from '@/pages/home'
import NoteDetailPage from '@/pages/note-detail'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
</script>

<template>
  <HomePage v-if="isDesktop" />
  <NoteDetailPage v-else />
</template>
