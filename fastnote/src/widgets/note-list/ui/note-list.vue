<script setup lang="ts">
import type { VirtualList } from 'framework7/types'
import type { DefineComponent, Ref } from 'vue'
import type { FolderTreeNode } from '@/entities/note'
import type { NoteActionMenuItem } from '@/features/note-actions-menu'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, toRaw, toRef, watch } from 'vue'
import { NOTE_TYPE } from '@/entities/note'
import { useGlobalSearch } from '@/features/global-search'
import NoteActionsMenu from '@/features/note-actions-menu'
import { useNoteLockIndicatorState } from '@/features/note-lock'
import { useDeviceType } from '@/shared/lib/device'
import { useLongPressList } from '@/shared/lib/framework7'
import { F7AccordionGroup, F7List } from '@/shared/ui/f7'
import NoteListItem from './note-list-item.vue'

const props = withDefaults(
  defineProps<{
    dataList: FolderTreeNode[]
    allNotesCount?: number
    unfiledNotesCount?: number
    deletedNoteCount?: number
    showAllNotes?: boolean
    showUnfiledNotes?: boolean
    showDelete?: boolean
    noteUuid?: string
    showParentFolder?: boolean
    pressItems?: NoteActionMenuItem[]
    presentingElement?: HTMLElement
    disabledRoute?: boolean
    disabledLongPress?: boolean
    expandedStateKey?: string
    inset?: boolean
    mediaList?: boolean
    virtualNotes?: boolean
    scrollableParentEl?: HTMLElement | string
  }>(),
  {
    allNotesCount: 0,
    unfiledNotesCount: 0,
    deletedNoteCount: 0,
    showAllNotes: false,
    showUnfiledNotes: false,
    showDelete: false,
    noteUuid: '',
    showParentFolder: false,
    pressItems: () => [{ type: 'rename' }, { type: 'move' }, { type: 'delete' }],
    disabledRoute: false,
    disabledLongPress: false,
    expandedStateKey: '',
    inset: true,
    mediaList: false,
    virtualNotes: false,
  },
)
const emit = defineEmits(['refresh', 'update:noteUuid', 'selected'])
const NoteMoveModal: DefineComponent = defineAsyncComponent(
  () => import('@/features/note-move/ui/note-move-modal.vue').then(module => module.default),
) as unknown as DefineComponent
const { isDesktop } = useDeviceType()
const { showGlobalSearch } = useGlobalSearch()
const EXPANDED_STATE_STORAGE_PREFIX = 'note-list-expanded:'

// const { getNote } = useNote()

const listRef = ref<DefineComponent>()
const virtualListRef = ref<DefineComponent>()
const longPressId = ref('')
const longPressMenuOpen = ref(false)
const showMoveModal = ref(false)
const moveNoteId = ref('')
const expandedItems = ref<string[]>([])
const longPressMenuRef = ref()
const movePresentingElement = ref<HTMLElement>()
let handleWheel: ((event: WheelEvent) => void) | null = null
const virtualData = ref<{
  fromIndex: number
  items: FolderTreeNode[]
  topPosition: number
}>({
  fromIndex: 0,
  items: [],
  topPosition: 0,
})
const { indicatorStateMap } = useNoteLockIndicatorState(toRef(props, 'dataList'))
const longPressEnabled = computed(() => {
  return !props.disabledLongPress
    && !showGlobalSearch.value
    && !longPressMenuOpen.value
    && !showMoveModal.value
})

const standardItems = computed(() => {
  if (!props.virtualNotes)
    return props.dataList

  return props.dataList.filter(item => item.originNote.item_type === NOTE_TYPE.FOLDER)
})

const virtualNoteItems = computed(() => {
  if (!props.virtualNotes)
    return []

  return props.dataList.filter(item => item.originNote.item_type === NOTE_TYPE.NOTE)
})

const hasStandardItems = computed(() => (
  props.showAllNotes
  || props.showUnfiledNotes
  || (props.showDelete && props.deletedNoteCount > 0)
  || standardItems.value.length > 0
))
const virtualRowHeight = computed(() => props.showParentFolder ? 84 : 68)
const virtualListParams = computed(() => ({
  items: virtualNoteItems.value,
  height: virtualRowHeight.value,
  rowsBefore: 8,
  rowsAfter: 8,
  cache: false,
  scrollableParentEl: props.scrollableParentEl,
  renderExternal(_virtualList: VirtualList.VirtualList, data: typeof virtualData.value) {
    virtualData.value = data
  },
}))

const persistedExpandedStateKey = computed(() => {
  if (!props.expandedStateKey)
    return ''

  return `${EXPANDED_STATE_STORAGE_PREFIX}${props.expandedStateKey}`
})

