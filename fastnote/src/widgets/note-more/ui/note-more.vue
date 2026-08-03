<script setup lang="ts">
import type { NoteLockManageUpdate, NoteLockSetupResult } from '@/features/note-lock'
import type { Note } from '@/shared/types'
import {
  f7Link as F7Link,
  f7List as F7List,
  f7ListItem as F7ListItem,
  f7PageContent as F7PageContent,
  f7Toolbar as F7Toolbar,
} from 'framework7-vue'
import { computed, ref, watch } from 'vue'
import { useNote } from '@/entities/note'
import { useNoteDelete } from '@/features/note-delete'
import { NoteLockManageModal, NoteLockSetupModal, useNoteLockModalFlow } from '@/features/note-lock'
import { PublicNoteAccessModal } from '@/features/public-note-share'
import { useAuth } from '@/processes/session'
import { useSync } from '@/processes/sync-notes'
import { cleanupOverlayLocksAsync, useAppRoute } from '@/shared/lib/framework7'
import Dropdown from '@/shared/ui/dropdown'
import { alertController, F7Modal, toastController, useAppRouter } from '@/shared/ui/f7'
import { globeOutline, lockClosed, lockOpen, trashOutline } from '@/shared/ui/icons'

const props = withDefaults(defineProps<{
  isOpen: boolean
  note?: Note
  noteId?: string
  presentation?: 'popover' | 'sheet'
  prepareForLock: () => Promise<void>
  targetEl?: string
}>(), {
  presentation: 'sheet',
  targetEl: '#note-more-trigger',
})

const emit = defineEmits(['noteLockUpdated', 'update:isOpen'])

const route = useAppRoute()
const router = useAppRouter()
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

const note = ref<Note | undefined>(props.note)
const publicAccessOpen = ref(false)
const publicAccessPending = ref(false)
const currentNoteId = computed(() => props.noteId || route.params.id as string || '')

async function onWillPresent() {
  const result = props.note || await getNote(currentNoteId.value)
  if (result) {
    note.value = result
  }
}

watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    void onWillPresent()
  }
}, { immediate: true })

function getCurrentNote() {
  if (note.value?.id) {
    return note.value
  }

  const result = props.note || getNote(currentNoteId.value)
  if (result) {
    note.value = result
  }
  return result
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
  const currentNote = getCurrentNote()
  if (!currentNote?.id) {
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
  const currentNote = getCurrentNote()
  if (!currentNote?.id) {
    return
  }

  await prepareLockModal(currentNote)
  dismiss()
}

function onMoreModalDidDismiss() {
  emit('update:isOpen', false)
  cleanupOverlayLocksAsync()
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
  const currentNote = getCurrentNote()
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
  <component
    :is="presentation === 'popover' ? Dropdown : F7Modal"
    v-bind="$attrs"
    :is-open="isOpen"
    :target-el="presentation === 'popover' ? targetEl : undefined"
    :size="presentation === 'popover' ? 'compact' : undefined"
    :initial-breakpoint="presentation === 'sheet' ? 1 : undefined"
    :breakpoints="presentation === 'sheet' ? [0, 1] : undefined"
    class="note-more-modal"
    :class="`note-more-modal--${presentation}`"
    @did-dismiss="onMoreModalDidDismiss"
  >
    <F7Toolbar v-if="presentation === 'sheet'" top class="note-more-sheet__toolbar">
      <div class="left note-more-sheet__title">
        备忘录操作
      </div>
      <div class="right">
        <F7Link @click="dismiss">
          完成
        </F7Link>
      </div>
    </F7Toolbar>

    <component
      :is="presentation === 'popover' ? 'div' : F7PageContent"
      class="note-more-content"
      :class="{ 'note-more-sheet': presentation === 'sheet' }"
    >
      <F7List
        strong
        inset
        :class="{ 'app-dropdown__list': presentation === 'popover' }"
      >
        <F7ListItem
          link
          :href="false"
          no-chevron
          :title="note?.is_locked === 1 ? '锁设置' : '锁定备忘录'"
          data-testid="note-more-lock-action"
          @click="onLock"
        >
          <template #media>
            <component
              :is="note?.is_locked === 1 ? lockOpen : lockClosed"
              class="note-more-sheet__icon app-dropdown__icon"
              aria-hidden="true"
            />
          </template>
        </F7ListItem>
        <F7ListItem
          link
          :href="false"
          no-chevron
          title="公开设置"
          data-testid="note-more-public-action"
          @click="onPublicAccess"
        >
          <template #media>
            <component
              :is="globeOutline"
              class="note-more-sheet__icon app-dropdown__icon app-dropdown__icon--success"
              aria-hidden="true"
            />
          </template>
        </F7ListItem>
        <F7ListItem
          link
          :href="false"
          no-chevron
          title="删除备忘录"
          text-color="red"
          data-testid="note-more-delete-action"
          @click="onDelete"
        >
          <template #media>
            <component
              :is="trashOutline"
              class="note-more-sheet__icon app-dropdown__icon app-dropdown__icon--danger"
              aria-hidden="true"
            />
          </template>
        </F7ListItem>
      </F7List>
    </component>
  </component>
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
  --f7-sheet-height: min(360px, 60vh);
  --f7-sheet-border-radius: 24px;
}

.note-more-sheet {
  --f7-page-toolbar-top-offset: var(--f7-toolbar-height);

  overflow-y: auto;
  background: var(--c-page-background);
}

.note-more-sheet__toolbar {
  --f7-toolbar-bg-color: var(--c-list-background);
  --f7-toolbar-border-color: var(--c-border);
}

.note-more-sheet__title {
  padding-left: 16px;
  color: var(--c-text-primary);
  font-size: 17px;
  font-weight: 600;
}

.note-more-sheet__icon {
  width: 24px;
  height: 24px;
}
</style>
