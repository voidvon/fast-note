import Framework7Vue from 'framework7-vue'
import Accordion from 'framework7/components/accordion'
import Actions from 'framework7/components/actions'
import Dialog from 'framework7/components/dialog'
import InfiniteScroll from 'framework7/components/infinite-scroll'
import Input from 'framework7/components/input'
import Popover from 'framework7/components/popover'
import Popup from 'framework7/components/popup'
import Preloader from 'framework7/components/preloader'
import PullToRefresh from 'framework7/components/pull-to-refresh'
import Searchbar from 'framework7/components/searchbar'
import Sheet from 'framework7/components/sheet'
import Toast from 'framework7/components/toast'
import Toggle from 'framework7/components/toggle'
import Tooltip from 'framework7/components/tooltip'
import VirtualList from 'framework7/components/virtual-list'
import Framework7 from 'framework7/lite'
import { createApp } from 'vue'
import App from '@/App.vue'

Framework7.use([
  Accordion,
  Actions,
  Dialog,
  InfiniteScroll,
  Input,
  Popover,
  Popup,
  Preloader,
  PullToRefresh,
  Searchbar,
  Sheet,
  Toast,
  Toggle,
  Tooltip,
  VirtualList,
])

export function createVueApp() {
  const app = createApp(App)
    .use(Framework7Vue as any, {
      theme: 'ios',
    })

  ;(window as any).__VUE_APP__ = app

  return {
    app,
  }
}
