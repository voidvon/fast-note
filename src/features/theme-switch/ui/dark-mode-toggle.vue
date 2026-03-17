<script setup lang="ts">
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonPopover } from '@ionic/vue'
import { contrastOutline, moonOutline, sunnyOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { ThemeMode, useTheme } from '@/hooks/useTheme'

// 使用主题 composable
const { currentMode, isDarkMode, setThemeMode } = useTheme()

// 是否显示弹出菜单
const showPopover = ref(false)

// 计算当前图标
const currentIcon = computed(() => {
  if (currentMode.value === ThemeMode.Auto) {
    return contrastOutline
  }
  return isDarkMode.value ? sunnyOutline : moonOutline
})

// 计算按钮标题
const buttonTitle = computed(() => {
  switch (currentMode.value) {
    case ThemeMode.Auto:
      return '自动主题（跟随系统）'
    case ThemeMode.Light:
      return '当前：浅色模式'
    case ThemeMode.Dark:
      return '当前：深色模式'
    default:
      return '主题设置'
  }
})

// 设置主题模式并关闭弹出菜单
function handleSetThemeMode(mode: ThemeMode) {
  setThemeMode(mode)
  showPopover.value = false
}

// 切换弹出菜单
function togglePopover() {
  showPopover.value = !showPopover.value
}
</script>

<template>
  <div class="dark-mode-toggle">
    <IonButton
      id="theme-mode-button"
      fill="clear"
      size="small"
      :title="buttonTitle"
      @click="togglePopover"
    >
      <IonIcon
        slot="icon-only"
        :icon="currentIcon"
        :class="{ 'dark-active': isDarkMode }"
      />
    </IonButton>

    <IonPopover trigger="theme-mode-button" :is-open="showPopover" @did-dismiss="showPopover = false">
      <IonList>
        <IonItem button :detail="false" @click="handleSetThemeMode(ThemeMode.Auto)">
          <IonIcon slot="start" :icon="contrastOutline" />
          <IonLabel>自动（跟随系统）</IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="handleSetThemeMode(ThemeMode.Light)">
          <IonIcon slot="start" :icon="moonOutline" />
          <IonLabel>浅色模式</IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="handleSetThemeMode(ThemeMode.Dark)">
          <IonIcon slot="start" :icon="sunnyOutline" />
          <IonLabel>深色模式</IonLabel>
        </IonItem>
      </IonList>
    </IonPopover>
  </div>
</template>

<style scoped>
.dark-mode-toggle {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.dark-active {
  color: var(--ion-color-warning);
}

ion-button {
  --padding-start: 8px;
  --padding-end: 8px;
}

ion-popover {
  --width: 200px;
}

ion-item {
  --padding-start: 16px;
  --padding-end: 16px;
  cursor: pointer;
}
</style>
