<script setup lang="ts">
import type { DefineComponent, Ref } from 'vue'
import type { ItemType } from '@/components/LongPressMenu.vue'
import type { FolderTreeNode } from '@/types'
import { IonAccordionGroup, IonList } from '@ionic/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import LongPressMenu from '@/components/LongPressMenu.vue'
import NoteMove from '@/components/NoteMove.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useIonicLongPressList } from '@/hooks/useIonicLongPressList'
import { NOTE_TYPE } from '@/types'
import NoteListItem from './NoteListItem.vue'

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
    pressItems?: { type: ItemType }[]
    presentingElement?: HTMLElement
    disabledRoute?: boolean
    disabledLongPress?: boolean
    expandedStateKey?: string
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
  },
)
const emit = defineEmits(['refresh', 'update:noteUuid', 'selected'])
const { isDesktop } = useDeviceType()
const EXPANDED_STATE_STORAGE_PREFIX = 'note-list-expanded:'

// const { getNote } = useNote()

const listRef = ref<DefineComponent>()
const longPressId = ref('')
const longPressMenuOpen = ref(false)
const showMoveModal = ref(false)
const moveNoteId = ref('')
const expandedItems = ref<string[]>([])
const longPressMenuRef = ref()
const movePresentingElement = ref<HTMLElement>()

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
  useIonicLongPressList(listRef as Ref<DefineComponent>, {
    itemSelector: 'ion-item',
    duration: 500,
    pressedClass: 'item-long-press',
    isDesktop: isDesktop.value,
    onItemLongPress: async (element) => {
      const id = element.getAttribute('data-id')
      if (id && !['allnotes', 'deleted', 'unfilednotes'].includes(id)) {
        longPressId.value = id
        longPressMenuOpen.value = true
      }
    },
  })
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

onMounted(() => {
  restoreExpandedItems()

  if (!isDesktop.value || !listRef.value?.$el)
    return

  const handleWheel = (e: WheelEvent) => {
    const ionContent = (e.currentTarget as HTMLElement).closest('ion-content')
    if (!ionContent)
      return

    const scrollElement = ionContent.shadowRoot?.querySelector('.inner-scroll') || ionContent
    scrollElement.scrollTop += e.deltaY
    e.preventDefault()
  }

  listRef.value.$el.addEventListener('wheel', handleWheel, { passive: false, capture: true })

  onUnmounted(() => {
    listRef.value?.$el?.removeEventListener('wheel', handleWheel, { capture: true })
  })
})

defineExpose({
  setExpandedItems,
})
</script>

<template>
  <IonList ref="listRef" inset>
    <slot name="header" />
    <IonAccordionGroup :value="expandedItems" multiple @ion-change="(event: CustomEvent) => setExpandedItems(event.detail.value)">
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
        @selected="onSelected('unfilednotes')"
      />
      <NoteListItem
        v-for="d in dataList"
        :key="d.originNote.id"
        :data="d"
        :class="{ active: noteUuid === d.originNote.id }"
        :show-parent-folder
        :disabled-route
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
        @selected="onSelected('deleted')"
      />
    </IonAccordionGroup>
  </IonList>
  <LongPressMenu
    :id="longPressId"
    ref="longPressMenuRef"
    :is-open="longPressMenuOpen"
    :items="pressItems"
    :presenting-element
    @did-dismiss="() => longPressMenuOpen = false"
    @move="onMove"
    @refresh="$emit('refresh')"
  />

  <NoteMove
    :id="moveNoteId"
    :is-open="showMoveModal"
    :presenting-element="movePresentingElement"
    @did-dismiss="() => showMoveModal = false"
    @refresh="$emit('refresh')"
  />
</template>
