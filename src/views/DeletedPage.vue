<script setup lang="ts">
import type { FolderTreeNode } from '@/types'
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  onIonViewWillEnter,
} from '@ionic/vue'
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import NoteList from '@/components/NoteList.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useSimpleBackButton } from '@/hooks/useSmartBackButton'
import { useNote } from '@/stores'

defineEmits(['selected'])

const { getDeletedNotes } = useNote()
const { isDesktop } = useDeviceType()

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/home', '备忘录')

const dataList = ref<FolderTreeNode[]>([])
const state = reactive({
  windowWidth: 0,
})

function init() {
  getDeletedNotes().then((res) => {
    dataList.value = res.map(note => ({ originNote: note, children: [] }))
  })
}

onIonViewWillEnter(() => {
  if (!isDesktop.value)
    init()
})

// 更新窗口宽度的函数
function updateWindowWidth() {
  state.windowWidth = window.innerWidth
}

// 组件挂载时添加监听
onMounted(() => {
  state.windowWidth = window.innerWidth
  window.addEventListener('resize', updateWindowWidth)
})

// 组件卸载时移除监听
onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <IonPage>
    <IonHeader v-if="!isDesktop" :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            最近删除
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <NoteList
        :data-list="dataList"
        :press-items="[{ type: 'restore' }, { type: 'deleteNow' }]"
        @selected="$emit('selected', $event)"
      />
    </IonContent>
    <IonFooter v-if="!isDesktop">
      <IonToolbar>
        <IonTitle>
          {{ dataList.length > 0 ? `${dataList.length}个备忘录` : '无备忘录' }}
        </IonTitle>
      </IonToolbar>
    </IonFooter>
  </IonPage>
</template>
