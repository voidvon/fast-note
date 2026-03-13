<script setup lang="ts">
import { IonButton, IonIcon, isPlatform, useIonRouter } from '@ionic/vue'
import { arrowBackSharp, chevronBack } from 'ionicons/icons'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  fallbackPath: string
  targetPath?: string
  text?: string
}>(), {
  targetPath: '',
  text: '返回',
})

const ionRouter = useIonRouter()

const buttonIcon = computed(() => isPlatform('ios') ? chevronBack : arrowBackSharp)
const buttonText = computed(() => isPlatform('ios') ? props.text : '')
const resolvedTargetPath = computed(() => props.targetPath || props.fallbackPath)

function handleClick() {
  if (ionRouter.canGoBack()) {
    ionRouter.navigate(resolvedTargetPath.value, 'back', 'push')
    return
  }

  ionRouter.navigate(props.fallbackPath, 'back', 'replace')
}
</script>

<template>
  <IonButton
    class="smart-back-button"
    fill="clear"
    type="button"
    :aria-label="text"
    @click="handleClick"
  >
    <IonIcon :slot="buttonText ? 'start' : 'icon-only'" :icon="buttonIcon" />
    <span v-if="buttonText" class="smart-back-button__text">{{ buttonText }}</span>
  </IonButton>
</template>

<style scoped lang="scss">
.smart-back-button {
  --padding-start: 0;
  --padding-end: 0;
  margin-inline-start: 0;
  text-transform: none;
}

.smart-back-button__text {
  font-size: 17px;
}
</style>
