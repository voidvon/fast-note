<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'
import { extensionPuzzleOutline } from 'ionicons/icons'

defineEmits(['click'])
</script>

<template>
  <IonButton fill="clear" @click="$emit('click')">
    <IonIcon :icon="extensionPuzzleOutline" />
  </IonButton>
</template>
