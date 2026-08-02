<script setup lang="ts">
import type { FolderTreeNode } from '@/entities/note'
import { ref } from 'vue'
import { F7Button, F7Buttons, F7Content, F7Header, F7Modal, F7Title, F7Toolbar } from '@/shared/ui/f7'
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
  <F7Modal ref="modalRef" :is-open v-bind="$attrs" @will-present="onWillPersent">
    <F7Header>
      <F7Toolbar>
        <F7Title>选择文件夹</F7Title>
        <F7Buttons position="end">
          <F7Button @click="dismiss()">
            取消
          </F7Button>
        </F7Buttons>
      </F7Toolbar>
    </F7Header>
    <F7Content>
      <NoteList ref="noteListRef" :data-list="dataList" disabled-route disabled-long-press @selected="onSelected" />
    </F7Content>
  </F7Modal>
</template>
