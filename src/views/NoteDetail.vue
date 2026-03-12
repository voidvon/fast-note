<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import type { Note } from '@/types'
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonPage, IonSpinner, IonToolbar, isPlatform, onIonViewWillLeave, toastController } from '@ionic/vue'
import { attachOutline, checkmarkCircleOutline, ellipsisHorizontalCircleOutline, textOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { useRoute } from 'vue-router'
import Icon from '@/components/Icon.vue'
import NoteMore from '@/components/NoteMore.vue'
import NoteUnlockPanel from '@/components/NoteUnlockPanel.vue'
import TableFormatModal from '@/components/TableFormatModal.vue'
import TextFormatModal from '@/components/TextFormatModal.vue'
import YYEditor from '@/components/YYEditor.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useNoteLock } from '@/hooks/useNoteLock'
import { useNoteBackButton } from '@/hooks/useSmartBackButton'
import { useSync } from '@/hooks/useSync'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { useNote, useUserPublicNotes } from '@/stores'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

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
const fileInputRef = ref()
const imageInputRef = ref()
const data = ref()
const newNoteId = ref<string | null>(null)
const hasCreatedRouteDraft = ref(false)
const missingPrivateNoteRepairId = ref<string | null>(null)
const lastSavedContent = ref<string>('') // 记录上次保存的内容
const saveTimer = ref<number | null>(null) // 防抖定时器

const state = reactive({
  isFormatModalOpen: false, // 标记格式化面板是否打开
  isMissingPrivateNote: false,
  lockBiometricEnabled: false,
  lockDeviceSupportsBiometric: false,
  isPinUnlocking: false,
  isSaving: false,
  lockCooldownUntil: null as number | null,
  lockErrorMessage: '',
  lockFailedAttempts: 0,
  lockViewState: 'unlocked' as 'unlocked' | 'locked' | 'unlocking' | 'cooldown',
  showFormat: false,
  showNoteMore: false,
  showTableFormat: false,
})

const idFromRoute = computed(() => route.params.id as string || route.params.noteId as string)
const idFromSource = computed(() => props.noteId || idFromRoute.value)
const isNewNote = computed(() => idFromSource.value === '0' && !hasCreatedRouteDraft.value)
const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)
const isMissingPrivateNote = computed(() => !isUserContext.value && !isNewNote.value && state.isMissingPrivateNote)
const isReadOnly = computed(() => isUserContext.value || data.value?.is_deleted === 1)
const isPinLockedForView = computed(() => {
  return !!data.value && noteLock.isPinLockNote(data.value) && state.lockViewState !== 'unlocked'
})
const isEditorBlocked = computed(() => {
  return isReadOnly.value || isMissingPrivateNote.value || isPinLockedForView.value
})
const canShowNoteActions = computed(() => {
  return !isEditorBlocked.value && !!data.value?.id
})

// 智能返回按钮
const { backButtonProps } = useNoteBackButton(route, data, username.value)

function syncNewNoteEditorState() {
  if (!editorRef.value) {
    return
  }

  editorRef.value.setContent('')
  editorRef.value.setEditable(true)
  editorRef.value.applyDefaultNewNoteHeading?.()

  nextTick(() => {
    setTimeout(() => {
      editorRef.value?.focus()
    }, 100)
  })
}

watch(isNewNote, (isNew) => {
  if (isNew && !newNoteId.value)
    newNoteId.value = nanoid(12)
}, { immediate: true })

watch(editorRef, (editorInstance) => {
  if (editorInstance && idFromSource.value === '0') {
    syncNewNoteEditorState()
  }
})

const effectiveUuid = computed(() => {
  if (idFromSource.value === '0')
    return newNoteId.value

  return idFromSource.value
})

