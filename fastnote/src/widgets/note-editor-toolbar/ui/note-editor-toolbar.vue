<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { ref, useId, watch } from 'vue'
import { F7Footer, F7Icon, F7Link, F7ToolbarPane } from '@/shared/ui/f7'
import Icon from '@/shared/ui/icon'
import { attachOutline, checkmarkCircleOutline, textOutline } from '@/shared/ui/icons'
import TableFormatModal from './table-format-modal.vue'
import TextFormatModal from './text-format-modal.vue'

interface NoteEditorToolbarHost {
  editor?: Editor
  insertFiles?: (files: FileList) => Promise<unknown>
  setInputMode?: (mode: 'none' | 'text') => void
}

const props = defineProps<{
  editorHost?: NoteEditorToolbarHost | null
  isIos?: boolean
}>()

const emit = defineEmits<{
  'update:isFormatModalOpen': [value: boolean]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const imageInputRef = ref<HTMLInputElement | null>(null)
const showFormat = ref(false)
const showTableFormat = ref(false)
const tableTriggerId = `note-editor-toolbar-table-trigger-${useId().replaceAll(':', '')}`
let editorBlurTimer: ReturnType<typeof setTimeout> | undefined
let editorFocusTimer: ReturnType<typeof setTimeout> | undefined

watch([showTableFormat, showFormat], ([tableOpen, textOpen], [wasTableOpen, wasTextOpen]) => {
  const isOpen = tableOpen || textOpen
  emit('update:isFormatModalOpen', isOpen)

  if (isOpen) {
    clearEditorRestoreTimers()
    props.editorHost?.setInputMode?.('none')
    return
  }

  if (wasTableOpen || wasTextOpen) {
    restoreEditorInput()
  }
})

function clearEditorRestoreTimers() {
  if (editorBlurTimer) {
    clearTimeout(editorBlurTimer)
    editorBlurTimer = undefined
  }
  if (editorFocusTimer) {
    clearTimeout(editorFocusTimer)
    editorFocusTimer = undefined
  }
}

function restoreEditorInput() {
  clearEditorRestoreTimers()
  props.editorHost?.setInputMode?.('text')
  editorBlurTimer = setTimeout(() => {
    editorBlurTimer = undefined
    props.editorHost?.editor?.chain().blur()
    editorFocusTimer = setTimeout(() => {
      editorFocusTimer = undefined
      props.editorHost?.editor?.chain().focus()
    }, 300)
  }, 10)
}

async function onSelectFile(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    await props.editorHost?.insertFiles?.(input.files)
    input.value = ''
  }
}

function onInsertTodo() {
  props.editorHost?.editor?.chain().focus().toggleTaskList().run()
}

function openTableFormatModal() {
  showFormat.value = false
  showTableFormat.value = !showTableFormat.value
}

function openTextFormatModal() {
  showTableFormat.value = false
  showFormat.value = !showFormat.value
}

function closePanels() {
  clearEditorRestoreTimers()
  showFormat.value = false
  showTableFormat.value = false
}

defineExpose({
  closePanels,
})
</script>

<template>
  <F7Footer native scrollable class="note-editor-toolbar">
    <F7ToolbarPane>
      <F7Link
        :id="tableTriggerId"
        class="link note-editor-toolbar__action"
        data-testid="note-editor-toolbar-table"
        :href="false"
        icon-only
        role="button"
        tabindex="0"
        tooltip="表格格式"
        @click="openTableFormatModal"
        @keydown.enter.prevent="openTableFormatModal"
        @keydown.space.prevent="openTableFormatModal"
      >
        <Icon name="table" class="text-6.5" />
      </F7Link>
      <F7Link
        class="link note-editor-toolbar__action"
        data-testid="note-editor-toolbar-text"
        :href="false"
        icon-only
        role="button"
        tabindex="0"
        tooltip="文本格式"
        @click="openTextFormatModal"
        @keydown.enter.prevent="openTextFormatModal"
        @keydown.space.prevent="openTextFormatModal"
      >
        <F7Icon :icon="textOutline" />
      </F7Link>
      <F7Link
        class="link note-editor-toolbar__action"
        data-testid="note-editor-toolbar-todo"
        :href="false"
        icon-only
        role="button"
        tabindex="0"
        tooltip="待办列表"
        @touchstart.prevent="onInsertTodo"
        @click="onInsertTodo"
        @keydown.enter.prevent="onInsertTodo"
        @keydown.space.prevent="onInsertTodo"
      >
        <F7Icon :icon="checkmarkCircleOutline" />
      </F7Link>
      <F7Link
        v-if="!isIos"
        class="link note-editor-toolbar__action"
        data-testid="note-editor-toolbar-image"
        :href="false"
        icon-only
        role="button"
        tabindex="0"
        tooltip="插入图片"
        @touchstart.prevent="imageInputRef?.click()"
        @click="imageInputRef?.click()"
        @keydown.enter.prevent="imageInputRef?.click()"
        @keydown.space.prevent="imageInputRef?.click()"
      >
        <Icon name="image" class="text-6.5" />
        <input
          ref="imageInputRef"
          data-testid="note-editor-toolbar-image-input"
          type="file"
          accept="image/*"
          class="pointer-events-none absolute text-0 opacity-0"
          @change="onSelectFile"
        >
      </F7Link>
      <F7Link
        class="link note-editor-toolbar__action"
        data-testid="note-editor-toolbar-file"
        :href="false"
        icon-only
        role="button"
        tabindex="0"
        :tooltip="isIos ? '插入图片' : '插入附件'"
        @click="fileInputRef?.click()"
        @keydown.enter.prevent="fileInputRef?.click()"
        @keydown.space.prevent="fileInputRef?.click()"
      >
        <Icon v-if="isIos" name="image" class="text-6.5" />
        <F7Icon v-else :icon="attachOutline" />
        <input
          ref="fileInputRef"
          data-testid="note-editor-toolbar-file-input"
          type="file"
          class="pointer-events-none absolute text-0 opacity-0"
          @change="onSelectFile"
        >
      </F7Link>
    </F7ToolbarPane>
  </F7Footer>
  <TableFormatModal
    v-model:is-open="showTableFormat"
    :editor="((editorHost?.editor || {}) as Editor)"
    :target-el="`#${tableTriggerId}`"
  />
  <TextFormatModal
    v-model:is-open="showFormat"
    :editor="((editorHost?.editor || {}) as Editor)"
  />
</template>

<style scoped>
.note-editor-toolbar {
  --f7-toolbar-height: var(--note-editor-toolbar-height, 64px);
}

.note-editor-toolbar__action {
  aspect-ratio: 1;
}
</style>
