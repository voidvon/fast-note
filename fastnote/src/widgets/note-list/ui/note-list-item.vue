<script setup lang="ts">
import type { FolderTreeNode } from '@/entities/note'
import type { NoteLockIndicatorState } from '@/features/note-lock'
import { IonAccordion, IonIcon, IonItem, IonLabel, IonNote, useIonRouter } from '@ionic/vue'
import { folderOutline, lockClosed, lockOpen, trashOutline } from 'ionicons/icons'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { NOTE_TYPE } from '@/entities/note'
import { formatNotePreviewLine } from '@/shared/lib/date'
import { useDeviceType } from '@/shared/lib/device'

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

const route = useRoute()
const router = useIonRouter()
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

  if (noteData.value.id === 'deleted') {
    return `/deleted`
  }

  if (noteData.value.item_type === NOTE_TYPE.FOLDER) {
    /**
     * 文件夹跳转逻辑
     * 1. isDesktop 不跳转
     * 2. 首页到文件夹: /f/ + id
     * 3. 用户公开页面到文件夹: /:username/f/ + id
     * 4. 文件夹到文件夹: 当前路径 + id
     */
    const isHome = route.path === '/home'
    const isUserHome = route.params.username && (route.name === 'UserHome' || route.path === `/${route.params.username}`)

    if (isHome) {
      return `/f/${noteData.value.id}`
    }
    else if (isUserHome) {
      return `/${route.params.username}/f/${noteData.value.id}`
    }
    else {
      return `${route.path}/${noteData.value.id}`
    }
  }

  // 笔记跳转逻辑
  const isUserContext = route.params.username
  if (isUserContext) {
    return `/${route.params.username}/n/${noteData.value.id}`
  }

  return `/n/${noteData.value.id}`
})

function onClick() {
  emit('selected', noteData.value.id)
  // 只在移动端且未禁用路由时才执行路由跳转
  if (!props.disabledRoute && !isDesktop.value && router) {
    router.push(routerLink.value)
  }
}
</script>

<template>
  <IonAccordion v-if="noteData.item_type === NOTE_TYPE.FOLDER" :value="noteData.id" :class="{ 'no-children': !childrenData.length }" class="message-list-item">
    <IonItem
      v-if="noteData"
      slot="header"
      :detail="false"
      :data-id="noteData.id"
      class="list-item"
      lines="inset"
      style="--inner-border-width: 0 0 0.55px 0;"
    >
      <IonIcon :icon="noteData.id === 'deleted' ? trashOutline : folderOutline" class="folder-icon mr-3 primary" />
      <IonLabel
        class="ion-text-wrap my-0! py-[10px]!"
        @click.stop="onClick"
      >
        <h2 class="mb-0 line-height-[24px]">
          {{ noteData.title }}
          <span class="date">
            <IonNote class="text-gray-400 text-base font-semibold">{{ noteData.note_count }}</IonNote>
          </span>
        </h2>
      </IonLabel>
    </IonItem>
    <div v-if="childrenData.length" slot="content">
      <NoteListItem v-for="d in childrenData" :key="d.originNote.id" :data="d" :lock-indicator-state-map="lockIndicatorStateMap" :disabled-route class="child-list-item" @selected="$emit('selected', $event)" />
    </div>
  </IonAccordion>
  <IonItem
    v-else
    :detail="false"
    :data-id="noteData.id"
    class="list-item note-list-item--note"
    lines="inset"
  >
    <div
      class="note-leading-slot"
      :data-lock-state="resolvedLockIndicatorState"
      data-testid="note-leading-slot"
      @click.stop="onClick"
    >
      <IonIcon
        v-if="showLockIcon"
        :icon="lockIcon"
        class="note-lock-icon"
        data-testid="note-lock-icon"
      />
    </div>
    <IonLabel
      class="note-label ion-text-wrap my-0! py-[10px]!"
      @click.stop="onClick"
    >
      <h2>
        {{ noteData.title }}
        <span class="date">
          <!-- <ion-note>{{ noteData.created }}</ion-note> -->
          <!-- <ion-icon aria-hidden="true" :icon="chevronForward" size="small" /> -->
        </span>
      </h2>
      <p class="text-gray-400! text-elipsis!">
        {{ formatNotePreviewLine(noteData.created, noteData.summary) }}
      </p>
      <p v-if="showParentFolder" class="text-gray-400!">
        <IonIcon :icon="folderOutline" class="v-text-bottom" />
        {{ data.folderName }}
      </p>
    </IonLabel>
  </IonItem>
</template>

<style lang="scss">
.message-list-item {
  &.no-children {
    .ion-accordion-toggle-icon {
      transform: rotate(270deg) !important;
      color: var(--c-purple-gray-550);
    }
  }
  .child-list-item {
    .folder-icon,
    .note-leading-slot {
      --uno: pl-8;
    }
    .child-list-item {
      .folder-icon,
      .note-leading-slot {
        --uno: pl-16;
      }
      .child-list-item {
        .folder-icon,
        .note-leading-slot {
          --uno: pl-24;
        }
        .child-list-item {
          .folder-icon,
          .note-leading-slot {
            --uno: pl-32;
          }
        }
      }
    }
  }
  .ion-accordion-toggle-icon {
    transform: rotate(270deg);
    color: var(--primary);
  }
  &.accordion-expanding > [slot='header'] .ion-accordion-toggle-icon,
  &.accordion-expanded > [slot='header'] .ion-accordion-toggle-icon {
    transform: rotate(360deg);
  }
  // TODO: 子级选中没有样式变化
  &.active {
    ion-item {
      --background: var(--bg-active);
    }
  }
}
.list-item {
  .ion-accordion-toggle-icon {
    font-size: 1.125rem;
  }
}
</style>

<style lang="scss" scoped>
.list-item {
  --background: var(--c-blue-gray-950);
  --border-color: var(--c-blue-gray-700);
  // --background-hover: var(--c-purple-gray-700);
  &.active {
    --background: var(--bg-active);
  }
}

.note-list-item--note {
  --padding-start: 10px;
  --inner-padding-start: 0;

  .note-leading-slot {
    align-items: flex-start;
    align-self: stretch;
    color: var(--c-icon);
    cursor: pointer;
    display: flex;
    flex: 0 0 1.5rem;
    justify-content: flex-start;
    min-width: 1.5rem;
    padding: 12px 0 10px;
    width: 1.5rem;
  }

  .note-lock-icon {
    font-size: 1.125rem;
    margin-top: 1px;
  }

  .note-label {
    min-width: 0;
  }
}

.list-item h2 {
  font-weight: 600;

  /**
   * With larger font scales
   * the date/time should wrap to the next
   * line. However, there should be
   * space between the name and the date/time
   * if they can appear on the same line.
   */
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
}

.list-item .date {
  align-items: center;
  display: flex;
}

.list-item ion-note {
  margin-right: 8px;
}

.list-item ion-note.md {
  margin-right: 14px;
}
</style>
