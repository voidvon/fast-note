<script setup lang="ts">
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSkeletonText,
  IonToolbar,
} from '@ionic/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NoteDetailPage from '@/pages/note-detail'
import UserPublicNotesPage from '@/pages/user-public-notes'
import { loadPublicNote } from '@/processes/public-notes'
import { useDeviceType } from '@/shared/lib/device'

const route = useRoute()
const { isDesktop } = useDeviceType()
const loading = ref(true)
const error = ref('')
let requestVersion = 0

const username = computed(() => route.params.username as string || '')
const noteId = computed(() => route.params.noteId as string || '')
const publicHomePath = computed(() => `/${encodeURIComponent(username.value)}`)

async function loadNote() {
  if (isDesktop.value || !username.value || !noteId.value) {
    requestVersion += 1
    loading.value = false
    error.value = ''
    return
  }

  const currentRequest = ++requestVersion
  loading.value = true
  error.value = ''

  try {
    const note = await loadPublicNote(username.value, noteId.value)
    if (currentRequest !== requestVersion) {
      return
    }
    if (!note) {
      throw new Error('公开备忘录不存在')
    }
  }
  catch (loadError) {
    if (currentRequest !== requestVersion) {
      return
    }
    error.value = loadError instanceof Error ? loadError.message : '无法加载备忘录'
    console.error('加载公开备忘录失败:', loadError)
  }
  finally {
    if (currentRequest === requestVersion) {
      loading.value = false
    }
  }
}

watch([username, noteId, isDesktop], () => {
  void loadNote()
}, { immediate: true })
</script>

<template>
  <UserPublicNotesPage v-if="isDesktop" />
  <NoteDetailPage v-else-if="!loading && !error" />
  <IonPage v-else>
    <IonHeader :translucent="true">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton :default-href="publicHomePath" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent force-overscroll>
      <div v-if="loading" class="public-note-skeleton" aria-label="正在加载备忘录">
        <IonSkeletonText animated class="public-note-skeleton__title" />
        <IonSkeletonText animated class="public-note-skeleton__meta" />
        <div class="public-note-skeleton__body">
          <IonSkeletonText v-for="width in ['94%', '87%', '91%', '68%', '89%', '76%']" :key="width" animated :style="{ width }" />
        </div>
      </div>
      <div v-else class="public-note-load-error" role="alert">
        {{ error }}
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped lang="scss">
.public-note-skeleton {
  padding: 28px 20px;
}

.public-note-skeleton__title {
  width: min(72%, 320px);
  height: 32px;
  margin: 0 0 14px;
}

.public-note-skeleton__meta {
  width: 112px;
  height: 14px;
  margin: 0 0 36px;
}

.public-note-skeleton__body {
  display: grid;
  gap: 15px;
}

.public-note-skeleton__body ion-skeleton-text {
  height: 16px;
  margin: 0;
}

.public-note-load-error {
  display: grid;
  min-height: 50vh;
  padding: 24px;
  place-items: center;
  color: var(--ion-color-medium);
  text-align: center;
}
</style>
