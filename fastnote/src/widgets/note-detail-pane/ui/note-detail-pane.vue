<script setup lang="ts">
import type { LeaveFlushReason, SaveTargetContext } from '@/features/note-save'
import type { Note } from '@/shared/types'
import { nanoid } from 'nanoid'
import { computed, nextTick, reactive, ref, toRaw, watch } from 'vue'
import { garbageCollectAttachments, reconcileRemoteNoteAttachmentRefs } from '@/entities/attachment'
import { useNote } from '@/entities/note'
import { useUserPublicNotes } from '@/entities/public-note'
import { useNoteDetailEditorState } from '@/features/note-detail-editor'
import { useNoteDetailEntry } from '@/features/note-detail-entry'
import { useNoteDetailLeave, useNoteDetailLeaveLifecycle } from '@/features/note-detail-leave'
import { useNoteDetailPrivate } from '@/features/note-detail-private'
import { useNoteDetailViewState } from '@/features/note-detail-view'
import { NoteUnlockPanel, useNoteAutoLock, useNoteLock, useNoteLockViewFlow } from '@/features/note-lock'
import { useNoteSave } from '@/features/note-save'
import { useNoteBackButton } from '@/processes/navigation'
import { useSync } from '@/processes/sync-notes'
import { useDeviceType } from '@/shared/lib/device'
import { useAppRoute } from '@/shared/lib/framework7'
import { useVisualViewport } from '@/shared/lib/viewport'
import { F7BackButton, F7Content, F7Icon, F7Link, F7Navbar, F7Page, F7SkeletonText, F7Spinner, isPlatform, onF7ViewWillLeave, toastController } from '@/shared/ui/f7'
import { ellipsisHorizontalCircleOutline } from '@/shared/ui/icons'
import YYEditor from '@/widgets/editor'
import NoteEditorToolbar from '@/widgets/note-editor-toolbar'
import NoteMore from '@/widgets/note-more'

const props = withDefaults(
  defineProps<{
    loadError?: string
    loading?: boolean
    noteId?: string
    parentId?: string
    publicContext?: boolean
  }>(),
  {
    loadError: '',
    loading: false,
    noteId: '',
    parentId: '',
    publicContext: false,
  },
)

const emit = defineEmits(['noteSaved'])

const route = useAppRoute()
// Framework7 keeps detail pages alive while the global route moves on. Capture the
// ownership boundary for this pane so a public reader can never enter the
// private-note save pipeline during leave/pagehide callbacks.
const canPersistPrivateNote = !props.publicContext && !route.params.username
const { addNote, getNote, notes, updateNote, updateParentFolderSubcount, getNotesSync } = useNote()
const { isDesktop } = useDeviceType()
const noteLock = useNoteLock()
const { restoreHeight } = useVisualViewport()
const syncApi = useSync()
const { sync } = syncApi

const isIos = isPlatform('ios')
const isMobilePlatform = isPlatform('mobile')
const pageRef = ref()
const editorRef = ref()
const editorToolbarRef = ref<{ closePanels: () => void } | null>(null)
const data = ref()
const newNoteId = ref<string | null>(null)
const hasCreatedRouteDraft = ref(false)
const isAsyncRouteLeaveSavePending = ref(false)
const retainedEffectiveUuid = ref<string | null>(null)

