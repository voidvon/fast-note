<script setup lang="ts">
import FolderBrowser from '@/widgets/folder-browser'

withDefaults(
  defineProps<{
    currentFolder?: string
    selectedNoteId?: string
  }>(),
  {
    currentFolder: undefined,
    selectedNoteId: undefined,
  },
)

defineEmits(['selected', 'createNote'])
</script>

<template>
  <FolderBrowser
    :current-folder="currentFolder"
    :selected-note-id="selectedNoteId"
    @selected="$emit('selected', $event)"
    @create-note="$emit('createNote', $event)"
  />
</template>
