import VConsole from 'vconsole'
import { bootstrapApp } from '@/app/bootstrap/bootstrap-app'
import { createVueApp } from '@/app/providers/create-vue-app'
import '@/app/styles'
import 'core-js/stable/array/to-sorted'

const globalWindow = window as typeof window & {
  __fastnoteVConsole?: VConsole
}

if (!globalWindow.__fastnoteVConsole) {
  globalWindow.__fastnoteVConsole = new VConsole()
}

const { app, router } = createVueApp()

void bootstrapApp({ app, router })
