<script setup lang="ts">
import type { NoteLockManageUpdate, NoteLockSetupResult } from '@/features/note-lock'
import type { Note } from '@/shared/types'
import { alertController, IonCol, IonGrid, IonModal, IonRow, toastController, useIonRouter } from '@ionic/vue'
import { globeOutline, lockClosed, lockOpen, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useNote } from '@/entities/note'
import { useNoteDelete } from '@/features/note-delete'
import { NoteLockManageModal, NoteLockSetupModal, useNoteLockModalFlow } from '@/features/note-lock'
import { PublicNoteAccessModal } from '@/features/public-note-share'
import { useAuth } from '@/processes/session'
import { useSync } from '@/processes/sync-notes'
import { cleanupIonicOverlayLocksAsync } from '@/shared/lib/ionic'
import IconTextButton from '@/shared/ui/icon-text-button'

const props = withDefaults(defineProps<{
  isOpen: boolean
  noteId?: string
  prepareForLock: () => Promise<void>
}>(), {})

const emit = defineEmits(['noteLockUpdated', 'update:isOpen'])

const route = useRoute()
const router = useIonRouter()
const { sync } = useSync()
const { updateNote, getNote, updateParentFolderSubcount } = useNote()
const { deleteNote } = useNoteDelete({
  updateNote,
  updateParentFolderSubcount,
})
const { currentUser, isLoggedIn } = useAuth()
const {
  buildManageFeedback,
  buildSetupFeedback,
  isBiometricSupported,
  lockModalState,
  openPendingLockModal,
  prepareLockModal,
} = useNoteLockModalFlow()

const note = ref<Note | undefined>(undefined)
const publicAccessOpen = ref(false)
const publicAccessPending = ref(false)
const currentNoteId = computed(() => props.noteId || route.params.id as string || '')

async function onWillPresent() {
  const result = await getNote(currentNoteId.value)
  if (result) {
    note.value = result
  }
}

function dismiss() {
  emit('update:isOpen', false)
}

async function syncLockNoteChange(fallbackMessage: string) {
  try {
    await sync(true)
    return null
  }
  catch (error) {
    console.error('同步备忘录锁状态失败:', error)
    return fallbackMessage
  }
}

async function onPublicAccess() {
  if (!note.value?.id) {
    return
  }

  if (!isLoggedIn.value) {
    const alert = await alertController.create({
      header: '请先登录',
      message: '登录后才能公开备忘录',
      buttons: [
        {
          text: '取消',
          role: 'cancel',
        },
        {
          text: '去登录',
          handler: () => {
            dismiss()
            router.push('/login')
          },
        },
      ],
    })
    await alert.present()
    return
  }

  publicAccessPending.value = true
  dismiss()
}

async function onLock() {
  if (!note.value?.id) {
    return
  }

  await prepareLockModal(note.value)
  dismiss()
}

function onMoreModalDidDismiss() {
  emit('update:isOpen', false)
  cleanupIonicOverlayLocksAsync()
  openPendingLockModal()

  if (publicAccessPending.value) {
    publicAccessPending.value = false
    publicAccessOpen.value = true
  }
}

async function onPublicAccessUpdated(updatedNote: Note) {
  note.value = updatedNote

  try {
    await sync(true)
  }
  catch (error) {
    console.error('同步备忘录公开状态失败:', error)
    const toast = await toastController.create({
      message: '已在当前设备更新公开状态，但同步失败，请稍后重试',
      duration: 2200,
      position: 'top',
      color: 'warning',
    })
    await toast.present()
  }
}

async function onLockConfirmed(payload: NoteLockSetupResult & { note: Note }) {
  const feedback = buildSetupFeedback(payload)
  const syncErrorMessage = await syncLockNoteChange('已在当前设备更新备忘录锁，但同步失败，请稍后重试')
  note.value = feedback.note
  emit('noteLockUpdated', feedback.note)

  const toast = await toastController.create({
    message: syncErrorMessage || feedback.message,
    duration: syncErrorMessage ? 2200 : feedback.duration,
    position: 'top',
    color: syncErrorMessage ? 'warning' : feedback.color,
  })

  await toast.present()
}

async function onLockManaged(payload: NoteLockManageUpdate) {
  const feedback = buildManageFeedback(payload)
  const syncErrorMessage = payload.action === 'disable_lock' || payload.action === 'relock'
    ? await syncLockNoteChange('已在当前设备更新备忘录锁，但同步失败，请稍后重试')
    : null
  note.value = feedback.note
  emit('noteLockUpdated', feedback.note)

  const toast = await toastController.create({
    message: syncErrorMessage || feedback.message,
    duration: syncErrorMessage ? 2200 : feedback.duration,
    position: 'top',
    color: syncErrorMessage ? 'warning' : feedback.color,
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
  dismiss()
}
</script>

<template>
  <IonModal
    v-bind="$attrs"
    :is-open="isOpen"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    class="note-more-modal note-more-modal--sheet"
    @will-present="onWillPresent"
    @did-dismiss="onMoreModalDidDismiss"
  >
    <div class="note-more-sheet">
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
              :icon="globeOutline"
              class="c-green-500"
              text="公开"
              color="success"
              @click="onPublicAccess"
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
  <PublicNoteAccessModal
    v-if="note?.id"
    v-model:is-open="publicAccessOpen"
    :note="note"
    :username="currentUser?.username"
    @updated="onPublicAccessUpdated"
  />
  <NoteLockSetupModal
    v-if="note?.id"
    v-model:is-open="lockModalState.isOpen"
    :note-id="note.id"
    :device-supports-biometric="isBiometricSupported()"
    :default-biometric-enabled="lockModalState.defaultBiometricEnabled"
    :has-global-pin="lockModalState.hasGlobalPin"
    :prepare-for-lock="prepareForLock"
    @confirm="onLockConfirmed"
  />
  <NoteLockManageModal
    v-if="note?.id"
    v-model:is-open="lockModalState.manageOpen"
    :note-id="note.id"
    :note="note"
    :device-supports-biometric="isBiometricSupported()"
    :biometric-enabled="lockModalState.defaultBiometricEnabled"
    :prepare-for-lock="prepareForLock"
    @updated="onLockManaged"
  />
</template>

<style lang="scss">
.note-more-modal--sheet {
  --height: fit-content;
  --max-height: 260px;
  --border-radius: 24px 24px 0 0;

  &::part(content) {
    max-height: 260px;
  }
}

.note-more-sheet {
  padding: 20px 20px 24px;
  background: var(--c-blue-gray-900);
  color: var(--c-text-primary);
}
</style>
