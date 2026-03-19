<script setup lang="ts">
import type { FolderTreeNode } from '@/entities/note'
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/vue'
import { ref } from 'vue'
import NoteList from '@/widgets/note-list/ui/note-list.vue'
import { useNoteMove } from '../model/use-note-move'

const props = withDefaults(defineProps<{
  isOpen: boolean
  id: string
}>(), {})

const emit = defineEmits(['refresh'])

const { createMoveTree, findFoldersWithChildren, getNote, moveNote } = useNoteMove()

const modalRef = ref()
const noteListRef = ref()
const dataList = ref<FolderTreeNode[]>([])

const dismiss = () => modalRef.value.$el.dismiss()

async function onSelected(id: string) {
  const currentNote = getNote(props.id)
  if (currentNote) {
    await moveNote(currentNote.id, id)
  }

  dismiss()
  emit('refresh')
}

function onWillPersent() {
  dataList.value = createMoveTree()
  const folderIds = findFoldersWithChildren(dataList.value)
  noteListRef.value.setExpandedItems(folderIds)
}
</script>

<template>
  <IonModal ref="modalRef" :is-open v-bind="$attrs" @will-present="onWillPersent">
    <IonHeader>
      <IonToolbar>
        <IonTitle>选择文件夹</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="dismiss()">
            取消
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <NoteList ref="noteListRef" :data-list="dataList" disabled-route disabled-long-press @selected="onSelected" />
    </IonContent>
  </IonModal>
</template>
