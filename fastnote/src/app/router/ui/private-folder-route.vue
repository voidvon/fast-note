<script setup lang="ts">
import FolderPage from '@/pages/folder'
import HomePage from '@/pages/home'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
</script>

<template>
  <HomePage v-if="isDesktop" />
  <FolderPage v-else />
</template>
