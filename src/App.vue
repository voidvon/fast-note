<script setup lang="ts">
import { IonApp, IonRouterOutlet } from '@ionic/vue'
import { onMounted, onUnmounted } from 'vue'
import { useTheme } from '@/features/theme-switch'
import { useSessionBootstrap } from '@/processes/session'
import { useVisualViewport } from '@/shared/lib/viewport'

const { initTheme } = useTheme()
const { shouldBlockPrivateRoute, initializeSession, disposeSession } = useSessionBootstrap()

useVisualViewport(true)

onMounted(async () => {
  initTheme()
  await initializeSession()
})

onUnmounted(() => {
  disposeSession()
})
</script>

<template>
  <IonApp>
    <div v-if="shouldBlockPrivateRoute" data-testid="app-private-route-pending" class="app-private-route-pending" />
    <IonRouterOutlet v-else />
  </IonApp>
</template>

<style scoped>
.app-private-route-pending {
  width: 100%;
  min-height: 100vh;
}
</style>
