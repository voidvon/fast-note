<script setup lang="ts">
import type { NoteLockSetupResult } from '@/hooks/useNoteLock'
import type { Note } from '@/types'
import { IonCol, IonGrid, IonModal, IonRow, toastController, useIonRouter } from '@ionic/vue'
import { lockClosed, lockOpen, shareOutline, trashOutline } from 'ionicons/icons'
import { computed, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import IconTextButton from '@/components/IconTextButton.vue'
import NoteLockManageModal from '@/components/NoteLockManageModal.vue'
import NoteLockSetupModal from '@/components/NoteLockSetupModal.vue'
import { useDexie } from '@/database'
import { useNoteLock } from '@/hooks/useNoteLock'
import { useNote } from '@/stores'
import { getTime } from '@/utils/date'

const props = withDefaults(defineProps<{
  isOpen: boolean
  noteId?: string
}>(), {})

const emit = defineEmits(['noteLockUpdated', 'update:isOpen'])

const route = useRoute()
const router = useIonRouter()
const { updateNote, getNote, updateParentFolderSubcount } = useNote()
const noteLock = useNoteLock()
const { db } = useDexie()

const modalRef = ref()
const note = ref<Note | undefined>(undefined)
const pendingLockModal = ref<'setup' | 'manage' | null>(null)
const lockModalState = reactive({
  defaultBiometricEnabled: false,
  hasGlobalPin: false,
  manageOpen: false,
  isOpen: false,
})
const currentNoteId = computed(() => props.noteId || route.params.id as string || '')

async function onWillPresent() {
  const result = await getNote(currentNoteId.value)
  if (result) {
    note.value = result
  }
}

// 获取所有子级笔记（递归）
async function getAllChildrenNotes(noteUuid: string): Promise<Note[]> {
  const children = await db.value.notes
    .where('parent_id')
    .equals(noteUuid)
    .and((item: Note) => item.is_deleted !== 1)
    .toArray()

  let allChildren: Note[] = [...children]

  for (const child of children) {
    if (child.id) {
      const grandChildren = await getAllChildrenNotes(child.id)
      allChildren = [...allChildren, ...grandChildren]
    }
  }

  return allChildren
}

// 获取父级笔记
async function getParentNote(parentId: string | null): Promise<Note | null> {
  if (!parentId)
    return null
  return await db.value.notes.where('id').equals(parentId).first() || null
}

// 递归获取所有父级笔记
async function getAllParentNotes(currentNote: Note): Promise<Note[]> {
  const parents: Note[] = []
  let current = currentNote

  while (current.parent_id) {
    const parent = await getParentNote(current.parent_id)
    if (parent) {
      parents.push(parent)
      current = parent
    }
    else {
      break
    }
  }

  return parents
}

async function onShare() {
  if (!note.value?.id)
    return

  try {
    const now = getTime()
    const isPublic = !note.value.is_public

    if (isPublic) {
      // 启用分享：遍历父级，把全部父级的is_public改为true
      note.value.is_public = true
      note.value.updated = now
      await updateNote(note.value.id, note.value)

      // 获取所有父级并设置为公开
      const parents = await getAllParentNotes(note.value)
      for (const parent of parents) {
        if (!parent.is_public) {
          await updateNote(parent.id!, {
            ...parent,
            is_public: true,
            updated: now,
          })
        }
      }
    }
    else {
      // 取消分享：先把当前note的is_public改为false
      note.value.is_public = false
      note.value.updated = now
      await updateNote(note.value.id, { ...note.value })

      // 遍历父级，检查父级的全部子级、孙级是否有is_public为true
      const parents = await getAllParentNotes(note.value)
      for (const parent of parents) {
        if (parent.is_public) {
          // 获取该父级的所有子级和孙级
          const allChildren = await getAllChildrenNotes(parent.id!)

          // 检查是否还有公开的子级
          const hasPublicChildren = allChildren.some(child => child.is_public)

          if (!hasPublicChildren) {
            // 如果没有公开的子级，则将父级设为私有
            await updateNote(parent.id!, {
              ...parent,
              is_public: false,
              updated: now,
            })
          }
        }
      }
    }

    // 显示操作结果提示
    const toast = await toastController.create({
      message: isPublic ? '已启用分享' : '已取消分享',
      duration: 2000,
      position: 'bottom',
      color: 'success',
    })
    await toast.present()
  }
  catch (error) {
    console.error('分享操作异常:', error)
    // 显示错误提示
    const toast = await toastController.create({
      message: '操作失败，请重试',
      duration: 2000,
      position: 'bottom',
      color: 'danger',
    })
    await toast.present()
  }
  finally {
    emit('update:isOpen', false)
  }
}

async function onLock() {
  if (!note.value?.id) {
    return
  }

  const deviceState = await noteLock.getDeviceSecurityState()
  lockModalState.defaultBiometricEnabled = deviceState.biometric_enabled === 1
  lockModalState.hasGlobalPin = await noteLock.hasGlobalPin(true)
  pendingLockModal.value = noteLock.isPinLockNote(note.value) ? 'manage' : 'setup'
  emit('update:isOpen', false)
}

function onMoreModalDidDismiss() {
  emit('update:isOpen', false)

  if (pendingLockModal.value === 'manage') {
    lockModalState.manageOpen = true
  }
  else if (pendingLockModal.value === 'setup') {
    lockModalState.isOpen = true
  }

  pendingLockModal.value = null
}

async function onLockConfirmed(payload: NoteLockSetupResult & { note: Note }) {
  note.value = payload.note
  emit('noteLockUpdated', payload.note)

  const message = payload.message || (payload.note.is_locked === 1 ? '已启用备忘录锁' : '已更新备忘录锁')
  const color = payload.code === 'ok' ? 'success' : 'warning'

  const toast = await toastController.create({
    message,
    duration: 2200,
    position: 'top',
    color,
  })

  await toast.present()
}

async function onLockManaged(payload: {
  action: 'change_global_pin' | 'toggle_biometric' | 'relock' | 'disable_lock'
  note: Note
  biometricEnabled: boolean
  code: string
  message: string | null
}) {
  note.value = payload.note
  lockModalState.defaultBiometricEnabled = payload.biometricEnabled
  emit('noteLockUpdated', payload.note)

  const messageMap = {
    change_global_pin: '已更新全局 PIN',
    disable_lock: '已关闭备忘录锁',
    relock: '已重新锁定',
    toggle_biometric: payload.biometricEnabled ? '已启用生物识别快捷解锁' : '已关闭生物识别快捷解锁',
  } as const

  const toast = await toastController.create({
    message: payload.message || messageMap[payload.action],
    duration: payload.code === 'ok' ? 1500 : 2200,
    position: 'top',
    color: payload.code === 'ok' ? 'success' : 'warning',
  })

  await toast.present()
}

async function onDelete() {
  const id = route.params.id
  const note = await getNote(id as string)
  const now = getTime()
  if (note?.id) {
    await updateNote(note.id, { ...note, is_deleted: 1, updated: now })
    updateParentFolderSubcount(note)
    router.back()
    emit('update:isOpen', false)
  }
}
</script>

<template>
  <IonModal
    ref="modalRef"
    v-bind="$attrs"
    :is-open="isOpen"
    :initial-breakpoint="0.5"
    :breakpoints="[0, 0.5, 1]"
    @will-present="onWillPresent"
    @did-dismiss="onMoreModalDidDismiss"
  >
    <div>
      <IonGrid>
        <IonRow>
          <IonCol size="3" class="grid-item">
            <IconTextButton
              :icon="note?.is_locked === 1 ? lockOpen : lockClosed"
              class="c-blue-500"
              :text="note?.is_locked === 1 ? '锁设置' : '锁定'"
              color="primary"
              @click="onLock"
            />
          </IonCol>
          <IonCol size="3" class="grid-item">
            <IconTextButton
              :icon="shareOutline"
              class="c-green-500"
              :text="note?.is_public ? '取消' : '分享'"
              color="success"
              @click="onShare"
            />
          </IonCol>
          <IonCol size="3" class="grid-item">
            <IconTextButton
              :icon="trashOutline"
              class="danger"
              text="删除"
              color="danger"
              @click="onDelete"
            />
          </IonCol>
        </IonRow>
      </IonGrid>
    </div>
  </IonModal>
  <NoteLockSetupModal
    v-if="note?.id"
    v-model:is-open="lockModalState.isOpen"
    :note-id="note.id"
    :device-supports-biometric="noteLock.isBiometricSupported()"
    :default-biometric-enabled="lockModalState.defaultBiometricEnabled"
    :has-global-pin="lockModalState.hasGlobalPin"
    @confirm="onLockConfirmed"
  />
  <NoteLockManageModal
    v-if="note?.id"
    v-model:is-open="lockModalState.manageOpen"
    :note-id="note.id"
    :note="note"
    :device-supports-biometric="noteLock.isBiometricSupported()"
    :biometric-enabled="lockModalState.defaultBiometricEnabled"
    @updated="onLockManaged"
  />
</template>

<style lang="scss">
ion-popover.note-more {
  --background: #111;
  --box-shadow: 0 5px 10px 0 rgba(0, 0, 0, 0.6);
}
.note-more {
  .list-ios {
    --ion-item-background: #111;
  }
}
</style>
