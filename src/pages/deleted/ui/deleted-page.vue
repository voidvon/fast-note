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
} from '@ionic/vue'
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useNote } from '@/entities/note'
import { useSimpleBackButton } from '@/processes/navigation'
import { useDeviceType } from '@/shared/lib/device'
import NoteList from '@/widgets/note-list'

const props = withDefaults(defineProps<{
  selectedNoteId?: string
}>(), {
  selectedNoteId: '',
})

defineEmits(['selected'])

const { notes } = useNote()
const { isDesktop } = useDeviceType()

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/home', '备忘录')

const dataList = computed<FolderTreeNode[]>(() => {
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ')
  return notes.value
    .filter(note => note.is_deleted === 1 && note.updated >= thirtyDaysAgo)
    .map(note => ({ originNote: note, children: [] }))
})
const state = reactive({
  windowWidth: 0,
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
        :note-uuid="props.selectedNoteId"
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