const state = reactive({
  isFormatModalOpen: false, // 标记格式化面板是否打开
  isMissingPrivateNote: false,
  showNoteMore: false,
})
const idFromRoute = computed(() => route.params.id as string || route.params.noteId as string)
const idFromSource = computed(() => {
  if (props.loading || props.loadError) {
    return ''
  }

  return isDesktop.value ? props.noteId : (props.noteId || idFromRoute.value)
})
const effectiveUuid = computed(() => {
  if (idFromSource.value === '0')
    return newNoteId.value

  return idFromSource.value || retainedEffectiveUuid.value
})
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
  async cleanupAttachments(note) {
    if (note) {
      await reconcileRemoteNoteAttachmentRefs(note)
    }
    await garbageCollectAttachments(notes.value)
  },
  flushNotesToLocal: noteDetailLeave.flushNotesToLocal,
  getCurrentEffectiveUuid() {
    return effectiveUuid.value
  },
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
const noteAutoLock = useNoteAutoLock({
  isMobile: () => isMobilePlatform,
  renewSession: noteLock.renewSession,
  onAutoLock: handleAutomaticRelock,
})
const noteLockView = useNoteLockViewFlow({
  noteLock,
  onLocked() {
    noteAutoLock.deactivate()
    noteDetailEditorState.showLockedNote()
  },
  async onUnlocked(note) {
    await nextTick()
    noteDetailEditorState.showUnlockedNote(note)

    if (noteLock.isPinLockNote(note)) {
      noteAutoLock.activate(note.id)
    }
    else {
      noteAutoLock.deactivate()
    }
  },
})
const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)
// The desktop detail pane can remain mounted while the global route changes;
// use the pane's captured ownership boundary and source id for header actions.
const canShowHeaderActions = computed(() => {
  return canPersistPrivateNote && !!(props.noteId || idFromRoute.value || retainedEffectiveUuid.value || data.value?.id)
})
const shouldRenderHeaderAction = computed(() => {
  return canShowHeaderActions.value || (isDesktop.value && canPersistPrivateNote)
})
const isHeaderActionDisabled = computed(() => !canShowHeaderActions.value)
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

watch(idFromSource, async (id, oldId) => {
  const transition = noteDetailLeave.handleRouteTransition(oldId, id)

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
  triggerLeavePageLocalFlush(reason) {
    if (reason === 'view-leave' && isAsyncRouteLeaveSavePending.value) {
      return
    }

    noteDetailLeave.triggerLeavePageLocalFlush(reason)
  },
})

function triggerAsyncRouteLeaveSave() {
  if (isAsyncRouteLeaveSavePending.value) {
    return
  }

  isAsyncRouteLeaveSavePending.value = true
  noteDetailLeave.clearPendingSaveTimer()

  void handleNoteSaving(false, 'view-leave')
    .finally(() => {
      isAsyncRouteLeaveSavePending.value = false
    })
}

onF7ViewWillLeave(() => {
  if (!isDesktop.value && !isUserContext.value)
    triggerAsyncRouteLeaveSave()
})

async function presentTopError(message: string) {
  try {
    await toastController.dismiss(undefined, undefined, 'note-detail-error-toast')
  }
  catch {
    // Framework7 rejects when there is no matching overlay. There is nothing to
    // dismiss in that case, especially while the detail view is leaving.
  }

  try {
    const toast = await toastController.create({
      id: 'note-detail-error-toast',
      message,
      duration: 2000,
      position: 'top',
      color: 'danger',
    })

    await toast.present()
  }
  catch (error) {
    // Error feedback must never turn a handled save failure into an unhandled
    // promise rejection when the page/overlay has already been destroyed.
    console.warn('显示保存错误提示失败:', error)
  }
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
  forceWrite = false,
) {
  if (!canPersistPrivateNote) {
    noteDetailLeave.clearPendingSaveTimer()
    return
  }

  if (isPinLockedForView.value) {
    if (leaveFlushReason) {
      await noteDetailLeave.flushNotesToLocal(leaveFlushReason)
    }
    return
  }

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
    forceWrite,
    silent,
  })
}

