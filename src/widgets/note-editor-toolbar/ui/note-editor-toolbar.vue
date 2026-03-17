<script setup lang="ts">
import type { Editor } from '@tiptap/vue-3'
import { IonButton, IonFooter, IonIcon, IonToolbar } from '@ionic/vue'
import { attachOutline, checkmarkCircleOutline, textOutline } from 'ionicons/icons'
import { ref, watch } from 'vue'
import Icon from '@/components/Icon.vue'
import TableFormatModal from '@/components/TableFormatModal.vue'
import TextFormatModal from '@/components/TextFormatModal.vue'

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

watch(showTableFormat, (next) => {
  emit('update:isFormatModalOpen', next || showFormat.value)
  changeFormatModal(next)
})

watch(showFormat, (next) => {
  emit('update:isFormatModalOpen', next || showTableFormat.value)
  changeFormatModal(next)
})

function changeFormatModal(isOpen: boolean) {
  if (isOpen) {
    props.editorHost?.setInputMode?.('none')
    setTimeout(() => {
      props.editorHost?.editor?.chain().focus()
    }, 500)
    return
  }

  props.editorHost?.setInputMode?.('text')
  setTimeout(() => {
    props.editorHost?.editor?.chain().blur()
    setTimeout(() => {
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
  props.editorHost?.setInputMode?.('none')
  setTimeout(() => {
    showTableFormat.value = true
  }, 300)
}

function openTextFormatModal() {
  props.editorHost?.setInputMode?.('none')
  setTimeout(() => {
    showFormat.value = true
  }, 300)
}

function closePanels() {
  showFormat.value = false
  showTableFormat.value = false
}

defineExpose({
  closePanels,
})
</script>

<template>
  <IonFooter>
    <IonToolbar class="note-editor-toolbar">
      <div class="flex justify-evenly items-center select-none">
        <IonButton
          data-testid="note-editor-toolbar-table"
          fill="clear"
          size="large"
          @touchstart.prevent="openTableFormatModal"
          @click="openTableFormatModal"
        >
          <Icon name="table" class="text-6.5" />
        </IonButton>
        <IonButton
          data-testid="note-editor-toolbar-text"
          fill="clear"
          size="large"
          @touchstart.prevent="openTextFormatModal"
          @click="openTextFormatModal"
        >
          <IonIcon :icon="textOutline" />
        </IonButton>
        <IonButton
          data-testid="note-editor-toolbar-todo"
          fill="clear"
          size="large"
          @touchstart.prevent="onInsertTodo"
          @click="onInsertTodo"
        >
          <IonIcon :icon="checkmarkCircleOutline" />
        </IonButton>
        <IonButton
          v-if="!isIos"
          data-testid="note-editor-toolbar-image"
          fill="clear"
          size="large"
          @touchstart.prevent="imageInputRef?.click()"
          @click="imageInputRef?.click()"
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
        </IonButton>
        <IonButton
          data-testid="note-editor-toolbar-file"
          fill="clear"
          size="large"
          @click="fileInputRef?.click()"
        >
          <Icon v-if="isIos" name="image" class="text-6.5" />
          <IonIcon v-else :icon="attachOutline" />
          <input
            ref="fileInputRef"
            data-testid="note-editor-toolbar-file-input"
            type="file"
            class="pointer-events-none absolute text-0 opacity-0"
            @change="onSelectFile"
          >
        </IonButton>
      </div>
    </IonToolbar>
  </IonFooter>
  <TableFormatModal
    v-model:is-open="showTableFormat"
    :editor="((editorHost?.editor || {}) as Editor)"
  />
  <TextFormatModal
    v-model:is-open="showFormat"
    :editor="((editorHost?.editor || {}) as Editor)"
  />
</template>

<style lang="scss">
.note-editor-toolbar {
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
