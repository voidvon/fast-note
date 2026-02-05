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
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NoteList from '@/components/NoteList.vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useIonicLongPressList } from '@/hooks/useIonicLongPressList'
import { useFolderBackButton } from '@/hooks/useSmartBackButton'
import { useNote, useUserPublicNotes } from '@/stores'
import { NOTE_TYPE } from '@/types'
import { getTime } from '@/utils/date'

const props = withDefaults(
  defineProps<{
    currentFolder?: string
  }>(),
  {
    currentFolder: undefined,
  },
)

defineEmits(['selected', 'createNote'])

const route = useRoute()
const { notes, addNote, getNote, getFolderTreeByParentId } = useNote()
const { isDesktop } = useDeviceType()

const longPressMenuOpen = ref(false)
const longPressUUID = ref('')
const listRef = ref()
useIonicLongPressList(listRef, {
  itemSelector: 'ion-item', // 匹配 ion-item 元素
  duration: 500,
  pressedClass: 'item-long-press',
  onItemLongPress: async (element) => {
    const id = element.getAttribute('id')
    if (id) {
      longPressUUID.value = id
      longPressMenuOpen.value = true
    }
  },
})
const data = ref<Note>({} as Note)
const folderList = ref<FolderTreeNode[]>([])
const noteList = ref<FolderTreeNode[]>([])

const folderId = computed(() => {
  const path = route.path
  const lastId = path.split('/')
  return lastId[lastId.length - 1]
})

const username = computed(() => route.params.username as string)
const isUserContext = computed(() => !!username.value)

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

watch(
  () => props.currentFolder,
  () => {
    if (props.currentFolder)
      init()
  },
  { immediate: true },
)

async function init() {
  let id
  if (isDesktop.value)
    id = props.currentFolder
  else
    id = folderId.value
  if (!id)
    return

  try {
    if (isUserContext.value) {
      const { publicNotes, getPublicFolderTreeByPUuid, getPublicNote } = useUserPublicNotes(username.value)

      // 用户公开文件夹上下文
      const folderInfo = getPublicNote(id)
      if (folderInfo) {
        data.value = folderInfo
      }

      folderList.value = getPublicFolderTreeByPUuid(id)
      if (publicNotes.value)
        noteList.value = publicNotes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && d.parent_id === id).map(d => ({ originNote: d })) as FolderTreeNode[]

      // 直接使用数据库中的 note_count，无需计算
    }
    else {
      // 当前用户的文件夹上下文
      const res = await getNote(id)
      if (res)
        data.value = res

      if (id === 'allnotes') {
        data.value = { id: 'allnotes' } as Note
        /**
         * 获取备忘录所属的分类名称
         * 1. 获取所有分类
         * 2. 找到当前备忘录所属的分类
         * 3. 将分类名称赋值给当前备忘录
         */
        const allNotes = notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE).map(d => ({ originNote: d })) as FolderTreeNode[]
        const allFolders = notes.value.filter(d => d.item_type === NOTE_TYPE.FOLDER)
        // 将文件夹数组转换为 Map，以 id 为键
        const folderMap = new Map(allFolders.map(folder => [folder.id, folder]))

        // 遍历 dataList，为每个备忘录查找并设置其所属文件夹的名称
        allNotes.forEach((note) => {
          if (note.originNote.parent_id) {
            const parentFolder = folderMap.get(note.originNote.parent_id)
            if (parentFolder) {
              note.folderName = parentFolder.title
            }
            else {
              note.folderName = '备忘录'
            }
          }
          else {
            note.folderName = '备忘录'
          }
        })
        noteList.value = allNotes
      }
      else if (id === 'unfilednotes') {
        data.value = { id: 'unfilednotes' } as Note
        noteList.value = notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && !d.parent_id).map(d => ({ originNote: d })) as FolderTreeNode[]
      }
      else {
        folderList.value = getFolderTreeByParentId(id)
        noteList.value = notes.value.filter(d => d.item_type === NOTE_TYPE.NOTE && d.parent_id === id).map(d => ({ originNote: d })) as FolderTreeNode[]
      }
    }
  }
  catch (error) {
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