watch(idFromSource, async (id, oldId) => {
  const previousEffectiveId = oldId === '0' ? newNoteId.value : oldId
  const previousWasNewNote = oldId === '0' && !hasCreatedRouteDraft.value

  // 桌面端详情页常驻，切换选中项就是“离开当前笔记”。
  if (oldId && oldId !== id && isDesktop.value) {
    await handleNoteSaving(true, null, {
      noteId: previousEffectiveId,
      wasNewNote: previousWasNewNote,
    })
  }

  if (id !== oldId) {
    missingPrivateNoteRepairId.value = null
    hasCreatedRouteDraft.value = false
  }

  if (id && id !== '0') {
    state.isMissingPrivateNote = false
    init(id)
  }
  else if (id === '0') {
    state.isMissingPrivateNote = false
    state.lockViewState = 'unlocked'
    state.lockErrorMessage = ''
    state.lockFailedAttempts = 0
    state.lockBiometricEnabled = false
    state.lockDeviceSupportsBiometric = false
    state.lockCooldownUntil = null
    // 新建笔记，立即清空编辑器和数据
    data.value = null
    newNoteId.value = nanoid(12)
    lastSavedContent.value = '' // 重置上次保存的内容

    syncNewNoteEditorState()
  }
  else if (!isNewNote.value) { // This condition means id is falsy (e.g. '', undefined)
    state.isMissingPrivateNote = false
    state.lockViewState = 'unlocked'
    state.lockErrorMessage = ''
    state.lockFailedAttempts = 0
    state.lockBiometricEnabled = false
    state.lockDeviceSupportsBiometric = false
    state.lockCooldownUntil = null
    // No note selected, clear editor
    data.value = null
    lastSavedContent.value = '' // 重置上次保存的内容
    // Using nextTick to ensure editorRef is available
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.setContent('')
        editorRef.value.setEditable(true)
      }
    })
  }
}, { immediate: true })

watch(() => state.showTableFormat, (n) => {
  state.isFormatModalOpen = n
  changeFormatModal(n)
})
watch(() => state.showFormat, (n) => {
  state.isFormatModalOpen = n
  changeFormatModal(n)
})

function changeFormatModal(n: boolean) {
  if (n) {
    editorRef.value?.setInputMode('none')
    setTimeout(() => {
      editorRef.value?.editor.chain().focus()
    }, 500)
  }
  else {
    editorRef.value?.setInputMode('text')
    setTimeout(() => {
      editorRef.value?.editor.chain().blur()
      setTimeout(() => {
        editorRef.value?.editor.chain().focus()
      }, 300)
    }, 10)
  }
}

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

function syncMissingPrivateNoteState() {
  if (!editorRef.value)
    return

  editorRef.value.setContent('')
  editorRef.value.setEditable(false)
}

function syncLockedNoteState() {
  if (!editorRef.value)
    return

  editorRef.value.setContent('')
  editorRef.value.setEditable(false)
}

function syncUnlockedNoteState(note: Note) {
  nextTick(() => {
    editorRef.value?.setEditable(note.is_deleted !== 1)
    editorRef.value?.setContent(note.content || '')
    lastSavedContent.value = note.content || ''
  })
}

async function refreshPinLockState(note: Note) {
  const snapshot = await noteLock.getLockViewState(note.id, note)
  state.lockViewState = snapshot.viewState
  state.lockFailedAttempts = snapshot.failedAttempts
  state.lockCooldownUntil = snapshot.cooldownUntil
  state.lockBiometricEnabled = snapshot.biometricEnabled
  state.lockDeviceSupportsBiometric = snapshot.deviceSupportsBiometric

  if (snapshot.viewState !== 'cooldown') {
    state.lockErrorMessage = ''
  }

  return snapshot
}

async function applyPrivateNoteState(note: Note) {
  data.value = note
  state.isMissingPrivateNote = false
  missingPrivateNoteRepairId.value = null

  if (noteLock.isPinLockNote(note)) {
    const lockSnapshot = await refreshPinLockState(note)
    if (lockSnapshot.viewState !== 'unlocked') {
      syncLockedNoteState()
      return
    }
  }
  else {
    state.lockViewState = 'unlocked'
    state.lockFailedAttempts = 0
    state.lockBiometricEnabled = false
    state.lockDeviceSupportsBiometric = false
    state.lockCooldownUntil = null
    state.lockErrorMessage = ''
  }

  syncUnlockedNoteState(note)
}

type LeaveFlushReason = 'view-leave' | 'pagehide' | 'beforeunload'
interface SaveTargetContext {
  noteId?: string | null
  wasNewNote?: boolean
}

function clearPendingSaveTimer() {
  if (saveTimer.value) {
    clearTimeout(saveTimer.value)
    saveTimer.value = null
  }
}

