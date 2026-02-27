<script setup lang="ts">
import type { AlertButton } from '@ionic/vue'
import type { FolderTreeNode, Note } from '@/types'
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  onIonViewDidEnter,
  onIonViewWillEnter,
} from '@ionic/vue'
import { addOutline, createOutline } from 'ionicons/icons'
import { nanoid } from 'nanoid'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NoteList from '@/components/NoteList.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useFolderBackButton } from '@/hooks/useSmartBackButton'
import { useNote, useUserPublicNotes } from '@/stores'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

const props = withDefaults(
  defineProps<{
    currentFolder?: string
    selectedNoteId?: string
  }>(),
  {
    currentFolder: undefined,
    selectedNoteId: undefined,
  },
)

defineEmits(['selected', 'createNote'])

const route = useRoute()
const { notes, addNote, getNote, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()

const data = ref<Note>({} as Note)

const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)

const folderId = computed(() => {
  // 桌面端：使用 props.currentFolder
  if (isDesktop.value && props.currentFolder) {
    return props.currentFolder
  }
  
  // 移动端：从路由解析
  // 对于 /f/:pathMatch(.*)*，使用 route.params.pathMatch
  if (route.params.pathMatch) {
    const pathMatch = Array.isArray(route.params.pathMatch) 
      ? route.params.pathMatch.join('/')
      : route.params.pathMatch
    // 如果 pathMatch 包含多级路径，取最后一段
    const segments = pathMatch.split('/')
    return segments[segments.length - 1]
  }
  
  // 兜底：从 path 中解析
  const segments = route.path.split('/')
  return segments[segments.length - 1]
})

// 将 folderList 和 noteList 改为计算属性，自动响应 notes 变化
const folderList = computed(() => {
  if (!folderId.value || isUserContext.value) return []
  
  if (folderId.value === 'allnotes' || folderId.value === 'unfilednotes') {
    return []
  }
  
  return getFolderTreeByParentId(folderId.value)
})

const noteList = computed(() => {
  if (!folderId.value) return []
  
  if (folderId.value === 'allnotes') {
    const allNotes = notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
    const allFolders = notes.value.filter(d => d.item_type === NOTE_TYPE.FOLDER && d.is_deleted === 0)
    const folderMap = new Map(allFolders.map(folder => [folder.id, folder]))
    
    allNotes.forEach((note) => {
      if (note.originNote.parent_id) {
        const parentFolder = folderMap.get(note.originNote.parent_id)
        note.folderName = parentFolder ? parentFolder.title : '备忘录'
      } else {
        note.folderName = '备忘录'
      }
    })
    return allNotes
  } else if (folderId.value === 'unfilednotes') {
    return notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && !d.parent_id && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
  } else {
    return notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && d.parent_id === folderId.value && d.is_deleted === 0).map(d => ({ originNote: d })) as FolderTreeNode[]
  }
})

const addButtons: AlertButton[] = [
  { text: '取消', role: 'cancel' },
  {
    text: '确认',
    handler: async (d) => {
      const isoTime = getTime()
      await addNote({
        title: d.newFolderName,
        created: getTime(),
        updated: isoTime,
        item_type: NOTE_TYPE.FOLDER,
        parent_id: folderId.value,
        id: nanoid(12),
        version: 1,
        content: '',
        is_deleted: 0,
        is_locked: 0,
        note_count: 0,
      })
      init()
    },
  },
]

const isTopFolder = computed(() => {
  const path = route.path
  const lastId = path.split('/')
  lastId.pop()
  return !/^\d+$/.test(lastId[lastId.length - 1])
})

const folders = computed(() => {
  return folderList.value.toSorted((a, b) => {
    return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
  })
})

const sortedNoteList = computed(() => {
  return noteList.value.toSorted((a, b) => {
    return new Date(b.originNote.updated!).getTime() - new Date(a.originNote.updated!).getTime()
  })
})

const title = computed(() => {
  switch (data.value.id) {
    case 'allnotes':
      return '全部备忘录'
    case 'unfilednotes':
      return '备忘录'
    default:
      return data.value.title
  }
})

// 智能返回按钮
const { backButtonProps } = useFolderBackButton(
  route,
  () => isTopFolder.value,
  username.value,
)

// 桌面端：监听 props.currentFolder 变化
watch(
  () => props.currentFolder,
  () => {
    if (isDesktop.value && props.currentFolder) {
      init()
    }
  },
  { immediate: true },
)

// 移动端：监听路由变化和组件挂载
watch(
  () => route.path,
  () => {
    if (!isDesktop.value) {
      init()
    }
  },
)

onMounted(() => {
  if (!isDesktop.value) {
    init()
  }
})

async function init() {
  const id = folderId.value
  
  if (!id) return

  try {
    if (isUserContext.value) {
      const { getPublicNote } = useUserPublicNotes(username.value)
      const folderInfo = getPublicNote(id)
      if (folderInfo) {
        data.value = folderInfo
      }
    } else {
      // 当前用户的文件夹上下文
      if (id === 'allnotes') {
        data.value = { id: 'allnotes' } as Note
      } else if (id === 'unfilednotes') {
        data.value = { id: 'unfilednotes' } as Note
      } else {
        const res = await getNote(id)
        if (res) {
          data.value = res
        }
      }
    }
  } catch (error) {
    console.error('初始化文件夹数据失败:', error)
  }
}

onIonViewWillEnter(() => {
  if (!isDesktop.value)
    init()
})

onIonViewDidEnter(() => {
  if (!isDesktop.value)
    init()
})

// 暴露 refresh 方法给父组件
defineExpose({
  refresh: init,
})
</script>

<template>
  <IonPage>
    <IonHeader v-if="!isDesktop" :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton v-bind="backButtonProps" text="返回" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonHeader collapse="condense">
        <IonToolbar>
          <IonTitle size="large">
            {{ title }}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <NoteList
        :data-list="[...folders, ...sortedNoteList]"
        :note-uuid="selectedNoteId"
        :show-parent-folder="data.id === 'allnotes'"
        @selected="$emit('selected', $event)"
      />
    </IonContent>
    <IonFooter v-if="!isDesktop">
      <IonToolbar>
        <IonButtons v-if="data.id !== 'allnotes' && !isUserContext" slot="start">
          <IonButton id="add-folder2">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </IonTitle>
        <IonButtons v-if="data.id !== 'allnotes' && !isUserContext" slot="end">
          <IonButton :router-link="`/n/0?parent_id=${folderId}`" router-direction="forward">
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonFooter>
    <IonFooter v-else-if="isDesktop && data.id !== 'allnotes' && !isUserContext">
      <IonToolbar>
        <IonButtons slot="start">
          <IonButton id="add-folder2">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
        <IonTitle>
          {{ folders.length > 0 ? `${folders.length}个文件夹 ·` : '' }}
          {{ noteList.length > 0 ? `${noteList.length}个备忘录` : '无备忘录' }}
        </IonTitle>
        <IonButtons slot="end">
          <IonButton @click="$emit('createNote', folderId)">
            <IonIcon :icon="createOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonFooter>
    <IonAlert
      trigger="add-folder2"
      header="请输入文件夹名称"
      :buttons="addButtons"
      :inputs="[{ name: 'newFolderName', placeholder: '请输入文件夹名称' }]"
    />
  </IonPage>
</template>
