<script setup lang="ts">
import { computed, ref } from 'vue'
import { F7Button, F7Icon, F7Item, F7Label, F7List, F7Popover } from '@/shared/ui/f7'
import { contrastOutline, moon, sunny } from '@/shared/ui/icons'
import { ThemeMode, useTheme } from '../model/use-theme'

// 使用主题 composable
const { currentMode, isDarkMode, setThemeMode } = useTheme()

// 是否显示弹出菜单
const showPopover = ref(false)

// 计算当前图标
const currentIcon = computed(() => {
  if (currentMode.value === ThemeMode.Auto) {
    return contrastOutline
  }
  return isDarkMode.value ? sunny : moon
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
    <F7Button
      id="theme-mode-button"
      fill="clear"
      size="small"
      :title="buttonTitle"
      @click="togglePopover"
    >
      <F7Icon :icon="currentIcon" />
    </F7Button>

    <F7Popover target-el="#theme-mode-button" :is-open="showPopover" @did-dismiss="showPopover = false">
      <F7List>
        <F7Item button :detail="false" @click="handleSetThemeMode(ThemeMode.Auto)">
          <template #media>
            <F7Icon :icon="contrastOutline" />
          </template>
          <F7Label>自动（跟随系统）</F7Label>
        </F7Item>
        <F7Item button :detail="false" @click="handleSetThemeMode(ThemeMode.Light)">
          <template #media>
            <F7Icon :icon="moon" />
          </template>
          <F7Label>浅色模式</F7Label>
        </F7Item>
        <F7Item button :detail="false" @click="handleSetThemeMode(ThemeMode.Dark)">
          <template #media>
            <F7Icon :icon="sunny" />
          </template>
          <F7Label>深色模式</F7Label>
        </F7Item>
      </F7List>
    </F7Popover>
  </div>
</template>

<style scoped>
.dark-mode-toggle {
  display: flex;
  align-items: center;
  margin-left: 8px;
}

.app-button {
  --color: var(--c-text-primary);
  --padding-start: 8px;
  --padding-end: 8px;
}

.app-popover {
  --width: 200px;
}

.app-list-item {
  --padding-start: 16px;
  --padding-end: 16px;
  cursor: pointer;
}
</style>
