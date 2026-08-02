<script setup lang="ts">
import type { VirtualList } from 'framework7/types'
import type { VirtualNoteRow } from '../model/virtual-note-list'
import {
  f7List as F7List,
  f7ListItem as F7ListItem,
  f7Navbar as F7Navbar,
  f7NavLeft as F7NavLeft,
  f7NavTitle as F7NavTitle,
  f7Page as F7Page,
  f7PageContent as F7PageContent,
} from 'framework7-vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useNote } from '@/entities/note'
import { useAppRouter } from '@/shared/lib/framework7'
import { NOTE_TYPE } from '@/shared/types'
import { buildVirtualNoteRows } from '../model/virtual-note-list'

interface VirtualRenderData {
  fromIndex: number
  items: VirtualNoteRow[]
  topPosition: number
}

const router = useAppRouter()
const { notes } = useNote()
const query = ref('')
const listRevision = ref(0)
const virtualData = ref<VirtualRenderData>({
  fromIndex: 0,
  items: [],
  topPosition: 0,
})

const rows = computed(() => buildVirtualNoteRows(notes.value, query.value))
const virtualListParams = computed(() => ({
  items: rows.value,
  height: 72,
  rowsBefore: 8,
  rowsAfter: 8,
  cache: false,
  renderExternal(_virtualList: VirtualList.VirtualList, data: VirtualRenderData) {
    virtualData.value = data
  },
}))

watch(rows, async () => {
  virtualData.value = {
    fromIndex: 0,
    items: [],
    topPosition: 0,
  }
  listRevision.value += 1
  await nextTick()
}, { flush: 'post' })

function openRow(row: VirtualNoteRow) {
  if (row.itemType === NOTE_TYPE.FOLDER) {
    void router.push(`/f/${row.id}`)
    return
  }

  void router.push(`/n/${row.id}`)
}

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }

  void router.replace('/home')
}
</script>

<template>
  <F7Page :page-content="false" class="f7-preview" data-testid="framework7-preview">
    <F7Navbar>
      <F7NavLeft>
        <button type="button" class="f7-preview__back" aria-label="返回" @click="goBack">
          <span aria-hidden="true">‹</span>
        </button>
      </F7NavLeft>
      <F7NavTitle>备忘录</F7NavTitle>
    </F7Navbar>

    <F7PageContent class="f7-preview__content">
      <div class="f7-preview__search-wrap">
        <label class="f7-preview__search">
          <span class="f7-preview__search-icon" aria-hidden="true" />
          <input v-model="query" type="search" placeholder="搜索备忘录" aria-label="搜索备忘录">
        </label>
        <div class="f7-preview__count" aria-live="polite">
          {{ rows.length }} 项
        </div>
      </div>

      <F7List
        v-if="rows.length"
        :key="listRevision"
        inset
        strong
        dividers
        media-list
        virtual-list
        :virtual-list-params="virtualListParams"
        class="f7-preview__list"
      >
        <F7ListItem
          v-for="(row, index) in virtualData.items"
          :key="row.id"
          :title="row.title"
          :subtitle="row.subtitle"
          :virtual-list-index="virtualData.fromIndex + index"
          :style="{ top: `${virtualData.topPosition}px` }"
          class="f7-preview__row"
          :class="{ 'f7-preview__row--folder': row.itemType === NOTE_TYPE.FOLDER }"
          @click="openRow(row)"
        >
          <template #media>
            <span class="f7-preview__media" aria-hidden="true">
              {{ row.itemType === NOTE_TYPE.FOLDER ? 'F' : 'N' }}
            </span>
          </template>
        </F7ListItem>
      </F7List>

      <div v-else class="f7-preview__empty">
        {{ query ? '没有匹配的备忘录' : '暂无备忘录' }}
      </div>
    </F7PageContent>
  </F7Page>
</template>

<style scoped lang="scss">
.f7-preview {
  --f7-navbar-bg-color: color-mix(in srgb, var(--c-page-background) 78%, transparent);
  --f7-navbar-border-color: transparent;
  --f7-navbar-text-color: var(--c-text-primary);
  --f7-page-bg-color: var(--c-page-background);
  --f7-list-bg-color: var(--c-list-background);
  --f7-list-item-border-color: var(--c-blue-gray-700);
  --f7-list-item-title-text-color: var(--c-text-primary);
  --f7-list-item-subtitle-text-color: var(--c-text-secondary);
  background: var(--c-page-background);
  color: var(--c-text-primary);

  &__content {
    background: var(--c-page-background);
    overflow-y: auto;
    padding-top: calc(var(--f7-navbar-height) + env(safe-area-inset-top) + 12px);
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }

  &__back {
    align-items: center;
    appearance: none;
    background: transparent;
    border: 0;
    color: var(--f7-theme-color);
    cursor: pointer;
    display: inline-flex;
    font-size: 36px;
    height: 44px;
    justify-content: center;
    padding: 0;
    width: 44px;
  }

  &__search-wrap {
    align-items: center;
    display: flex;
    gap: 12px;
    margin: 4px 16px 12px;
  }

  &__search {
    align-items: center;
    background: var(--c-list-background);
    border: 1px solid var(--c-blue-gray-700);
    border-radius: 8px;
    display: flex;
    flex: 1;
    min-width: 0;
    padding: 0 12px;
  }

  &__search-icon {
    border: 2px solid var(--c-icon);
    border-radius: 50%;
    height: 12px;
    margin-right: 10px;
    position: relative;
    width: 12px;

    &::after {
      background: var(--c-icon);
      content: '';
      height: 2px;
      position: absolute;
      right: -6px;
      top: 10px;
      transform: rotate(45deg);
      width: 7px;
    }
  }

  &__search input {
    appearance: none;
    background: transparent;
    border: 0;
    color: inherit;
    font: inherit;
    height: 44px;
    min-width: 0;
    outline: none;
    width: 100%;
  }

  &__count {
    color: var(--c-icon);
    flex: 0 0 auto;
    font-size: 13px;
  }

  &__list {
    --f7-list-bg-color: var(--c-list-background);
    --f7-list-item-border-color: var(--c-blue-gray-700);
    --f7-list-item-title-text-color: var(--c-text-primary);
    --f7-list-item-subtitle-text-color: var(--c-text-secondary);
    margin-bottom: 0;
    margin-top: 0;
  }

  &__row {
    cursor: pointer;
    height: 72px;
  }

  &__media {
    align-items: center;
    background: var(--c-list-active-background);
    border-radius: 8px;
    color: var(--f7-theme-color);
    display: flex;
    font-size: 12px;
    font-weight: 700;
    height: 34px;
    justify-content: center;
    width: 34px;
  }

  &__row--folder &__media {
    background: var(--c-list-hover-background);
  }

  &__empty {
    color: var(--c-icon);
    padding: 48px 24px;
    text-align: center;
  }
}

.f7-preview :deep(.navbar) {
  --f7-navbar-bg-color: color-mix(in srgb, var(--c-page-background) 78%, transparent);
  --f7-navbar-text-color: var(--c-text-primary);
}
</style>