const availableFolderIds = computed(() => {
  const folderIds = new Set<string>()

  function traverse(nodes: FolderTreeNode[]) {
    nodes.forEach((node) => {
      if (node.originNote?.item_type === NOTE_TYPE.FOLDER && node.originNote.id) {
        folderIds.add(node.originNote.id)
      }

      if (node.children?.length) {
        traverse(node.children)
      }
    })
  }

  if (props.showAllNotes)
    folderIds.add('allnotes')

  if (props.showUnfiledNotes)
    folderIds.add('unfilednotes')

  if (props.showDelete && props.deletedNoteCount > 0)
    folderIds.add('deleted')

  traverse(props.dataList)
  return folderIds
})

function normalizeExpandedItems(items: unknown): string[] {
  if (Array.isArray(items)) {
    return items.filter((item): item is string => typeof item === 'string' && !!item)
  }

  if (typeof items === 'string' && items) {
    return [items]
  }

  return []
}

function restoreExpandedItems() {
  if (!persistedExpandedStateKey.value)
    return

  try {
    const savedValue = localStorage.getItem(persistedExpandedStateKey.value)
    expandedItems.value = savedValue ? normalizeExpandedItems(JSON.parse(savedValue)) : []
  }
  catch (error) {
    console.error('恢复文件夹展开状态失败:', error)
    expandedItems.value = []
  }
}

function persistExpandedItems(items: string[]) {
  if (!persistedExpandedStateKey.value)
    return

  try {
    localStorage.setItem(persistedExpandedStateKey.value, JSON.stringify(items))
  }
  catch (error) {
    console.error('保存文件夹展开状态失败:', error)
  }
}

if (!props.disabledLongPress) {
  const longPressOptions = {
    itemSelector: '.app-list-item',
    duration: 500,
    pressedClass: 'item-long-press',
    isDesktop: isDesktop.value,
    enabled: longPressEnabled,
    onItemLongPress: async (element: HTMLElement) => {
      const id = element.getAttribute('data-id')
      if (id && !['allnotes', 'deleted', 'unfilednotes'].includes(id)) {
        longPressId.value = id
        longPressMenuOpen.value = true
      }
    },
  }
  useLongPressList(listRef as Ref<DefineComponent>, longPressOptions)
  useLongPressList(virtualListRef as Ref<DefineComponent>, longPressOptions)
}

function onSelected(id: string) {
  emit('update:noteUuid', id)
  emit('selected', id)
}

function onMove(id: string) {
  moveNoteId.value = id
  if (longPressMenuRef.value?.$el) {
    movePresentingElement.value = longPressMenuRef.value.$el
  }
  else {
    movePresentingElement.value = props.presentingElement
  }
  setTimeout(() => {
    showMoveModal.value = true
  }, 300)
}

function setExpandedItems(items: string[] | string | undefined) {
  const normalizedItems = normalizeExpandedItems(items)
  expandedItems.value = normalizedItems
  persistExpandedItems(normalizedItems)
}

watch(availableFolderIds, (folderIds) => {
  if (!persistedExpandedStateKey.value || folderIds.size === 0)
    return

  const filteredItems = expandedItems.value.filter(id => folderIds.has(id))
  if (filteredItems.length === expandedItems.value.length)
    return

  expandedItems.value = filteredItems
  persistExpandedItems(filteredItems)
}, { immediate: true })

watch(persistedExpandedStateKey, () => {
  restoreExpandedItems()
})

watch(virtualNoteItems, async (items) => {
  if (!props.virtualNotes)
    return

  await nextTick()
  const element = virtualListRef.value?.$el as (HTMLElement & {
    f7VirtualList?: VirtualList.VirtualList
  }) | undefined
  element?.f7VirtualList?.replaceAllItems(toRaw(items))
})

onMounted(() => {
  restoreExpandedItems()

  if (!isDesktop.value)
    return

  handleWheel = (e: WheelEvent) => {
    const pageContent = (e.currentTarget as HTMLElement).closest<HTMLElement>('.page-content, .app-content')
    if (!pageContent)
      return

    pageContent.scrollTop += e.deltaY
    e.preventDefault()
  }

  const elements = [listRef.value?.$el, virtualListRef.value?.$el].filter(Boolean) as HTMLElement[]
  elements.forEach(element => element.addEventListener('wheel', handleWheel!, { passive: false, capture: true }))
})

onUnmounted(() => {
  if (handleWheel) {
    const elements = [listRef.value?.$el, virtualListRef.value?.$el].filter(Boolean) as HTMLElement[]
    elements.forEach(element => element.removeEventListener('wheel', handleWheel!, { capture: true }))
  }
  handleWheel = null
})

defineExpose({
  setExpandedItems,
})
</script>

