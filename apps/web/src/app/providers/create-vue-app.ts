import { IonicVue } from '@ionic/vue'
import { createApp } from 'vue'
import App from '@/App.vue'
import router from '@/app/router'

export function createVueApp() {
  const app = createApp(App)
    .use(IonicVue as any, {
      mode: 'ios',
    })
    .use(router)

  ;(window as any).__VUE_APP__ = app

  return {
    app,
    router,
  }
}