// 防抖保存函数
function debouncedSave(silent = false) {
  if (isEditorBlocked.value) {
    noteDetailLeave.clearPendingSaveTimer()
    return
  }

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

async function handleAutomaticRelock() {
  const note = data.value as Note | null
  if (!note?.id || !noteLock.isPinLockNote(note)) {
    return
  }

  noteDetailLeave.clearPendingSaveTimer()
  await handleNoteSaving(true, 'view-leave', {
    noteId: note.id,
    wasNewNote: false,
  }, true)

  try {
    const result = await noteLock.relock(note.id)
    if (!result.ok) {
      console.error('自动锁定备忘录失败:', result.message)
    }
  }
  catch (error) {
    console.error('自动锁定备忘录失败:', error)
  }
  finally {
    noteLockView.lock()
  }
}

async function persistEditorBeforeLock() {
  const noteId = effectiveUuid.value
  const editor = editorRef.value

  if (!noteId || !editor || data.value?.id !== noteId) {
    throw new Error('当前备忘录尚未加载完成，无法锁定')
  }

  const expectedContent = editor.getContent?.() || ''
  noteDetailLeave.clearPendingSaveTimer()
  await handleNoteSaving(true, null, {
    noteId,
    wasNewNote: false,
  }, true)

  const persistedNote = await getNote(noteId)
  if (!persistedNote || persistedNote.content !== expectedContent) {
    throw new Error('当前编辑内容尚未保存，无法锁定')
  }

  const notesSync = getNotesSync()
  if (!notesSync) {
    throw new Error('本地存储尚未就绪，无法锁定')
  }

  await notesSync.manualSync()
}

async function handleNoteLockUpdated(updatedNote: Note) {
  data.value = updatedNote
  state.showNoteMore = false
  await applyPrivateNoteState(updatedNote)
}
</script>

<template>
  <F7Page ref="pageRef" class="note-detail">
    <F7Navbar
      class="note-detail__toolbar"
      transparent
    >
      <template v-if="!isDesktop" #nav-left>
        <F7BackButton v-bind="backButtonProps" />
      </template>
      <template #nav-right>
        <F7Spinner
          v-if="isNoteSaving"
          class="note-detail__saving-spinner"
          name="crescent"
        />
        <F7Link
          v-if="shouldRenderHeaderAction"
          :id="isDesktop ? 'desktop-note-more-trigger' : 'mobile-note-more-trigger'"
          icon-only
          :class="{ disabled: isHeaderActionDisabled }"
          data-testid="note-more-trigger"
          aria-label="更多操作"
          :aria-disabled="isHeaderActionDisabled || undefined"
          :tabindex="isHeaderActionDisabled ? -1 : undefined"
          tooltip="更多操作"
          :href="false"
          @click="!isHeaderActionDisabled && (state.showNoteMore = true)"
        >
          <F7Icon :icon="ellipsisHorizontalCircleOutline" />
        </F7Link>
      </template>
    </F7Navbar>

    <F7Content class="note-detail__content" force-overscroll>
      <div v-if="loading" class="public-note-skeleton" aria-label="正在加载备忘录">
        <F7SkeletonText animated class="public-note-skeleton__title" />
        <F7SkeletonText animated class="public-note-skeleton__meta" />
        <div class="public-note-skeleton__body">
          <F7SkeletonText v-for="width in ['94%', '87%', '91%', '68%', '89%', '76%']" :key="width" animated :style="{ width }" />
        </div>
      </div>
      <div v-else-if="loadError" class="public-note-load-error" role="alert">
        {{ loadError }}
      </div>
      <div v-else class="note-detail__content-shell">
        <div class="app-padding">
          <div v-if="isMissingPrivateNote" data-testid="note-detail-missing-note" class="note-detail__missing-state">
            当前备忘录不存在或尚未同步完成
          </div>
          <YYEditor
            v-if="effectiveUuid && !isPinLockedForView"
            v-show="!isMissingPrivateNote"
            ref="editorRef"
            :note-id="effectiveUuid || ''"
            @blur="debouncedSave"
          />
        </div>
      </div>
      <NoteUnlockPanel
        v-if="isPinLockedForView"
        class="note-detail__unlock-overlay"
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
      <!-- <div v-if="keyboardHeight > 0" slot="fixed" :style="{ top: `${visualHeight - 66}px` }" class="h-[66px]">
        Fixed Button
      </div> -->
    </F7Content>
    <NoteEditorToolbar
      v-if="effectiveUuid && !isEditorBlocked"
      ref="editorToolbarRef"
      :editor-host="editorRef"
      :is-ios="isIos"
      @update:is-format-modal-open="state.isFormatModalOpen = $event"
    />
    <NoteMore
      v-if="canShowHeaderActions"
      v-model:is-open="state.showNoteMore"
      :note="data"
      :note-id="effectiveUuid || ''"
      :presentation="isDesktop ? 'popover' : 'sheet'"
      :target-el="isDesktop ? '#desktop-note-more-trigger' : '#mobile-note-more-trigger'"
      :prepare-for-lock="persistEditorBeforeLock"
      @note-lock-updated="handleNoteLockUpdated"
    />
  </F7Page>
</template>

<style lang="scss">
.note-detail__toolbar .navbar-bg {
  background: transparent !important;
  background-color: transparent !important;
  backdrop-filter: none;
}

.note-detail__toolbar .navbar-bg::before,
.note-detail__toolbar .navbar-bg::after {
  display: none;
}

.ios .note-detail__toolbar .right:has(> .link:only-child) {
  width: 44px;
  height: 44px;
  align-self: center;
}

.note-detail__toolbar {
  position: absolute;
  z-index: 20;
  top: 0;
  right: 0;
  left: 0;
}

.note-detail {
  --note-editor-toolbar-height: 64px;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.app-page-embedded.note-detail {
  position: relative;
  display: block;
  overflow: clip;
}

.note-detail__content {
  --f7-page-navbar-offset: 0px;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding-top: 0;
  padding-bottom: calc(var(--note-editor-toolbar-height) + var(--f7-safe-area-bottom));
  background: var(--c-page-background);
}

.note-detail > .app-pane-footer,
.note-detail > .app-footer {
  position: absolute;
  z-index: 20;
  right: 0;
  bottom: 0;
  left: 0;
  min-height: calc(var(--note-editor-toolbar-height) + var(--f7-safe-area-bottom));
}

.note-detail__saving-spinner {
  width: 18px;
  height: 18px;
  color: var(--c-text-secondary);
}

.note-detail__missing-state {
  padding: 16px;
  border-radius: 12px;
  background: var(--c-list-hover-background);
  color: var(--c-text-secondary);
  text-align: center;
}

.public-note-skeleton {
  padding: calc(var(--f7-navbar-height) + var(--f7-safe-area-top) + 28px) 20px 28px;
}

.public-note-skeleton__title {
  width: min(72%, 320px);
  height: 32px;
  margin: 0 0 14px;
}

.public-note-skeleton__meta {
  width: 112px;
  height: 14px;
  margin: 0 0 36px;
}

.public-note-skeleton__body {
  display: grid;
  gap: 15px;
}

.public-note-skeleton__body .skeleton-text {
  height: 16px;
  margin: 0;
}

.public-note-load-error {
  display: grid;
  min-height: 50vh;
  padding: calc(var(--f7-navbar-height) + var(--f7-safe-area-top) + 24px) 24px 24px;
  place-items: center;
  color: var(--c-text-secondary);
  text-align: center;
}

.note-detail__content-shell {
  position: relative;
  box-sizing: border-box;
  min-height: 100%;
  padding-top: 0;
}

.note-detail__unlock-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: var(--c-page-background);
}
</style>

<style scoped>
.app-list-item {
  --inner-padding-end: 0;
  --background: transparent;
}

.app-label {
  margin-top: 12px;
  margin-bottom: 12px;
}

.app-list-item h2 {
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

.app-list-item .date {
  align-items: center;
  display: flex;
}

.app-list-item .app-icon {
  font-size: 42px;
  margin-right: 8px;
}

.app-list-item .app-note {
  font-size: 0.9375rem;
  margin-right: 12px;
  font-weight: normal;
}

p {
  line-height: 1.4;
}
</style>
