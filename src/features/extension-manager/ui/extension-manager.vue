<script setup lang="ts">
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { closeOutline } from 'ionicons/icons'
import { ref, watch } from 'vue'
import { useExtensions } from '@/hooks/useExtensions'

defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  presentingElement: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits(['update:isOpen'])

const { extensions, toggleExtension, isExtensionLoaded } = useExtensions()
const loadingExtensions = ref<Record<string, boolean>>({})
const errorExtensions = ref<Record<string, string>>({})
const version = window.version

// 处理扩展切换
async function handleToggleExtension(id: string) {
  try {
    loadingExtensions.value[id] = true
    errorExtensions.value[id] = ''
    await toggleExtension(id)
  }
  catch (error) {
    errorExtensions.value[id] = `加载失败: ${error instanceof Error ? error.message : '未知错误'}`
    console.error(`扩展 ${id} 切换失败:`, error)
  }
  finally {
    loadingExtensions.value[id] = false
  }
}

// 监听扩展加载状态
watch(() => extensions, (newExtensions) => {
  for (const ext of newExtensions) {
    if (ext.enabled && !isExtensionLoaded(ext.id) && !loadingExtensions.value[ext.id]) {
      handleToggleExtension(ext.id)
    }
  }
}, { deep: true })

const modal = ref()

function closeModal() {
  emit('update:isOpen', false)
}
</script>

<template>
  <IonModal
    ref="modal"
    :is-open="isOpen"
    :presenting-element="presentingElement"
    @did-dismiss="closeModal"
  >
    <IonHeader>
      <IonToolbar>
        <IonTitle>扩展管理</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="closeModal">
            <IonIcon :icon="closeOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonList>
        <IonItem v-for="extension in extensions" :key="extension.id">
          <IonIcon
            v-if="extension.icon"
            slot="start"
            size="small"
          />
          <!-- :icon="extension.icon" -->
          <IonLabel>
            <h2>{{ extension.name }}</h2>
            <p>{{ extension.description }}</p>
          </IonLabel>
          <div slot="end" class="flex items-center">
            <div v-if="loadingExtensions[extension.id]" class="mr-2 text-sm text-gray-500">
              下载中...
            </div>
            <div v-if="errorExtensions[extension.id]" class="mr-2 text-sm text-red-500">
              {{ errorExtensions[extension.id] }}
            </div>
            <IonToggle
              :model-value="extension.enabled"
              :disabled="loadingExtensions[extension.id]"
              @update:model-value="handleToggleExtension(extension.id)"
            />
          </div>
        </IonItem>
        <div class="mt-2 text-sm text-center">
          v0.0.1({{ version }})
        </div>
      </IonList>
    </IonContent>
  </IonModal>
</template>
