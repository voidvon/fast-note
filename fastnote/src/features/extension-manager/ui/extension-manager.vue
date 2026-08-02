<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  F7Button,
  F7Buttons,
  F7Content,
  F7Header,
  F7Icon,
  F7Item,
  F7Label,
  F7List,
  F7Modal,
  F7Title,
  F7Toggle,
  F7Toolbar,
} from '@/shared/ui/f7'
import { closeOutline } from '@/shared/ui/icons'
import { useExtensions } from '../model/use-extensions'

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
  <F7Modal
    ref="modal"
    :is-open="isOpen"
    :presenting-element="presentingElement"
    @did-dismiss="closeModal"
  >
    <F7Header>
      <F7Toolbar>
        <F7Title>扩展管理</F7Title>
        <F7Buttons position="end">
          <F7Button @click="closeModal">
            <F7Icon :icon="closeOutline" />
          </F7Button>
        </F7Buttons>
      </F7Toolbar>
    </F7Header>
    <F7Content>
      <F7List>
        <F7Item v-for="extension in extensions" :key="extension.id">
          <template #media>
            <F7Icon v-if="extension.icon" size="small" />
          </template>
          <!-- :icon="extension.icon" -->
          <F7Label>
            <h2>{{ extension.name }}</h2>
            <p>{{ extension.description }}</p>
          </F7Label>
          <template #after>
            <div class="flex items-center">
              <div v-if="loadingExtensions[extension.id]" class="mr-2 text-sm text-gray-500">
                下载中...
              </div>
              <div v-if="errorExtensions[extension.id]" class="mr-2 text-sm text-red-500">
                {{ errorExtensions[extension.id] }}
              </div>
              <F7Toggle
                :model-value="extension.enabled"
                :disabled="loadingExtensions[extension.id]"
                @update:model-value="handleToggleExtension(extension.id)"
              />
            </div>
          </template>
        </F7Item>
        <div class="mt-2 text-sm text-center">
          v0.0.1({{ version }})
        </div>
      </F7List>
    </F7Content>
  </F7Modal>
</template>
