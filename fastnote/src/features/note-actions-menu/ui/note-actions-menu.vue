<script lang="ts" setup>
import type { NoteActionMenuItem } from '../model/types'
import type { Note } from '@/entities/note'
import { alertController, IonItem, IonLabel, IonList, IonModal } from '@ionic/vue'
import { ref, watch } from 'vue'
import { NOTE_TYPE } from '@/entities/note'
import { cleanupIonicOverlayLocksAsync } from '@/shared/lib/ionic'
import { useNoteActionsMenu } from '../model/use-note-actions-menu'

interface IConfig {
  [key: string]: {
    label: string
    handler: () => void
  }
}

const props = withDefaults(defineProps <{
  id: string
  isOpen: boolean
  items: NoteActionMenuItem[]
  presentingElement?: HTMLElement
}>(), {})

const emit = defineEmits(['refresh', 'move', 'did-dismiss'])

const { deleteNote, deleteNow, getNoteById, renameNote, restoreNote } = useNoteActionsMenu()

const modal = ref()
const note = ref<Note | null>(null)

const dismiss = () => modal.value.$el.dismiss()

function handleDidDismiss() {
  cleanupIonicOverlayLocksAsync()
  emit('did-dismiss')
}

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
  <IonModal
    ref="modal"
    :is-open="isOpen"
    :focus-trap="false"
    id="long-press-menu"
    @did-dismiss="handleDidDismiss"
  >
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
  --border-radius: 14px;
  --box-shadow: 0 28px 48px rgba(0, 0, 0, 0.4);
}

.long-press-menu {
  overflow: hidden;
  border-radius: 14px;
  background: rgba(20, 20, 24, 0.94);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}

.long-press-menu :deep(.list-ios),
.long-press-menu :deep(.list-md) {
  padding: 0;
  background: transparent;
}

.long-press-menu :deep(ion-item) {
  --background: transparent;
  --border-width: 0;
  --inner-border-width: 0;
  --padding-start: 16px;
  --inner-padding-end: 16px;
  min-height: 48px;
  color: #f5f5f7;
}
</style>
