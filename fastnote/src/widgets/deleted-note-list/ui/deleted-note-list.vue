<script setup lang="ts">
import type { FolderTreeNode } from '@/shared/types'
import { computed, onMounted, onUnmounted, reactive } from 'vue'
import { useNote } from '@/entities/note'
import { useSimpleBackButton } from '@/processes/navigation'
import { useDeviceType } from '@/shared/lib/device'
import {
  F7BackButton,
  F7Buttons,
  F7Content,
  F7Footer,
  F7Header,
  F7Navbar,
  F7Page,
  F7Title,
  F7Toolbar,
} from '@/shared/ui/f7'
import NoteList from '@/widgets/note-list'

const props = withDefaults(defineProps<{
  selectedNoteId?: string
}>(), {
  selectedNoteId: '',
})

defineEmits(['selected'])

const { notes } = useNote()
const { isDesktop } = useDeviceType()

// 简单的返回按钮
const { backButtonProps } = useSimpleBackButton('/home', '备忘录')

const dataList = computed<FolderTreeNode[]>(() => {
  const thirtyDaysAgo = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().replace('T', ' ')
  return notes.value
    .filter(note => note.is_deleted === 1 && note.updated >= thirtyDaysAgo)
    .map(note => ({ originNote: note, children: [] }))
})
const state = reactive({
  windowWidth: 0,
})

// 更新窗口宽度的函数
function updateWindowWidth() {
  state.windowWidth = window.innerWidth
}

// 组件挂载时添加监听
onMounted(() => {
  state.windowWidth = window.innerWidth
  window.addEventListener('resize', updateWindowWidth)
})

// 组件卸载时移除监听
onUnmounted(() => {
  window.removeEventListener('resize', updateWindowWidth)
})
</script>

<template>
  <F7Page :class="{ 'deleted-note-page--desktop': isDesktop }">
    <F7Navbar
      v-if="isDesktop"
      class="deleted-note-navbar"
      title="最近删除"
    />

    <F7Header v-if="!isDesktop" :translucent="true">
      <F7Toolbar>
        <F7Buttons position="start">
          <F7BackButton v-bind="backButtonProps" />
        </F7Buttons>
      </F7Toolbar>
    </F7Header>

    <F7Content class="deleted-note-content" :fullscreen="true">
      <F7Header v-if="!isDesktop" collapse="condense">
        <F7Toolbar>
          <F7Title size="large">
            最近删除
          </F7Title>
        </F7Toolbar>
      </F7Header>

      <NoteList
        :note-uuid="props.selectedNoteId"
        :data-list="dataList"
        :press-items="[{ type: 'restore' }, { type: 'deleteNow' }]"
        media-list
        @selected="$emit('selected', $event)"
      />
    </F7Content>
    <F7Footer v-if="!isDesktop">
      <F7Toolbar>
        <F7Title>
          {{ dataList.length > 0 ? `${dataList.length}个备忘录` : '无备忘录' }}
        </F7Title>
      </F7Toolbar>
    </F7Footer>
  </F7Page>
</template>

<style lang="scss">
.app-page-embedded.deleted-note-page--desktop {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
}

.deleted-note-page--desktop > .deleted-note-navbar,
.deleted-note-page--desktop > .deleted-note-content {
  grid-area: 1 / 1;
}

.deleted-note-page--desktop > .deleted-note-navbar {
  z-index: 20;
  align-self: start;
}

.deleted-note-page--desktop > .deleted-note-content {
  --f7-page-navbar-offset: calc(var(--f7-navbar-height) + var(--f7-safe-area-top));
}
</style>
