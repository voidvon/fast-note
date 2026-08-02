import { bootstrapApp } from '@/app/bootstrap/bootstrap-app'
import { createVueApp } from '@/app/providers/create-vue-app'
import '@/app/styles'
import 'core-js/stable/array/to-sorted'

const { app } = createVueApp()

void bootstrapApp({ app })
