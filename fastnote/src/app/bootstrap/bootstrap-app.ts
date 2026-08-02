import type { App as VueApp } from 'vue'
import { prepareSessionContext } from '@/processes/session'

interface BootstrapAppOptions {
  app: VueApp
}

function dismissAppLoading() {
  const loading = document.getElementById('app-loading')
  if (!loading) {
    return
  }

  const remove = () => loading.remove()
  loading.classList.add('app-loading--hidden')
  loading.addEventListener('transitionend', remove, { once: true })
  window.setTimeout(remove, 250)
}

export async function bootstrapApp({ app }: BootstrapAppOptions) {
  try {
    await prepareSessionContext()
  }
  catch (error) {
    console.error('应用初始化失败:', error)
  }
  finally {
    app.mount('#app')
    window.requestAnimationFrame(dismissAppLoading)
  }
}
