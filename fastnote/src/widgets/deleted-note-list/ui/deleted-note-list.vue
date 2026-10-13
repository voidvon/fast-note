<script setup lang="ts">
import type { FolderTreeNode } from '@/shared/types'
import { computed } from 'vue'
import { useNote } from '@/entities/note'
import { useSimpleBackButton } from '@/processes/navigation'
import { useDeviceType } from '@/shared/lib/device'
import {
  F7BackButton,
  F7Content,
  F7Navbar,
  F7Page,
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
</script>

<template>
  <F7Page class="deleted-note-page" :class="{ 'deleted-note-page--desktop': isDesktop }">
    <F7Navbar
      class="deleted-note-navbar"
      title="最近删除"
      :large="!isDesktop"
      :title-large="!isDesktop ? '最近删除' : undefined"
    >
      <template v-if="!isDesktop" #nav-left>
        <F7BackButton v-bind="backButtonProps" />
      </template>
    </F7Navbar>

    <F7Content class="deleted-note-content" :fullscreen="true">
      <NoteList
        :note-uuid="props.selectedNoteId"
        :data-list="dataList"
        :press-items="[{ type: 'restore' }, { type: 'deleteNow' }]"
        media-list
        @selected="$emit('selected', $event)"
      />
    </F7Content>
    <F7Toolbar v-if="!isDesktop" bottom>
      <div class="deleted-note-summary">
        {{ dataList.length > 0 ? `${dataList.length}个备忘录` : '无备忘录' }}
      </div>
    </F7Toolbar>
  </F7Page>
</template>

<style lang="scss">
.deleted-note-page {
  &.app-page-embedded.deleted-note-page--desktop {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr);

    > .deleted-note-navbar,
    > .deleted-note-content {
      grid-area: 1 / 1;
    }

    > .deleted-note-navbar {
      z-index: 20;
      align-self: start;
    }

    > .deleted-note-content {
      --f7-page-navbar-offset: calc(var(--f7-navbar-height) + var(--f7-safe-area-top));
    }
  }

  .deleted-note-summary {
    width: 100%;
    text-align: center;
    font-size: 13px;
    color: var(--c-text-secondary);
  }
}
</style>
