<script setup lang="ts">
import type { NoteLockManageUpdate, NoteLockSetupResult } from '@/features/note-lock'
import type { Note } from '@/shared/types'
import { IonCol, IonGrid, IonModal, IonRow, toastController, useIonRouter } from '@ionic/vue'
import { lockClosed, lockOpen, shareOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNote } from '@/entities/note'
import { useNoteDelete } from '@/features/note-delete'
import { NoteLockManageModal, NoteLockSetupModal, useNoteLockModalFlow } from '@/features/note-lock'
import { usePublicNoteShare } from '@/features/public-note-share'
import IconTextButton from '@/shared/ui/icon-text-button'

const props = withDefaults(defineProps<{
  isOpen: boolean
  noteId?: string
}>(), {})

const emit = defineEmits(['noteLockUpdated', 'update:isOpen'])

const route = useRoute()
const router = useIonRouter()
const { updateNote, getNote, updateParentFolderSubcount } = useNote()
const { deleteNote } = useNoteDelete({
  updateNote,
  updateParentFolderSubcount,
})
const { toggleShare } = usePublicNoteShare({
  updateNote,
})
const {
  buildManageFeedback,
  buildSetupFeedback,
  isBiometricSupported,
  lockModalState,
  openPendingLockModal,
  prepareLockModal,
} = useNoteLockModalFlow()

const modalRef = ref()
const note = ref<Note | undefined>(undefined)
const currentNoteId = computed(() => props.noteId || route.params.id as string || '')

async function onWillPresent() {
  const result = await getNote(currentNoteId.value)
  if (result) {
    note.value = result
  }
}

async function onShare() {
  if (!note.value?.id) {
    return
  }

  const feedback = await toggleShare(note.value)
  const toast = await toastController.create({
    message: feedback.message,
    duration: 2000,
    position: 'bottom',
    color: feedback.color,
  })
  await toast.present()
  emit('update:isOpen', false)
}

async function onLock() {
  if (!note.value?.id) {
    return
  }

  await prepareLockModal(note.value)
  emit('update:isOpen', false)
}

function onMoreModalDidDismiss() {
  emit('update:isOpen', false)
  openPendingLockModal()
}

async function onLockConfirmed(payload: NoteLockSetupResult & { note: Note }) {
  const feedback = buildSetupFeedback(payload)
  note.value = feedback.note
  emit('noteLockUpdated', feedback.note)

  const toast = await toastController.create({
    message: feedback.message,
    duration: feedback.duration,
    position: 'top',
    color: feedback.color,
  })

  await toast.present()
}

async function onLockManaged(payload: NoteLockManageUpdate) {
  const feedback = buildManageFeedback(payload)
  note.value = feedback.note
  emit('noteLockUpdated', feedback.note)

  const toast = await toastController.create({
    message: feedback.message,
    duration: feedback.duration,
    position: 'top',
    color: feedback.color,
  })

  await toast.present()
}

async function onDelete() {
  const currentNote = note.value || await getNote(route.params.id as string)
  if (!currentNote?.id) {
    return
  }

  const result = await deleteNote(currentNote)
  note.value = result.note
  router.back()
  emit('update:isOpen', false)
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
    :device-supports-biometric="isBiometricSupported()"
    :default-biometric-enabled="lockModalState.defaultBiometricEnabled"
    :has-global-pin="lockModalState.hasGlobalPin"
    @confirm="onLockConfirmed"
  />
  <NoteLockManageModal
    v-if="note?.id"
    v-model:is-open="lockModalState.manageOpen"
    :note-id="note.id"
    :note="note"
    :device-supports-biometric="isBiometricSupported()"
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
