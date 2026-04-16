<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import { useDeviceType } from '@/shared/lib/device'

const { isDesktop } = useDeviceType()
const HomePage = defineAsyncComponent(() => import('@/pages/home'))
const FolderPage = defineAsyncComponent(() => import('@/pages/folder'))
</script>

<template>
  <HomePage v-if="isDesktop" />
  <FolderPage v-else />
</template>
