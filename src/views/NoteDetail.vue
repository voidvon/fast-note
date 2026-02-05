<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { IonBackButton, IonButton, IonButtons, IonContent, IonFooter, IonHeader, IonIcon, IonPage, IonToast, IonToolbar, isPlatform, onIonViewWillLeave } from '@ionic/vue'
import { attachOutline, checkmarkCircleOutline, ellipsisHorizontalCircleOutline, textOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, nextTick, onMounted, reactive, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const router = useRouter()
const { addNote, getNote, updateNote, deleteNote, updateParentFolderSubcount } = useNote()
const { isDesktop } = useDeviceType()
const { restoreHeight } = useVisualViewport()
const { state: authState, verify, register } = useWebAuthn()
const { sync } = useSync()

const isIos = isPlatform('ios')
const pageRef = ref()
const editorRef = ref()
const fileInputRef = ref()
const imageInputRef = ref()
const data = ref()
const newNoteId = ref<string | null>(null)

const state = reactive({
  showFormat: false,
  showTableFormat: false,
  showNoteMore: false,
  isAuth: false,
  toast: {
    isOpen: false,
    message: '',
    color: 'success',
  },
})

const idFromRoute = computed(() => route.params.id as string || route.params.noteId as string)
const idFromSource = computed(() => props.noteId || idFromRoute.value)
const isNewNote = computed(() => idFromSource.value === '0')
const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)

// 智能返回按钮
const { backButtonProps } = useNoteBackButton(route, data, username.value)

watch(isNewNote, (isNew) => {
  if (isNew && !newNoteId.value)
    newNoteId.value = nanoid(12)
}, { immediate: true })

const effectiveUuid = computed(() => {
  if (isNewNote.value)
    return newNoteId.value

  return idFromSource.value
})

watch(idFromSource, async (id, oldId) => {
  // 如果从一个笔记切换到另一个笔记，先保存当前笔记
  if (oldId && oldId !== '0' && oldId !== id && isDesktop.value) {
    await handleNoteSaving()
  }

  if (id && id !== '0') {
    init(id)
  }
  else if (id === '0') {
    // 新建笔记，清空编辑器
    data.value = null
    newNoteId.value = nanoid(12)
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.setContent('')
        editorRef.value.setEditable(true)
        // 自动聚焦到编辑器
        setTimeout(() => {
          editorRef.value?.focus()
        }, 100)
      }
    })
  }
  else if (!isNewNote.value) { // This condition means id is falsy (e.g. '', undefined)
    // No note selected, clear editor
    data.value = null
    // Using nextTick to ensure editorRef is available
    nextTick(() => {
      if (editorRef.value) {
        editorRef.value.setContent('')
        editorRef.value.setEditable(true)
      }
    })
  }
}, { immediate: true })

watch(() => state.showTableFormat, changeFormatModal)
watch(() => state.showFormat, changeFormatModal)

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

async function handleNoteSaving() {
  if (!editorRef.value)
    return
  const content = editorRef.value.getContent()
  const { title, summary } = editorRef.value.getTitle()

  // 如果是新笔记且内容为空，则不执行任何操作
  if (isNewNote.value && !content)
    return

  // 如果在桌面端首次保存新笔记，更新 noteId 以便后续保存
  // 移动端则需要更新路由
  if (isNewNote.value && !isDesktop.value)
    router.replace({ path: `/n/${effectiveUuid.value}` })

  const id = effectiveUuid.value
  if (!id)
    return

  restoreHeight()

  const time = getTime()

  // 本地保存时不处理文件hash，让富文本编辑器自主管理
  const fileHashes: string[] = []

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
      
      // 通知父组件笔记已保存（更新）
      emit('noteSaved', { noteId: id, isNew: false })
    }
    else {
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
      
      // 新建笔记保存后，重置 newNoteId，这样下次就不会被认为是新笔记
      if (wasNewNote) {
        newNoteId.value = null
      }
      
      // 通知父组件笔记已保存（新建）
      emit('noteSaved', { noteId: id, isNew: true })
    }

    // 自动同步笔记到云端（静默模式）
    // 静默模式：未登录时不会抛出错误，直接跳过
    try {
      const syncResult = await sync(true)
      // 只有在真正同步成功时才显示提示（syncResult 不为 null）
      if (syncResult) {
        state.toast.message = '同步成功'
        state.toast.isOpen = true
      }
    }
    catch (error) {
      console.error('自动同步失败:', error)
      // 同步失败提示
      state.toast.message = '同步失败，请检查网络连接'
      state.toast.isOpen = true
    }
  }
  else {
    // 内容为空，删除笔记
    await deleteNote(id)
  }
}

async function init(id: string) {
  try {
    if (isUserContext.value) {
      const { getPublicNote } = useUserPublicNotes(username.value)
      // 获取用户公开笔记
      data.value = getPublicNote(id)
      if (data.value) {
        // 公开笔记始终为只读模式
        editorRef.value?.setEditable(false)
        nextTick(() => {
          editorRef.value?.setContent(data.value.content)
        })
      }
    }
    else {
      // 获取当前用户的笔记
      data.value = await getNote(id)
      if (data.value) {
        if (data.value.is_deleted === 1)
          editorRef.value?.setEditable(false)

        if (data.value?.is_locked === 1) {
          if (authState.isRegistered)
            state.isAuth = await verify()
          else
            state.isAuth = await register()
        }

        nextTick(() => {
          editorRef.value?.setContent(data.value.content)
        })
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

onMounted(() => {
  if (isNewNote.value && !isDesktop.value) {
    if (route.query.parent_id) {
      window.history.replaceState(null, '', `/n/${newNoteId.value}?parent_id=${route.query.parent_id}`)
    }
    else {
      window.history.replaceState(null, '', `/n/${newNoteId.value}`)
    }
  }
})

onIonViewWillLeave(() => {
  handleNoteSaving()
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
        <IonButtons v-if="!isUserContext" slot="end">
          <IonButton @click="state.showNoteMore = true">
            <IonIcon :icon="ellipsisHorizontalCircleOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent force-overscroll>
      <div v-if="data?.is_locked !== 1 || state.isAuth" class="ion-padding">
        <YYEditor
          v-if="effectiveUuid"
          ref="editorRef"
          @blur="handleNoteSaving"
        />
      </div>
      <!-- <div v-if="keyboardHeight > 0" slot="fixed" :style="{ top: `${visualHeight - 66}px` }" class="h-[66px]">
        Fixed Button
      </div> -->
    </IonContent>
    <!-- <IonFooter v-if="keyboardHeight > 0" style="overscroll-behavior: none;"> -->
    <IonFooter v-if="!isUserContext">
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
    <NoteMore v-if="!isUserContext" v-model:is-open="state.showNoteMore" />
    <TableFormatModal v-if="!isUserContext" v-model:is-open="state.showTableFormat" :editor="((editorRef?.editor || {}) as Editor)" />
    <TextFormatModal v-if="!isUserContext" v-model:is-open="state.showFormat" :editor="((editorRef?.editor || {}) as Editor)" />

    <!-- 同步结果提示 -->
    <IonToast
      :is-open="state.toast.isOpen"
      :message="state.toast.message"
      :duration="2000"
      position="bottom"
      @did-dismiss="state.toast.isOpen = false"
    />
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

ion-toast {
  --background: var(--c-gray-700);
}
p {
  line-height: 1.4;
}
</style>
