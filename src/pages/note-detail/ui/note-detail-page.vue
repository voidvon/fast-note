<script setup lang="ts">
import NoteDetailPane from '@/widgets/note-detail-pane'

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

defineEmits(['noteSaved'])
</script>

<template>
  <NoteDetailPane
    :note-id="props.noteId"
    :parent-id="props.parentId"
    @note-saved="$emit('noteSaved', $event)"
  />
</template>
