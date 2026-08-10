<script setup lang="ts">
import type { View } from 'framework7/types'
import { f7View as F7View } from 'framework7-vue'
import { onUnmounted } from 'vue'
import { appRoutes, initializeFramework7Router } from '@/app/router'
import { useTheme } from '@/features/theme-switch'
import { useSessionBootstrap } from '@/processes/session'
import { useVisualViewport } from '@/shared/lib/viewport'
import { F7App } from '@/shared/ui/f7'

const { initTheme, isDarkMode } = useTheme()
const { shouldBlockPrivateRoute, initializeSession, disposeSession } = useSessionBootstrap()

useVisualViewport(true)

const initialUrl = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/home'
const dialogParams = {
  buttonOk: '确认',
  buttonCancel: '取消',
}
const framework7Colors = {
  primary: '#ff9500',
}
const framework7ViewParams = {
  animate: true,
  iosPageLoadDelay: 80,
  mdPageLoadDelay: 80,
}

let initialized = false

async function handleViewInit(view: View.View) {
  initializeFramework7Router(view.router)
  if (initialized)
    return
  initialized = true
  initTheme()
  await initializeSession()
}

onUnmounted(() => {
  disposeSession()
})
</script>

<template>
  <F7App
    id="framework7-root"
    name="Fastnote"
    theme="ios"
    :dark-mode="isDarkMode"
    :colors="framework7Colors"
    :dialog="dialogParams"
    :routes="appRoutes"
    :view="framework7ViewParams"
  >
    <F7View
      main
      :url="initialUrl"
      :routes="appRoutes"
      browser-history
      browser-history-initial-match
      browser-history-separator=""
      :browser-history-animate-on-load="false"
      @view:init="handleViewInit"
    />
    <div v-if="shouldBlockPrivateRoute" data-testid="app-private-route-pending" class="app-private-route-pending" />
  </F7App>
</template>

<style scoped>
.app-private-route-pending {
  position: fixed;
  inset: 0;
  z-index: 12000;
  background: var(--c-page-background);
}
</style>
