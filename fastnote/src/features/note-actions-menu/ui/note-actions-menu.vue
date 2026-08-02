<script lang="ts" setup>
import type { NoteActionMenuItem } from '../model/types'
import type { Note } from '@/entities/note'
import { ref, watch } from 'vue'
import { NOTE_TYPE } from '@/entities/note'
import { cleanupOverlayLocksAsync } from '@/shared/lib/framework7'
import {
  alertController,
  dialogController,
  F7Actions,
  F7ActionsButton,
  F7ActionsGroup,
  F7ActionsLabel,
} from '@/shared/ui/f7'
import { useNoteActionsMenu } from '../model/use-note-actions-menu'

interface IConfig {
  [key: string]: {
    label: string
    handler: () => Promise<void> | void
  }
}

const props = withDefaults(defineProps <{
  id: string
  isOpen: boolean
  items: NoteActionMenuItem[]
  presentingElement?: HTMLElement
}>(), {})

const emit = defineEmits(['refresh', 'move', 'didDismiss'])

const { deleteNote, deleteNow, getNoteById, renameNote, restoreNote } = useNoteActionsMenu()

const note = ref<Note | null>(null)

function handleDidDismiss() {
  cleanupOverlayLocksAsync()
  emit('didDismiss')
}

const config = ref<IConfig>({
  rename: {
    label: '重命名',
    handler: async () => {
      const currentNote = note.value
      if (!currentNote) {
        return
      }

      const nextTitle = await dialogController.prompt({
        title: currentNote.item_type === NOTE_TYPE.FOLDER ? '重命名文件夹' : '重命名备忘录',
        text: currentNote.item_type === NOTE_TYPE.FOLDER ? '请输入新的文件夹名称' : '请输入新的标题',
        defaultValue: currentNote.title,
      })
      if (nextTitle === null) {
        return
      }

      note.value = await renameNote(currentNote.id, nextTitle)
      emit('refresh')
    },
  },
  delete: {
    label: '删除',
    handler: async () => {
      const alert = await alertController.create({
        header: note.value?.item_type === NOTE_TYPE.FOLDER ? '确定要删除此文件夹吗？' : '要删除此备忘录吗？',
        message: '所有备忘录和子文件夹都将删除，删除后在“最近删除”中保留 30 天',
        buttons: [
          { text: '取消', role: 'cancel' },
          {
            text: '确认',
            handler: async () => {
              if (!note.value) {
                return
              }

              note.value = await deleteNote(note.value.id)
              emit('refresh')
            },
          },
        ],
      })

      await alert.present()
    },
  },
  restore: {
    label: '恢复',
    handler: async () => {
      if (!note.value) {
        return
      }

      note.value = await restoreNote(note.value.id)
      emit('refresh')
    },
  },
  deleteNow: {
    label: '永久删除',
    handler: async () => {
      if (!note.value) {
        return
      }

      note.value = await deleteNow(note.value.id)
      emit('refresh')
    },
  },
  move: {
    label: '移动',
    handler: () => {
      emit('move', note.value?.id)
    },
  },
})

watch(() => [props.id, props.isOpen], () => {
  if (props.id && props.isOpen) {
    note.value = getNoteById(props.id)
  }
  else if (!props.isOpen) {
    note.value = null
  }
})
</script>

<template>
  <F7Actions
    id="long-press-menu"
    :opened="isOpen"
    :convert-to-popover="false"
    :close-on-escape="true"
    @actions:closed="handleDidDismiss"
  >
    <F7ActionsGroup>
      <F7ActionsLabel v-if="note?.title">
        {{ note.title }}
      </F7ActionsLabel>
      <F7ActionsButton
        v-for="item in items"
        :key="item.type"
        :color="item.type === 'delete' || item.type === 'deleteNow' ? 'red' : undefined"
        @click="config[item.type].handler"
      >
        {{ config[item.type].label }}
      </F7ActionsButton>
    </F7ActionsGroup>
    <F7ActionsGroup>
      <F7ActionsButton strong>
        取消
      </F7ActionsButton>
    </F7ActionsGroup>
  </F7Actions>
</template>
