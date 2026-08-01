<script setup lang="ts">
import NoteDetailPane from '@/widgets/note-detail-pane'

const props = withDefaults(
  defineProps<{
    loadError?: string
    loading?: boolean
    noteId?: string
    parentId?: string
  }>(),
  {
    loadError: '',
    loading: false,
    noteId: '',
    parentId: '',
  },
)

defineEmits(['noteSaved'])
</script>

<template>
  <NoteDetailPane
    :load-error="props.loadError"
    :loading="props.loading"
    :note-id="props.noteId"
    :parent-id="props.parentId"
    @note-saved="$emit('noteSaved', $event)"
  />
</template>
