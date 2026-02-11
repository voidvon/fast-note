<script lang="ts" setup>
import type { Note } from '@/types'
import { alertController, IonItem, IonLabel, IonList, IonModal } from '@ionic/vue'
import { ref, toRaw, watch } from 'vue'
import { useNote } from '@/stores'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'
// import NoteMove from './NoteMove.vue'

export type ItemType = 'rename' | 'delete' | 'restore' | 'deleteNow' | 'move'
interface IConfig {
  [key: string]: {
    label: string
    handler: () => void
  }
}

const props = withDefaults(defineProps <{
  id: string
  items: { type: ItemType }[]
  presentingElement?: HTMLElement
}>(), {})

const emit = defineEmits(['refresh'])

const { getNote, updateNote, getNotesByParentId, updateParentFolderSubcount } = useNote()

const modal = ref()
const note = ref<Note | null>(null)
const showMove = ref(false)

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
              note.value!.title = d.newFolderName
              note.value!.updated = getTime()
              await updateNote(note.value!.id, toRaw(note.value!))
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
              note.value!.is_deleted = 1
              await updateNote(note.value!.id, toRaw(note.value!))
              const notes = await getNotesByParentId(note.value!.id)
              for (const note of notes) {
                note.is_deleted = 1
                await updateNote(note.id, note)
              }
              updateParentFolderSubcount(note.value!)
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
      note.value!.is_deleted = 0
      await updateNote(note.value!.id, toRaw(note.value!))
      updateParentFolderSubcount(note.value!)
      emit('refresh')
      dismiss()
    },
  },
  deleteNow: {
    label: '永久删除',
    handler: async () => {
      note.value!.updated = new Date(0).toISOString().replace('T', ' ')
      await updateNote(note.value!.id, toRaw(note.value!))
      emit('refresh')
      dismiss()
    },
  },
  move: {
    label: '移动',
    handler: async () => {
      showMove.value = true
    },
  },
})

watch(() => props.id, () => {
  if (props.id) {
    note.value = getNote(props.id)
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
  <!-- <NoteMove
    :id="id"
    :is-open="showMove"
    :presenting-element
    @did-dismiss="() => showMove = false"
    @refresh="() => {
      $emit('refresh')
      dismiss()
    }"
  /> -->
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
