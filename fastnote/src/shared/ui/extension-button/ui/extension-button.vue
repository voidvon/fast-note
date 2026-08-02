<script setup lang="ts">
import { F7Button, F7Icon } from '@/shared/ui/f7'
import { extensionPuzzleOutline } from '@/shared/ui/icons'

defineEmits(['click'])
</script>

<template>
  <F7Button fill="clear" @click="$emit('click')">
    <F7Icon :icon="extensionPuzzleOutline" />
  </F7Button>
</template>