async function flushNotesToLocal(reason: LeaveFlushReason) {
  const notesSync = getNotesSync()
  if (!notesSync)
    return

  try {
    console.warn('NoteDetail 离开页触发本地落盘', {
      reason,
      noteId: effectiveUuid.value,
    })
    await notesSync.manualSync()
  }
  catch (error) {
    console.error('NoteDetail 本地落盘兜底失败:', error)
  }
}

function triggerLeavePageLocalFlush(reason: LeaveFlushReason) {
  clearPendingSaveTimer()
  void handleNoteSaving(true, reason)
}

async function tryRepairMissingPrivateNote(id: string) {
  if (missingPrivateNoteRepairId.value === id)
    return

  missingPrivateNoteRepairId.value = id

  try {
    const repaired = await syncApi.repairMissingPrivateNoteIfNeeded?.(id)
    if (!repaired)
      return

    const repairedNote = await getNote(id)
    if (repairedNote) {
      await applyPrivateNoteState(repairedNote)
    }
  }
  catch (error) {
    console.error('缺失私有备忘录补齐失败:', error)
  }
}

async function handleNoteSaving(
  silent = false,
  leaveFlushReason: LeaveFlushReason | null = null,
  saveTargetContext: SaveTargetContext = {},
) {
  // 如果格式化面板打开，不触发保存
  if (state.isFormatModalOpen) {
    return
  }

  if (!editorRef.value)
    return
  const content = editorRef.value.getContent() || ''
  const hasMeaningfulContent = editorRef.value.isMeaningfulContent?.() ?? !!content
  let { title, summary } = editorRef.value.getTitle()
  const id = saveTargetContext.noteId ?? effectiveUuid.value
  const wasNewNote = saveTargetContext.wasNewNote ?? isNewNote.value

  if (!id)
    return

  const noteExists = await getNote(id)

  // 未持久化的新建草稿在离开时可直接丢弃，不进入删除链路。
  if (wasNewNote && !noteExists && !hasMeaningfulContent) {
    if (leaveFlushReason)
      await flushNotesToLocal(leaveFlushReason)
    return
  }

  // 已持久化内容未变化时直接跳过，避免旧空白笔记在失焦时被误删。
  if (content === lastSavedContent.value) {
    if (leaveFlushReason)
      await flushNotesToLocal(leaveFlushReason)
    return // 内容未变化，不保存
  }

  if (isMissingPrivateNote.value) {
    if (leaveFlushReason)
      await flushNotesToLocal(leaveFlushReason)
    if (!silent) {
      await presentTopError('当前备忘录不存在或尚未同步完成')
    }
    return
  }

  // 如果标题为空，使用默认标题
  if (!title || title.trim() === '') {
    title = '新建备忘录'
  }

  if (!silent) {
    state.isSaving = true
  }

  restoreHeight()

  const time = getTime()

  // 本地保存时不处理文件hash，让富文本编辑器自主管理
  const fileHashes: string[] = []

  try {
    if (noteExists) {
      // 已持久化笔记允许保存为空内容；删除只能走显式操作。
      const baseNote = toRaw(data.value) || noteExists
      const updatedNote = Object.assign({}, baseNote, {
        title,
        summary,
        content,
        updated: time,
        version: (baseNote?.version || 1) + 1,
        files: fileHashes,
      })
      await updateNote(id, updatedNote)
      data.value = updatedNote

      // 静默保存时不发出事件，避免触发列表刷新
      if (!silent) {
        emit('noteSaved', { noteId: id, isNew: false })
      }
    }
    else {
      if (!wasNewNote) {
        state.isMissingPrivateNote = true
        data.value = null
        syncMissingPrivateNoteState()
        if (!silent) {
          await presentTopError('当前备忘录不存在或尚未同步完成')
        }
        return
      }

      // 新建笔记只在出现有效内容后才真正落盘。
      const newNote = {
        title,
        summary,
        content,
        created: getTime(),
        updated: time,
        item_type: NOTE_TYPE.NOTE,
        parent_id: isDesktop.value
          ? (props.parentId || '')
          : ((!route.query.parent_id || route.query.parent_id === 'unfilednotes') ? '' : route.query.parent_id as string),
        id,
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
        files: fileHashes,
      }
      await addNote(newNote)
      updateParentFolderSubcount(newNote)
      data.value = newNote

      if (wasNewNote) {
        hasCreatedRouteDraft.value = true

        if (!isDesktop.value)
          replaceMobileDraftUrl(id)
      }

      // 新建笔记总是发出事件，需要刷新列表
      emit('noteSaved', { noteId: id, isNew: true })
    }

    // 更新上次保存的内容
    lastSavedContent.value = content

    if (leaveFlushReason)
      await flushNotesToLocal(leaveFlushReason)

    // 自动同步笔记到云端（静默模式）
    // 静默模式：未登录时不会抛出错误，直接跳过
    if (!silent) {
      try {
        await sync(true)
      }
      catch (error) {
        console.error('自动同步失败:', error)
        await presentTopError('同步失败，请检查网络连接')
      }
    }
  }
  catch (error) {
    console.error('保存笔记失败:', error)
    await presentTopError('保存失败，请重试')
  }
  finally {
    if (!silent) {
      state.isSaving = false
    }
  }
}

