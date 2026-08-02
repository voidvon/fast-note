<script setup lang="ts">
import type { FolderTreeNode } from '@/entities/note'
import type { NoteLockIndicatorState } from '@/features/note-lock'
import { computed } from 'vue'
import { NOTE_TYPE } from '@/entities/note'
import { formatNotePreviewLine } from '@/shared/lib/date'
import { useDeviceType } from '@/shared/lib/device'
import { F7Accordion, F7Icon, F7Item, F7List, F7Note, useAppRoute, useAppRouter } from '@/shared/ui/f7'
import { folderOutline, lockClosed, lockOpen, trashOutline } from '@/shared/ui/icons'

defineOptions({
  name: 'NoteListItem',
})

const props = withDefaults(
  defineProps<{
    data: FolderTreeNode
    lockIndicatorStateMap?: Partial<Record<string, NoteLockIndicatorState>>
    showParentFolder?: boolean
    disabledRoute?: boolean
  }>(),
  {
    lockIndicatorStateMap: () => ({}),
    showParentFolder: false,
    disabledRoute: false,
  },
)

const emit = defineEmits(['selected'])

const route = useAppRoute()
const router = useAppRouter()
const { isDesktop } = useDeviceType()

// 计算属性：获取实际的 Note 数据
const noteData = computed(() => {
  return props.data.originNote
})

// 计算属性：获取子节点数据
const childrenData = computed(() => {
  return props.data.children || []
})

const resolvedLockIndicatorState = computed<NoteLockIndicatorState>(() => {
  if (noteData.value.item_type !== NOTE_TYPE.NOTE) {
    return 'placeholder'
  }

  const sessionState = props.lockIndicatorStateMap?.[noteData.value.id]
  if (sessionState) {
    return sessionState
  }

  return noteData.value.is_locked === 1 ? 'locked' : 'placeholder'
})

const showLockIcon = computed(() => {
  return resolvedLockIndicatorState.value !== 'placeholder'
})

const lockIcon = computed(() => {
  return resolvedLockIndicatorState.value === 'unlocked' ? lockOpen : lockClosed
})

const routerLink = computed(() => {
  if (isDesktop.value)
    return undefined

  if (noteData.value.id === 'deleted')
    return '/deleted'

  if (noteData.value.item_type === NOTE_TYPE.FOLDER) {
    const username = route.params.username as string | undefined
    if (route.path === '/home')
      return `/f/${noteData.value.id}`
    if (username && (route.name === 'UserHome' || route.path === `/${username}`))
      return `/${username}/f/${noteData.value.id}`
    return `${route.path}/${noteData.value.id}`
  }

  const username = route.params.username as string | undefined
  return username
    ? `/${username}/n/${noteData.value.id}`
    : `/n/${noteData.value.id}`
})

function onClick() {
  emit('selected', noteData.value.id)
  if (!props.disabledRoute && routerLink.value)
    void router.push(routerLink.value)
}
</script>

<template>
  <F7Accordion
    v-if="noteData.item_type === NOTE_TYPE.FOLDER"
    :value="noteData.id"
    :data-id="noteData.id"
    :class="{ 'no-children': !childrenData.length }"
    class="message-list-item"
  >
    <template #media>
      <F7Icon
        :icon="noteData.id === 'deleted' ? trashOutline : folderOutline"
        class="folder-icon primary"
        @click.stop="onClick"
      />
    </template>
    <template #title>
      <div
        :data-id="noteData.id"
        class="folder-item-title app-text-wrap"
        @click.stop="onClick"
      >
        <span>{{ noteData.title }}</span>
      </div>
    </template>
    <template #after>
      <F7Note class="text-gray-400 text-base font-semibold" @click.stop="onClick">
        {{ noteData.note_count }}
      </F7Note>
    </template>
    <template #content>
      <F7List v-if="childrenData.length" class="child-note-list">
        <NoteListItem v-for="d in childrenData" :key="d.originNote.id" :data="d" :lock-indicator-state-map="lockIndicatorStateMap" :disabled-route class="child-list-item" @selected="$emit('selected', $event)" />
      </F7List>
    </template>
  </F7Accordion>
  <F7Item
    v-else
    :detail="false"
    :data-id="noteData.id"
    :data-lock-state="resolvedLockIndicatorState"
    class="list-item note-list-item--note"
    lines="inset"
    media-item
    @click="onClick"
  >
    <template v-if="showLockIcon" #before-title>
      <F7Icon
        :icon="lockIcon"
        size="13"
        class="note-lock-icon"
        data-testid="note-lock-icon"
      />
    </template>
    <template #title>
      {{ noteData.title }}
    </template>
    <template #text>
      {{ formatNotePreviewLine(noteData.created, noteData.summary) }}
    </template>
    <template v-if="showParentFolder" #footer>
      <F7Icon :icon="folderOutline" size="12" class="note-folder-icon" aria-hidden="true" />
      {{ data.folderName }}
    </template>
  </F7Item>
</template>

<style lang="scss">
.message-list-item {
  .folder-item-title {
    cursor: pointer;
    width: 100%;
  }

  > .item-link > .item-content > .item-inner > .item-title {
    flex: 1;
  }

  &.no-children {
    .accordion-item-toggle-icon {
      transform: rotate(270deg) !important;
      color: var(--c-purple-gray-550);
    }
  }
  .child-list-item {
    .folder-icon {
      --uno: pl-8;
    }
    .child-list-item {
      .folder-icon {
        --uno: pl-16;
      }
      .child-list-item {
        .folder-icon {
          --uno: pl-24;
        }
        .child-list-item {
          .folder-icon {
            --uno: pl-32;
          }
        }
      }
    }
  }
  .accordion-item-toggle-icon {
    transform: rotate(270deg);
    color: var(--primary);
  }
  &.accordion-item-opened > .item-link .accordion-item-toggle-icon {
    transform: rotate(360deg);
  }
  // TODO: 子级选中没有样式变化
  &.active {
    > .item-link > .item-content {
      background: var(--c-list-active-background);
    }
  }
}
.list-item {
  .accordion-item-toggle-icon {
    font-size: 1.125rem;
  }
}
</style>

<style lang="scss" scoped>
.list-item {
  --f7-list-item-border-color: var(--c-blue-gray-700);

  > .item-content {
    background: var(--c-list-background);
  }

  &:hover > .item-content {
    background: var(--c-list-hover-background);
  }

  &.active {
    > .item-content {
      background: var(--c-list-active-background);
    }
  }
}

.note-list-item--note {
  --f7-list-item-title-font-size: 18px;
  --f7-list-item-text-max-lines: 1;
  --f7-list-item-text-text-color: var(--c-text-secondary);
  --f7-list-item-footer-text-color: var(--c-text-secondary);

  :deep(.item-title-row) {
    align-items: center;
    justify-content: flex-start;
  }

  :deep(.item-footer) {
    align-items: center;
    display: flex;
    gap: 3px;
  }

  .note-lock-icon {
    align-self: center;
    color: var(--c-icon);
    flex: 0 0 auto;
    margin-right: 4px;
  }

  .note-folder-icon {
    flex: 0 0 auto;
  }
}

.list-item .app-note {
  margin-right: 8px;
}

.list-item .app-note.md {
  margin-right: 14px;
}
</style>
