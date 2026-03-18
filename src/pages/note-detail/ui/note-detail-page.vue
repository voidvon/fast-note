<script setup lang="ts">
import type { LeaveFlushReason, SaveTargetContext } from '@/features/note-save'
import type { Note } from '@/shared/types'
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonToolbar, isPlatform, toastController } from '@ionic/vue'
import { ellipsisHorizontalCircleOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, nextTick, reactive, ref, toRaw, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useNote } from '@/entities/note'
import { useUserPublicNotes } from '@/entities/public-note'
import { useNoteDetailEditorState } from '@/features/note-detail-editor'
import { useNoteDetailEntry } from '@/features/note-detail-entry'
import { useNoteDetailLeave, useNoteDetailLeaveLifecycle } from '@/features/note-detail-leave'
import { useNoteDetailPrivate } from '@/features/note-detail-private'
import { useNoteDetailViewState } from '@/features/note-detail-view'
import { NoteUnlockPanel, useNoteLock, useNoteLockViewFlow } from '@/features/note-lock'
import { useNoteSave } from '@/features/note-save'
import { useNoteBackButton } from '@/processes/navigation'
import { useSync } from '@/processes/sync-notes'
import { useDeviceType } from '@/shared/lib/device'
import { useVisualViewport } from '@/shared/lib/viewport'
import YYEditor from '@/widgets/editor'
import NoteEditorToolbar from '@/widgets/note-editor-toolbar'
import NoteMore from '@/widgets/note-more'

const props = withDefaults(
  defineProps<{
    noteId?: string
    parentId?: string
  }>(),
  {
    noteId: '',
    parentId: '',
  },
)

const emit = defineEmits(['noteSaved'])

const route = useRoute()
const { addNote, getNote, updateNote, updateParentFolderSubcount, getNotesSync } = useNote()
const { isDesktop } = useDeviceType()
const noteLock = useNoteLock()
const { restoreHeight } = useVisualViewport()
const syncApi = useSync()
const { sync } = syncApi

const isIos = isPlatform('ios')
const pageRef = ref()
const editorRef = ref()
const editorToolbarRef = ref<{ closePanels: () => void } | null>(null)
const data = ref()
const newNoteId = ref<string | null>(null)
const hasCreatedRouteDraft = ref(false)
const retainedEffectiveUuid = ref<string | null>(null)

const state = reactive({
  isFormatModalOpen: false, // 标记格式化面板是否打开
  isMissingPrivateNote: false,
  showNoteMore: false,
})
const idFromRoute = computed(() => route.params.id as string || route.params.noteId as string)
const idFromSource = computed(() => props.noteId || idFromRoute.value)
const noteDetailLeave = useNoteDetailLeave({
  getDraftId() {
    return newNoteId.value
  },
  getEffectiveUuid() {
    return idFromSource.value === '0'
      ? newNoteId.value
      : (idFromSource.value || retainedEffectiveUuid.value)
  },
  getNotesSync,
  isDesktop() {
    return isDesktop.value
  },
  isRouteDraftCreated() {
    return hasCreatedRouteDraft.value
  },
  onSave: handleNoteSaving,
})
const {
  isSaving: isNoteSaving,
  lastSavedContent,
  saveNote,
} = useNoteSave({
  addNote,
  getNote,
  updateNote,
  updateParentFolderSubcount,
  sync,
  restoreHeight,
  presentTopError,
  flushNotesToLocal: noteDetailLeave.flushNotesToLocal,
  emitNoteSaved(payload) {
    emit('noteSaved', payload)
  },
  getCurrentNote() {
    return toRaw(data.value)
  },
  setCurrentNote(note) {
    data.value = note
  },
  setMissingPrivateNote(value) {
    state.isMissingPrivateNote = value
  },
  onMissingPrivateNote() {
    editorRef.value?.setContent('')
    editorRef.value?.setEditable(false)
  },
  onRouteDraftCreated(noteId) {
    hasCreatedRouteDraft.value = true

    if (!isDesktop.value)
      replaceMobileDraftUrl(noteId)
  },
})
const noteDetailEditorState = useNoteDetailEditorState({
  getEditor() {
    return editorRef.value
  },
  setLastSavedContent(content) {
    lastSavedContent.value = content
  },
})
const noteLockView = useNoteLockViewFlow({
  noteLock,
  onLocked() {
    noteDetailEditorState.showLockedNote()
  },
  onUnlocked(note) {
    noteDetailEditorState.showUnlockedNote(note)
  },
})
const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)
const privateNoteDetail = useNoteDetailPrivate({
  getNote,
  onLoaded: applyPrivateNoteState,
  onMissing() {
    state.isMissingPrivateNote = true
    lastSavedContent.value = ''
    noteDetailEditorState.showMissingPrivateNote()
  },
  repairMissingPrivateNoteIfNeeded: syncApi.repairMissingPrivateNoteIfNeeded,
})
const noteDetailEntry = useNoteDetailEntry({
  applyPublicNote(note) {
    data.value = note || null
    if (!note) {
      lastSavedContent.value = ''
      return
    }

    noteDetailEditorState.showReadOnlyNote(note)
  },
  async clearSelection() {
    data.value = null
    lastSavedContent.value = ''
    noteDetailEditorState.clearSelection()
  },
  createDraftId() {
    return nanoid(12)
  },
  async enterNewDraft(draftId) {
    data.value = null
    newNoteId.value = draftId
    lastSavedContent.value = ''
    await nextTick()
    noteDetailEditorState.showNewDraft()
  },
  getPublicNote(id) {
    return useUserPublicNotes(username.value).getPublicNote(id) || null
  },
  loadPrivateNote: privateNoteDetail.loadPrivateNote,
  resetLockView: noteLockView.reset,
  resetMissingPrivateNote() {
    state.isMissingPrivateNote = false
  },
})
const isNewNote = computed(() => idFromSource.value === '0' && !hasCreatedRouteDraft.value)
const {
  canShowNoteActions,
  isEditorBlocked,
  isMissingPrivateNote,
  isPinLockedForView,
} = useNoteDetailViewState({
  getCurrentNote() {
    return data.value
  },
  getLockViewState() {
    return noteLockView.state.viewState
  },
  isNewNote() {
    return isNewNote.value
  },
  isPinLockNote(note) {
    return noteLock.isPinLockNote(note)
  },
  isUserContext() {
    return isUserContext.value
  },
  isMissingPrivateNoteState() {
    return state.isMissingPrivateNote
  },
})