// 防抖保存函数
function debouncedSave(silent = false) {
  clearPendingSaveTimer()

  // 设置新的定时器，800ms 后执行保存
  saveTimer.value = window.setTimeout(() => {
    saveTimer.value = null
    void handleNoteSaving(silent)
  }, 800)
}

async function init(id: string) {
  try {
    if (isUserContext.value) {
      const { getPublicNote } = useUserPublicNotes(username.value)
      // 获取用户公开笔记
      data.value = getPublicNote(id)
      if (data.value) {
        nextTick(() => {
          editorRef.value?.setEditable(false)
          editorRef.value?.setContent(data.value?.content || '')
          // 记录初始内容
          lastSavedContent.value = data.value?.content || ''
        })
      }
    }
    else {
      // 获取当前用户的笔记
      const note = await getNote(id)
      if (note) {
        await applyPrivateNoteState(note)
      }
      else {
        state.isMissingPrivateNote = true
        lastSavedContent.value = ''
        nextTick(() => {
          syncMissingPrivateNoteState()
        })
        void tryRepairMissingPrivateNote(id)
      }
    }
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

  state.isPinUnlocking = true
  state.lockViewState = 'unlocking'
  state.lockErrorMessage = ''

  try {
    const result = await noteLock.verifyPin(data.value.id, pin)
    state.lockFailedAttempts = result.failedAttempts
    state.lockCooldownUntil = result.cooldownUntil

    if (!result.ok) {
      state.lockViewState = result.code === 'cooldown' ? 'cooldown' : 'locked'
      state.lockErrorMessage = result.message || 'PIN 不正确，请重试'
      syncLockedNoteState()
      return
    }

    state.lockViewState = 'unlocked'
    state.lockErrorMessage = ''
    if (data.value) {
      syncUnlockedNoteState(data.value)
    }
  }
  finally {
    state.isPinUnlocking = false
  }
}

async function handleBiometricUnlock() {
  if (!data.value?.id) {
    return
  }

  state.isPinUnlocking = true
  state.lockViewState = 'unlocking'
  state.lockErrorMessage = ''

  try {
    const result = await noteLock.tryBiometricUnlock(data.value.id, data.value)
    state.lockFailedAttempts = result.failedAttempts
    state.lockCooldownUntil = result.cooldownUntil

    if (!result.ok) {
      state.lockViewState = result.code === 'cooldown' ? 'cooldown' : 'locked'
      state.lockErrorMessage = result.message || '生物识别不可用，请输入 PIN 解锁'
      syncLockedNoteState()
      return
    }

    state.lockViewState = 'unlocked'
    state.lockErrorMessage = ''
    if (data.value) {
      syncUnlockedNoteState(data.value)
    }
  }
  finally {
    state.isPinUnlocking = false
  }
}

async function handleNoteLockUpdated(updatedNote: Note) {
  data.value = updatedNote
  state.showNoteMore = false
  await applyPrivateNoteState(updatedNote)
}

async function onSelectFile(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    // 插入文件到编辑器，富文本编辑器会自动处理文件管理
    await editorRef.value?.insertFiles(input.files)

    // 清空 input 以允许重复选择同一文件
    input.value = ''
  }
}

function onInsertTodo() {
  editorRef.value?.editor.chain().focus().toggleTaskList().run()
}

