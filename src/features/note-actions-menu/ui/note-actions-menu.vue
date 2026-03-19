<script lang="ts" setup>
import type { NoteActionMenuItem } from '../model/types'
import type { Note } from '@/entities/note'
import { alertController, IonItem, IonLabel, IonList, IonModal } from '@ionic/vue'
import { ref, watch } from 'vue'
import { NOTE_TYPE } from '@/entities/note'
import { useNoteActionsMenu } from '../model/use-note-actions-menu'

interface IConfig {
  [key: string]: {
    label: string
    handler: () => void
  }
}

const props = withDefaults(defineProps <{
  id: string
  items: NoteActionMenuItem[]
  presentingElement?: HTMLElement
}>(), {})

const emit = defineEmits(['refresh', 'move'])

const { deleteNote, deleteNow, getNoteById, renameNote, restoreNote } = useNoteActionsMenu()

const modal = ref()
const note = ref<Note | null>(null)

const dismiss = () => modal.value.$el.dismiss()

const config = ref<IConfig>({
  rename: {
    label: '重命名',
    handler: async () => {
      const alert = await alertController.create({
        header: note.value?.item_type === NOTE_TYPE.FOLDER ? '请输入新的文件夹名称' : '请输入新的标题',
        buttons: [
          { text: '取消', role: 'cancel', handler: () => dismiss() },
          {
            text: '确认',
            handler: async (d) => {
              if (!note.value) {
                return
              }

              note.value = await renameNote(note.value.id, d.newFolderName)
              dismiss()
              emit('refresh')
            },
          },
        ],
        inputs: [{ name: 'newFolderName', placeholder: '请输入文件夹名称', value: note.value?.title }],
      })

      await alert.present()
    },
  },
  delete: {
    label: '删除',
    handler: async () => {
      const alert = await alertController.create({
        header: note.value?.item_type === NOTE_TYPE.FOLDER ? '确定要删除此文件夹吗？' : '要删除此备忘录吗？',
        message: '所有备忘录和子文件夹都将删除，删除后在“最近删除”中保留 30 天',
        buttons: [
          { text: '取消', role: 'cancel', handler: () => dismiss() },
          {
            text: '确认',
            handler: async () => {
              if (!note.value) {
                return
              }

              note.value = await deleteNote(note.value.id)
              emit('refresh')
              dismiss()
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
      dismiss()
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
      dismiss()
    },
  },
  move: {
    label: '移动',
    handler: async () => {
      dismiss() // 先关闭当前 Modal
      // 通知父组件打开移动对话框
      emit('move', note.value?.id)
    },
  },
})

watch(() => props.id, () => {
  if (props.id) {
    note.value = getNoteById(props.id)
  }
})
</script>

<template>
  <IonModal v-bind="$attrs" id="long-press-menu" ref="modal">
    <div class="long-press-menu">
      <IonList lines="none">
        <IonItem v-for="d in $props.items" :key="d.type" :button="true" :detail="false" @click="config[d.type].handler">
          <IonLabel>{{ config[d.type].label }}</IonLabel>
        </IonItem>
      </IonList>
    </div>
  </IonModal>
</template>

<style lang="scss">
ion-modal#long-press-menu {
  --width: fit-content;
  --min-width: 250px;
  --height: fit-content;
  --border-radius: 6px;
  --box-shadow: 0 28px 48px rgba(0, 0, 0, 0.4);
}
</style>
