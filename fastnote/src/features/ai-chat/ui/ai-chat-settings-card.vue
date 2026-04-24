<script setup lang="ts">
import { IonButton, IonInput, IonItem, IonList, IonNote } from '@ionic/vue'

const props = defineProps<{
  apiKey: string
  baseUrl: string
  contextWindowHint?: string
  contextWindowTokens?: number | string
  model: string
  supportsNativeTools?: boolean
  tokenizerHint?: string
}>()

const emit = defineEmits<{
  'reset': []
  'save': []
  'update:apiKey': [value: string]
  'update:baseUrl': [value: string]
  'update:contextWindowTokens': [value: string]
  'update:model': [value: string]
  'update:supportsNativeTools': [value: boolean]
}>()
</script>

<template>
  <section>
    <IonNote>
      当前是浏览器直连模式，API Key 会保存在本地浏览器，请只在受信任环境中使用。
    </IonNote>
    <IonNote v-if="props.contextWindowHint" class="ai-chat-settings-card__hint">
      {{ props.contextWindowHint }}
    </IonNote>
    <IonNote v-if="props.tokenizerHint" class="ai-chat-settings-card__hint">
      {{ props.tokenizerHint }}
    </IonNote>

    <IonList>
      <IonItem>
        <IonInput
          :model-value="props.baseUrl"
          label="Base URL"
          label-placement="stacked"
          inputmode="url"
          type="url"
          placeholder="https://api.openai.com/v1"
          @update:model-value="emit('update:baseUrl', String($event ?? ''))"
        />
      </IonItem>

      <IonItem>
        <IonInput
          :model-value="props.model"
          label="Model"
          label-placement="stacked"
          type="text"
          placeholder="gpt-4.1-mini"
          @update:model-value="emit('update:model', String($event ?? ''))"
        />
      </IonItem>

      <IonItem>
        <IonInput
          :model-value="props.contextWindowTokens ? String(props.contextWindowTokens) : ''"
          label="Context Window Tokens"
          label-placement="stacked"
          inputmode="numeric"
          type="number"
          placeholder="留空则按模型名推断，如 128000"
          @update:model-value="emit('update:contextWindowTokens', String($event ?? ''))"
        />
      </IonItem>

      <IonItem>
        <IonInput
          :model-value="props.apiKey"
          label="API Key"
          label-placement="stacked"
          type="password"
          placeholder="sk-..."
          @update:model-value="emit('update:apiKey', String($event ?? ''))"
        />
      </IonItem>

      <IonItem class="ai-chat-settings-card__checkbox-item">
        <label class="ai-chat-settings-card__checkbox">
          <input
            :checked="props.supportsNativeTools === true"
            type="checkbox"
            @change="emit('update:supportsNativeTools', ($event.target as HTMLInputElement).checked)"
          >
          <span>使用原生 Tools / Function Calling</span>
        </label>
      </IonItem>
    </IonList>

    <div class="ion-padding-top">
      <IonButton expand="block" @click="emit('save')">
        保存配置
      </IonButton>
      <IonButton expand="block" fill="clear" @click="emit('reset')">
        恢复默认
      </IonButton>
    </div>
  </section>
</template>

<style scoped>
.ai-chat-settings-card__hint {
  display: block;
  margin-top: 8px;
}

.ai-chat-settings-card__checkbox-item {
  --inner-padding-end: 0;
}

.ai-chat-settings-card__checkbox {
  align-items: center;
  display: flex;
  gap: 10px;
  padding: 12px 0;
  width: 100%;
}
</style>