function openTableFormatModal() {
  editorRef.value?.setInputMode('none')
  setTimeout(() => {
    state.showTableFormat = true
  }, 300)
}

function openTextFormatModal() {
  // if (isPlatform('desktop')) {
  editorRef.value?.setInputMode('none')
  setTimeout(() => {
    state.showFormat = true
  }, 300)
  // }
}

function handlePageHide() {
  triggerLeavePageLocalFlush('pagehide')
}

function handleBeforeUnload() {
  triggerLeavePageLocalFlush('beforeunload')
}

onMounted(() => {
  window.addEventListener('pagehide', handlePageHide)
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onBeforeUnmount(() => {
  clearPendingSaveTimer()
  window.removeEventListener('pagehide', handlePageHide)
  window.removeEventListener('beforeunload', handleBeforeUnload)
})

onIonViewWillLeave(() => {
  triggerLeavePageLocalFlush('view-leave')
  setTimeout(() => {
    state.showFormat = false
  }, 300)
})
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
            v-if="state.isSaving"
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
        :lock-view-state="state.lockViewState"
        :biometric-enabled="state.lockBiometricEnabled"
        :device-supports-biometric="state.lockDeviceSupportsBiometric"
        :failed-attempts="state.lockFailedAttempts"
        :cooldown-until="state.lockCooldownUntil"
        :error-message="state.lockErrorMessage"
        :is-submitting="state.isPinUnlocking"
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
    <!-- <IonFooter v-if="keyboardHeight > 0" style="overscroll-behavior: none;"> -->
    <IonFooter v-if="!isEditorBlocked">
      <IonToolbar class="note-detail__toolbar">
        <div class="flex justify-evenly items-center select-none">
          <IonButton
            fill="clear"
            size="large"
            @touchstart.prevent="openTableFormatModal"
            @click="openTableFormatModal"
          >
            <Icon name="table" class="text-6.5" />
          </IonButton>
          <IonButton
            fill="clear"
            size="large"
            @touchstart.prevent="openTextFormatModal"
            @click="openTextFormatModal"
          >
            <IonIcon :icon="textOutline" />
          </IonButton>
          <IonButton
            fill="clear"
            size="large"
            @touchstart.prevent="onInsertTodo"
            @click="onInsertTodo"
          >
            <IonIcon :icon="checkmarkCircleOutline" />
          </IonButton>
          <IonButton
            v-if="!isIos"
            fill="clear"
            size="large"
            @touchstart.prevent="imageInputRef.click()"
            @click="imageInputRef.click()"
          >
            <Icon name="image" class="text-6.5" />
            <input ref="imageInputRef" type="file" accept="image/*" class="pointer-events-none absolute text-0 opacity-0" @change="onSelectFile">
          </IonButton>
          <IonButton
            fill="clear"
            size="large"
            @click="fileInputRef.click()"
          >
            <Icon v-if="isIos" name="image" class="text-6.5" />
            <IonIcon v-else :icon="attachOutline" />
            <input ref="fileInputRef" type="file" class="pointer-events-none absolute text-0 opacity-0" @change="onSelectFile">
          </IonButton>
        </div>
      </IonToolbar>
    </IonFooter>
    <NoteMore
      v-if="canShowNoteActions"
      v-model:is-open="state.showNoteMore"
      :note-id="effectiveUuid || ''"
      @note-lock-updated="handleNoteLockUpdated"
    />
    <TableFormatModal v-if="!isEditorBlocked" v-model:is-open="state.showTableFormat" :editor="((editorRef?.editor || {}) as Editor)" />
    <TextFormatModal v-if="!isEditorBlocked" v-model:is-open="state.showFormat" :editor="((editorRef?.editor || {}) as Editor)" />
  </IonPage>
</template>

<style lang="scss">
.note-detail__toolbar {
  // --background: #000;
  --padding-top: 0;
  --padding-bottom: 0;
  --padding-start: 0;
  --padding-end: 0;
  ion-button {
    --padding-top: 0;
    --padding-bottom: 0;
    min-height: 0;
    height: 44px;
    width: 24%;
    margin: 0;
    &:first-child {
      width: 26%;
      padding-left: 2%;
    }
    &:last-child {
      width: 26%;
      padding-right: 2%;
    }
  }
}

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
