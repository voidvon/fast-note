import type { App as VueApp } from 'vue'
import type { Router } from 'vue-router'
import { prepareSessionContext } from '@/processes/session'

interface BootstrapAppOptions {
  app: VueApp
  router: Router
}

export async function bootstrapApp({ app, router }: BootstrapAppOptions) {
  try {
    await Promise.all([
      router.isReady(),
      prepareSessionContext(),
    ])
  }
  catch (error) {
    console.error('应用初始化失败:', error)
  }
  finally {
    app.mount('#app')
  }
}
