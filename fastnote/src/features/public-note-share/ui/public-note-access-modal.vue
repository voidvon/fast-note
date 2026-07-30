<script setup lang="ts">
import type { Note } from '@/shared/types'
import { IonButton, IonIcon, IonModal, IonToggle, toastController } from '@ionic/vue'
import { copyOutline, globeOutline, linkOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { copyText } from '@/shared/lib/clipboard'
import { buildPublicNoteUrl, usePublicNoteAccess } from '../model/use-public-note-share'

const props = defineProps<{
  isOpen: boolean
  note: Note
  username?: string
}>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
  'updated': [note: Note]
}>()

const { togglePublic } = usePublicNoteAccess()
const isUpdating = ref(false)

const isPublic = computed(() => Boolean(props.note.is_public))
const publicUrl = computed(() => {
  if (!props.username || !props.note.id) {
    return ''
  }

  return buildPublicNoteUrl(props.note, props.username, window.location.origin)
})

async function showToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
  const toast = await toastController.create({
    message,
    duration: 2000,
    position: 'bottom',
    color,
  })
  await toast.present()
}

async function onPublicChange(event: CustomEvent<{ checked: boolean }>) {
  if (isUpdating.value || event.detail.checked === isPublic.value) {
    return
  }

  isUpdating.value = true
  try {
    const result = await togglePublic(props.note)
    if (result.ok) {
      emit('updated', result.note)
    }
    await showToast(result.message, result.color)
  }
  finally {
    isUpdating.value = false
  }
}

async function copyPublicLink() {
  if (!publicUrl.value) {
    await showToast('无法生成公开链接，请重新登录后重试', 'warning')
    return
  }

  try {
    await copyText(publicUrl.value)
    await showToast('公开链接已复制')
  }
  catch (error) {
    console.error('复制公开链接失败:', error)
    await showToast('复制失败，请重试', 'danger')
  }
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :initial-breakpoint="1"
    :breakpoints="[0, 1]"
    class="public-note-access-modal"
    @did-dismiss="emit('update:isOpen', false)"
  >
    <section class="public-note-access-panel">
      <header class="public-note-access-header">
        <div class="public-note-access-title">
          <IonIcon :icon="globeOutline" aria-hidden="true" />
          <h2>公开设置</h2>
        </div>
        <IonButton fill="clear" size="small" @click="emit('update:isOpen', false)">
          完成
        </IonButton>
      </header>

      <div class="public-note-access-control">
        <div>
          <strong>公开访问</strong>
          <p>{{ isPublic ? '任何获得链接的人都可以查看' : '仅你自己可以查看' }}</p>
        </div>
        <IonToggle
          aria-label="公开访问"
          :checked="isPublic"
          :disabled="isUpdating"
          @ion-change="onPublicChange"
        />
      </div>

      <div v-if="isPublic" class="public-note-access-link">
        <div class="public-note-access-url">
          <IonIcon :icon="linkOutline" aria-hidden="true" />
          <span>{{ publicUrl || '暂时无法生成公开链接' }}</span>
        </div>
        <IonButton
          fill="clear"
          :disabled="!publicUrl"
          title="复制公开链接"
          aria-label="复制公开链接"
          @click="copyPublicLink"
        >
          <IonIcon slot="icon-only" :icon="copyOutline" />
        </IonButton>
      </div>
    </section>
  </IonModal>
</template>

<style lang="scss">
.public-note-access-modal {
  --height: fit-content;
  --max-height: 360px;
  --border-radius: 16px 16px 0 0;

  &::part(content) {
    max-height: 360px;
  }
}

.public-note-access-panel {
  padding: 18px 20px calc(24px + env(safe-area-inset-bottom));
  background: var(--c-blue-gray-900);
  color: var(--c-text-primary);
}

.public-note-access-header,
.public-note-access-control,
.public-note-access-link,
.public-note-access-title,
.public-note-access-url {
  display: flex;
  align-items: center;
}

.public-note-access-header {
  justify-content: space-between;
  min-height: 40px;
}

.public-note-access-title {
  gap: 10px;

  ion-icon {
    width: 22px;
    height: 22px;
    color: var(--ion-color-success);
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.public-note-access-control {
  justify-content: space-between;
  gap: 20px;
  padding: 18px 0;

  strong {
    font-size: 15px;
  }

  p {
    margin: 5px 0 0;
    color: var(--c-text-secondary);
    font-size: 13px;
    line-height: 1.4;
  }
}

.public-note-access-link {
  gap: 8px;
  min-width: 0;
  padding: 8px 8px 8px 12px;
  border: 1px solid var(--c-blue-gray-700);
  border-radius: 8px;
  background: var(--c-blue-gray-800);
}

.public-note-access-url {
  flex: 1;
  gap: 8px;
  min-width: 0;

  ion-icon {
    flex: 0 0 auto;
  }

  span {
    overflow: hidden;
    color: var(--c-text-secondary);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