watch(isEditorBlocked, (blocked) => {
  if (blocked) {
    state.isFormatModalOpen = false
  }
})

// 智能返回按钮
const { backButtonProps } = useNoteBackButton(route, data, username.value)

const effectiveUuid = computed(() => {
  if (idFromSource.value === '0')
    return newNoteId.value

  return idFromSource.value || retainedEffectiveUuid.value
})

watch(idFromSource, async (id, oldId) => {
  const transition = await noteDetailLeave.handleRouteTransition(oldId, id)

  if (id) {
    retainedEffectiveUuid.value = null
  }

  if (id !== oldId) {
    privateNoteDetail.reset()
    hasCreatedRouteDraft.value = false
  }

  if (id && id !== '0') {
    await openExistingEntry(id)
  }
  else if (id === '0') {
    await noteDetailEntry.openNewDraft()
  }
  else if (!isNewNote.value) { // This condition means id is falsy (e.g. '', undefined)
    // 移动端返回时保留详情页内容到转场结束，避免底层列表页露出时看到正文被提前清空。
    if (transition.isMobileLeavingDetailPage) {
      retainedEffectiveUuid.value = transition.previousEffectiveId
      return
    }

    await noteDetailEntry.clearDetailSelection()
  }
}, { immediate: true })

useNoteDetailLeaveLifecycle({
  clearPendingSaveTimer: noteDetailLeave.clearPendingSaveTimer,
  closeToolbarPanels() {
    editorToolbarRef.value?.closePanels()
  },
  onDetailDidLeave() {
    retainedEffectiveUuid.value = null
  },
  triggerLeavePageLocalFlush: noteDetailLeave.triggerLeavePageLocalFlush,
})

async function presentTopError(message: string) {
  await toastController.dismiss(undefined, undefined, 'note-detail-error-toast')

  const toast = await toastController.create({
    id: 'note-detail-error-toast',
    message,
    duration: 2000,
    position: 'top',
    color: 'danger',
  })

  await toast.present()
}

function replaceMobileDraftUrl(noteId: string) {
  if (typeof window === 'undefined')
    return

  window.history.replaceState(null, '', `/n/${noteId}`)
}

async function applyPrivateNoteState(note: Note) {
  data.value = note
  state.isMissingPrivateNote = false
  privateNoteDetail.reset()
  await noteLockView.applyNoteState(note)
}

