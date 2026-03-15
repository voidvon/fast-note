import { IonicVue } from '@ionic/vue'
import VConsole from 'vconsole'
import { createApp } from 'vue'
import { initializeDatabase } from '@/database'
import { initializeNotes } from '@/stores'
import App from './App.vue'
import router from './router'

import 'core-js/stable/array/to-sorted'

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'
/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'

import '@ionic/vue/css/typography.css'
/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

import '@ionic/vue/css/display.css'

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
// import '@ionic/vue/css/palettes/dark.system.css'
import '@ionic/vue/css/palettes/dark.class.css'
/* Theme variables */
import './theme/variables.css'

import './css/common.scss'

import 'virtual:uno.css'

const vConsole = new VConsole({ theme: 'dark' })

const app = createApp(App)
  .use(IonicVue as any, {
    mode: 'ios',
  })
  .use(router)

// 将Vue应用实例存储在全局对象中，以便扩展可以访问
;(window as any).__VUE_APP__ = app
;(window as any).__VCONSOLE__ = vConsole

async function bootstrapApp() {
  try {
    await Promise.all([
      router.isReady(),
      (async () => {
        await initializeDatabase()
        await initializeNotes()
      })(),
    ])
  }
  catch (error) {
    console.error('应用初始化失败:', error)
  }
  finally {
    // 即使初始化失败也要挂载应用，避免白屏
    app.mount('#app')
  }
}

bootstrapApp()
