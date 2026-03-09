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
import TableFormatModal from '@/components/TableFormatModal.vue'
import TextFormatModal from '@/components/TextFormatModal.vue'
import YYEditor from '@/components/YYEditor.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useNoteBackButton } from '@/hooks/useSmartBackButton'
import { useSync } from '@/hooks/useSync'
import { useVisualViewport } from '@/hooks/useVisualViewport'
import { useWebAuthn } from '@/hooks/useWebAuthn'
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
const { addNote, getNote, updateNote, deleteNote, updateParentFolderSubcount, getNotesSync } = useNote()
const { isDesktop } = useDeviceType()
const { restoreHeight } = useVisualViewport()
const { state: authState, verify, register } = useWebAuthn()
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
  showFormat: false,
  showTableFormat: false,
  showNoteMore: false,
  isAuth: false,
  isFormatModalOpen: false, // 标记格式化面板是否打开
  isSaving: false,
  isMissingPrivateNote: false,
})

const idFromRoute = computed(() => route.params.id as string || route.params.noteId as string)
const idFromSource = computed(() => props.noteId || idFromRoute.value)
const isNewNote = computed(() => idFromSource.value === '0' && !hasCreatedRouteDraft.value)
const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)
const isMissingPrivateNote = computed(() => !isUserContext.value && !isNewNote.value && state.isMissingPrivateNote)
const isReadOnly = computed(() => isUserContext.value || data.value?.is_deleted === 1)
const isEditorBlocked = computed(() => isReadOnly.value || isMissingPrivateNote.value)

// 智能返回按钮
const { backButtonProps } = useNoteBackButton(route, data, username.value)

watch(isNewNote, (isNew) => {
  if (isNew && !newNoteId.value)
    newNoteId.value = nanoid(12)
}, { immediate: true })

const effectiveUuid = computed(() => {
  if (idFromSource.value === '0')
    return newNoteId.value

  return idFromSource.value
})

watch(idFromSource, async (id, oldId) => {
  if (id !== oldId) {
    missingPrivateNoteRepairId.value = null
    hasCreatedRouteDraft.value = false
  }

  // 如果从一个笔记切换到另一个笔记，先保存当前笔记（静默保存，不触发列表刷新）
  // 但如果是切换到新建笔记（id === '0'），不保存
  if (oldId && oldId !== '0' && oldId !== id && id !== '0' && isDesktop.value) {
    await handleNoteSaving(true) // 传入 silent 参数，表示静默保存
  }

  if (id && id !== '0') {
    state.isMissingPrivateNote = false
    init(id)
  }
  else if (id === '0') {
    state.isMissingPrivateNote = false
    // 新建笔记，立即清空编辑器和数据
    data.value = null
    newNoteId.value = nanoid(12)
    lastSavedContent.value = '' // 重置上次保存的内容

    // 立即清空编辑器内容，不使用 nextTick
    if (editorRef.value) {
      editorRef.value.setContent('')
      editorRef.value.setEditable(true)
    }

    // 延迟聚焦，确保编辑器已经清空
    nextTick(() => {
      setTimeout(() => {
        editorRef.value?.focus()
      }, 100)
    })
  }
  else if (!isNewNote.value) { // This condition means id is falsy (e.g. '', undefined)
    state.isMissingPrivateNote = false
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

async function applyPrivateNoteState(note: Note) {
  data.value = note
  state.isMissingPrivateNote = false
  missingPrivateNoteRepairId.value = null

  nextTick(() => {
    editorRef.value?.setEditable(data.value?.is_deleted !== 1)
  })

  if (data.value?.is_locked === 1) {
    if (authState.isRegistered)
      state.isAuth = await verify()
    else
      state.isAuth = await register()
  }

  nextTick(() => {
    editorRef.value?.setContent(data.value?.content || '')
    lastSavedContent.value = data.value?.content || ''
  })
}

type LeaveFlushReason = 'view-leave' | 'pagehide' | 'beforeunload'

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

async function handleNoteSaving(silent = false, leaveFlushReason: LeaveFlushReason | null = null) {
  // 如果格式化面板打开，不触发保存
  if (state.isFormatModalOpen) {
    return
  }

  if (!editorRef.value)
    return
  const content = editorRef.value.getContent()
  let { title, summary } = editorRef.value.getTitle()

  // 如果是新笔记且内容为空，则不执行任何操作
  if (isNewNote.value && !content) {
    if (leaveFlushReason)
      await flushNotesToLocal(leaveFlushReason)
    return
  }

  // 检查内容是否真正发生变化
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

  const id = effectiveUuid.value
  if (!id)
    return

  if (!silent) {
    state.isSaving = true
  }

  restoreHeight()

  const time = getTime()

  // 本地保存时不处理文件hash，让富文本编辑器自主管理
  const fileHashes: string[] = []

  try {
    // 保存笔记数据
    if (content) {
      const wasNewNote = isNewNote.value
      const noteExists = await getNote(id)
      if (noteExists) {
        // 更新笔记
        const updatedNote = Object.assign(toRaw(data.value) || {}, {
          title,
          summary,
          content,
          updated: time,
          version: (data.value?.version || 1) + 1,
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

        // 新增笔记
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
    else {
      // 内容为空，删除笔记
      await deleteNote(id)
      lastSavedContent.value = ''

      if (leaveFlushReason)
        await flushNotesToLocal(leaveFlushReason)
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
        <IonButtons v-if="!isEditorBlocked" slot="end" class="note-detail__header-buttons">
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
      <div v-if="data?.is_locked !== 1 || state.isAuth || isMissingPrivateNote" class="ion-padding">
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
    <NoteMore v-if="!isEditorBlocked" v-model:is-open="state.showNoteMore" />
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