async function handleNoteSaving(
  silent = false,
  leaveFlushReason: LeaveFlushReason | null = null,
  saveTargetContext: SaveTargetContext = {},
) {
  await saveNote({
    editor: editorRef.value,
    effectiveUuid: effectiveUuid.value,
    isNewNote: isNewNote.value,
    isDesktop: isDesktop.value,
    parentId: props.parentId,
    routeParentId: route.query.parent_id,
    isFormatModalOpen: state.isFormatModalOpen,
    isMissingPrivateNote: isMissingPrivateNote.value,
    leaveFlushReason,
    saveTargetContext,
    silent,
  })
}

// 防抖保存函数
function debouncedSave(silent = false) {
  noteDetailLeave.debouncedSave(silent)
}

async function openExistingEntry(id: string) {
  try {
    await noteDetailEntry.openExisting(id, isUserContext.value)
  }
  catch (error) {
    console.error('初始化笔记失败:', error)
  }
}

// function onFormat(command: string) {
//   editorRef.value.format(command)
// }

async function handlePinUnlock(pin: string) {
  if (!data.value?.id) {
    return
  }

  await noteLockView.unlockWithPin(data.value, pin)
}

async function handleBiometricUnlock() {
  if (!data.value?.id) {
    return
  }

  await noteLockView.unlockWithBiometric(data.value)
}

async function handleNoteLockUpdated(updatedNote: Note) {
  data.value = updatedNote
  state.showNoteMore = false
  await applyPrivateNoteState(updatedNote)
}
</script>

<template>
  <IonPage ref="pageRef">
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" />
        </IonButtons>
        <IonButtons v-if="canShowNoteActions" slot="end" class="note-detail__header-buttons">
          <IonSpinner
            v-if="isNoteSaving"
            class="note-detail__saving-spinner"
            name="crescent"
          />
          <IonButton @click="state.showNoteMore = true">
            <IonIcon :icon="ellipsisHorizontalCircleOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent force-overscroll>
      <NoteUnlockPanel
        v-if="isPinLockedForView"
        :lock-view-state="noteLockView.state.viewState"
        :biometric-enabled="noteLockView.state.biometricEnabled"
        :device-supports-biometric="noteLockView.state.deviceSupportsBiometric"
        :failed-attempts="noteLockView.state.failedAttempts"
        :cooldown-until="noteLockView.state.cooldownUntil"
        :error-message="noteLockView.state.errorMessage"
        :is-submitting="noteLockView.state.isPinUnlocking"
        @try-biometric="handleBiometricUnlock"
        @submit-pin="handlePinUnlock"
      />
      <div v-else class="ion-padding">
        <div v-if="isMissingPrivateNote" data-testid="note-detail-missing-note" class="note-detail__missing-state">
          当前备忘录不存在或尚未同步完成
        </div>
        <YYEditor
          v-if="effectiveUuid"
          v-show="!isMissingPrivateNote"
          ref="editorRef"
          @blur="debouncedSave"
        />
      </div>
      <!-- <div v-if="keyboardHeight > 0" slot="fixed" :style="{ top: `${visualHeight - 66}px` }" class="h-[66px]">
        Fixed Button
      </div> -->
    </IonContent>
    <NoteEditorToolbar
      v-if="!isEditorBlocked"
      ref="editorToolbarRef"
      :editor-host="editorRef"
      :is-ios="isIos"
      @update:is-format-modal-open="state.isFormatModalOpen = $event"
    />
    <NoteMore
      v-if="canShowNoteActions"
      v-model:is-open="state.showNoteMore"
      :note-id="effectiveUuid || ''"
      @note-lock-updated="handleNoteLockUpdated"
    />
  </IonPage>
</template>

<style lang="scss">
.note-detail__header-buttons {
  align-items: center;
  gap: 4px;
}

.note-detail__saving-spinner {
  width: 18px;
  height: 18px;
  color: var(--ion-color-medium);
}

.note-detail__missing-state {
  padding: 16px;
  border-radius: 12px;
  background: var(--ion-color-light, #f4f5f8);
  color: var(--ion-color-medium-shade, #666);
  text-align: center;
}
</style>

<style scoped>
ion-item {
  --inner-padding-end: 0;
  --background: transparent;
}

ion-label {
  margin-top: 12px;
  margin-bottom: 12px;
}

ion-item h2 {
  font-weight: 600;

  /**
   * With larger font scales
   * the date/time should wrap to the next
   * line. However, there should be
   * space between the name and the date/time
   * if they can appear on the same line.
   */
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

ion-item .date {
  align-items: center;
  display: flex;
}

ion-item ion-icon {
  font-size: 42px;
  margin-right: 8px;
}

ion-item ion-note {
  font-size: 0.9375rem;
  margin-right: 12px;
  font-weight: normal;
}

p {
  line-height: 1.4;
}
</style>
