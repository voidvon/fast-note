<script setup lang="ts">
import DeletedNoteList from '@/widgets/deleted-note-list'

withDefaults(defineProps<{
  selectedNoteId?: string
}>(), {
  selectedNoteId: '',
})

defineEmits(['selected'])
</script>

<template>
  <DeletedNoteList
    :selected-note-id="selectedNoteId"
    @selected="$emit('selected', $event)"
  />
</template>
