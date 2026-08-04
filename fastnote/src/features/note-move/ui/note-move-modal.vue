<script setup lang="ts">
import type { FolderTreeNode } from '@/entities/note'
import { nextTick, ref } from 'vue'
import { F7Button, F7Icon, F7Modal, F7PageContent, F7Toolbar } from '@/shared/ui/f7'
import { closeOutline } from '@/shared/ui/icons'
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

async function onWillPresent() {
  dataList.value = createMoveTree()
  const folderIds = findFoldersWithChildren(dataList.value)
  await nextTick()
  noteListRef.value?.setExpandedItems(folderIds)
}
</script>

<template>
  <F7Modal
    ref="modalRef"
    :is-open
    push
    class="note-move-modal"
    v-bind="$attrs"
    @will-present="onWillPresent"
  >
    <template #fixed>
      <F7Toolbar class="note-move-header">
        <h2>选择文件夹</h2>
        <F7Button
          class="note-move-close"
          fill="clear"
          title="关闭"
          aria-label="关闭文件夹列表"
          @click="dismiss()"
        >
          <F7Icon :icon="closeOutline" />
        </F7Button>
      </F7Toolbar>
    </template>
    <F7PageContent class="note-move-content">
      <NoteList
        ref="noteListRef"
        :data-list="dataList"
        :forward-wheel="false"
        disabled-route
        disabled-long-press
        @selected="onSelected"
      />
    </F7PageContent>
  </F7Modal>
</template>

<style lang="scss">
.note-move-modal {
  --f7-sheet-height: min(60vh, 480px);
  --f7-sheet-bg-color: var(--c-modal-background);

  .app-sheet-handle {
    display: none;
  }
}

.note-move-header {
  --f7-toolbar-height: 44px;
  --f7-toolbar-bg-color: var(--c-modal-background);

  border-bottom: 1px solid var(--c-border);

  .toolbar-inner {
    justify-content: space-between;
    padding: 0 12px 0 16px;
  }

  h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 600;
    letter-spacing: 0;
  }
}

.note-move-close {
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
}

.note-move-content {
  padding: 8px 12px 12px;

  .note-list-container > .list {
    margin: 0;
  }
}

.ios .note-move-content {
  padding-top: calc(var(--f7-toolbar-height) + 8px);
}
</style>