<template>
  <div
    class="note-list-container"
    :class="{ 'note-list-container--split': hasStandardItems && virtualNoteItems.length }"
  >
    <F7List
      v-if="hasStandardItems || !virtualNotes"
      ref="listRef"
      :inset
      strong
      accordion-list
      :media-list
      :class="{ 'note-list--media': mediaList, 'note-list--folders': virtualNotes }"
    >
      <slot name="header" />
      <template #list>
        <F7AccordionGroup :value="expandedItems" multiple @f7-change="(event: CustomEvent) => setExpandedItems(event.detail.value)">
          <NoteListItem
            v-if="showAllNotes"
            key="allnotes"
            :data="{
              originNote: {
                id: 'allnotes',
                title: '全部备忘录',
                item_type: NOTE_TYPE.FOLDER,
                parent_id: '',
                note_count: allNotesCount,
                created: '',
                content: '',
                updated: '',
                is_deleted: 0,
                is_locked: 0,
                summary: '',
              },
              children: [],
            } as FolderTreeNode"
            :class="{ active: noteUuid === 'allnotes' }"
            :disabled-route
            :lock-indicator-state-map="indicatorStateMap"
            @selected="onSelected('allnotes')"
          />
          <NoteListItem
            v-if="showUnfiledNotes"
            key="unfilednotes"
            :data="{
              originNote: {
                id: 'unfilednotes',
                title: '备忘录',
                item_type: NOTE_TYPE.FOLDER,
                parent_id: '',
                note_count: unfiledNotesCount,
                created: '',
                content: '',
                updated: '',
                is_deleted: 0,
                is_locked: 0,
                summary: '',
              },
              children: [],
            } as FolderTreeNode"
            :class="{ active: noteUuid === 'unfilednotes' }"
            :disabled-route
            :lock-indicator-state-map="indicatorStateMap"
            @selected="onSelected('unfilednotes')"
          />
          <NoteListItem
            v-for="d in standardItems"
            :key="d.originNote.id"
            :data="d"
            :class="{ active: noteUuid === d.originNote.id }"
            :show-parent-folder
            :disabled-route
            :selected-id="noteUuid"
            :lock-indicator-state-map="indicatorStateMap"
            @selected="onSelected($event)"
          />
          <NoteListItem
            v-if="showDelete && deletedNoteCount > 0"
            :data="{
              originNote: {
                id: 'deleted',
                title: '最近删除',
                item_type: NOTE_TYPE.FOLDER,
                parent_id: '',
                note_count: deletedNoteCount,
                created: '',
                content: '',
                updated: '',
                is_deleted: 0,
                is_locked: 0,
                summary: '',
              },
              children: [],
            } as FolderTreeNode"
            :class="{ active: noteUuid === 'deleted' }"
            :disabled-route
            :lock-indicator-state-map="indicatorStateMap"
            @selected="onSelected('deleted')"
          />
        </F7AccordionGroup>
      </template>
    </F7List>

    <F7List
      v-if="virtualNoteItems.length"
      ref="virtualListRef"
      :inset
      strong
      :media-list
      virtual-list
      :virtual-list-params="virtualListParams"
      class="note-list--virtual"
      :class="{ 'note-list--media': mediaList }"
    >
      <NoteListItem
        v-for="(item, index) in virtualData.items"
        :key="item.originNote.id"
        :data="item"
        :show-parent-folder
        :disabled-route
        :selected-id="noteUuid"
        :lock-indicator-state-map="indicatorStateMap"
        :virtual-list-index="virtualData.fromIndex + index"
        :virtual-row-height="virtualRowHeight"
        :style="{ top: `${virtualData.topPosition}px` }"
        @selected="onSelected($event)"
      />
    </F7List>
  </div>
  <NoteActionsMenu
    :id="longPressId"
    ref="longPressMenuRef"
    :is-open="longPressMenuOpen"
    :items="pressItems"
    :presenting-element
    @did-dismiss="() => longPressMenuOpen = false"
    @move="onMove"
    @refresh="$emit('refresh')"
  />

  <NoteMoveModal
    :id="moveNoteId"
    :is-open="showMoveModal"
    :presenting-element="movePresentingElement"
    @did-dismiss="() => showMoveModal = false"
    @refresh="$emit('refresh')"
  />
</template>

<style lang="scss" scoped>
.note-list--media {
  --f7-list-strong-bg-color: var(--c-list-group-background);

  :deep(> ul > .note-list-item--note > .item-content) {
    background: transparent;
  }
}

.note-list-container--split {
  .note-list--folders {
    margin-bottom: 0;

    :deep(> ul) {
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }
  }

  .note-list--virtual {
    margin-top: 0;

    :deep(> ul) {
      border-top-left-radius: 0;
      border-top-right-radius: 0;
    }
  }
}
</style>
