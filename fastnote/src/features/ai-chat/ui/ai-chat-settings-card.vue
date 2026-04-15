<script setup lang="ts">
import { IonButton, IonInput, IonItem, IonList } from '@ionic/vue'

const props = defineProps<{
  apiKey: string
  baseUrl: string
  model: string
}>()

const emit = defineEmits<{
  'reset': []
  'save': []
  'update:apiKey': [value: string]
  'update:baseUrl': [value: string]
  'update:model': [value: string]
}>()
</script>

<template>
  <section class="ai-chat-settings-card">
    <div class="ai-chat-settings-card__copy">
      <p class="ai-chat-settings-card__title">
        配置直连模型
      </p>
      <p class="ai-chat-settings-card__hint">
        当前是浏览器直连模式，API Key 会保存在本地浏览器，请只在受信任环境中使用。
      </p>
    </div>

    <IonList lines="none" class="ai-chat-settings-card__list">
      <IonItem class="ai-chat-settings-card__item">
        <IonInput
          :model-value="props.baseUrl"
          label="Base URL"
          label-placement="stacked"
          fill="outline"
          inputmode="url"
          type="url"
          placeholder="https://api.openai.com/v1"
          @update:model-value="emit('update:baseUrl', String($event ?? ''))"
        />
      </IonItem>

      <IonItem class="ai-chat-settings-card__item">
        <IonInput
          :model-value="props.model"
          label="Model"
          label-placement="stacked"
          fill="outline"
          type="text"
          placeholder="gpt-4.1-mini"
          @update:model-value="emit('update:model', String($event ?? ''))"
        />
      </IonItem>

      <IonItem class="ai-chat-settings-card__item">
        <IonInput
          :model-value="props.apiKey"
          label="API Key"
          label-placement="stacked"
          fill="outline"
          type="password"
          placeholder="sk-..."
          @update:model-value="emit('update:apiKey', String($event ?? ''))"
        />
      </IonItem>
    </IonList>

    <div class="ai-chat-settings-card__actions">
      <IonButton class="ai-chat-settings-card__save-button" @click="emit('save')">
        保存配置
      </IonButton>
      <IonButton fill="clear" class="ai-chat-settings-card__secondary-button" @click="emit('reset')">
        恢复默认
      </IonButton>
    </div>
  </section>
</template>

<style scoped lang="scss">
.ai-chat-settings-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.05)), rgba(255, 255, 255, 0.04);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.ai-chat-settings-card__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-chat-settings-card__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #f5f5f7;
}

.ai-chat-settings-card__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #a1a1aa;
}

.ai-chat-settings-card__list {
  padding: 0;
  background: transparent;
}

.ai-chat-settings-card__item {
  --background: transparent;
  --padding-start: 0;
  --inner-padding-end: 0;
  --inner-padding-start: 0;
  --border-width: 0;
  --inner-border-width: 0;
  --min-height: auto;
}

.ai-chat-settings-card__item + .ai-chat-settings-card__item {
  margin-top: 10px;
}

.ai-chat-settings-card__item ion-input {
  --background: rgba(12, 12, 14, 0.44);
  --border-radius: 14px;
  --color: #f5f5f7;
  --label-color: #d4d4d8;
  --placeholder-color: #8e8e93;
}

.ai-chat-settings-card__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.ai-chat-settings-card__save-button {
  --background: linear-gradient(135deg, #38bdf8, #22c55e);
  --color: #04111f;
  --border-radius: 12px;
  margin: 0;
  font-weight: 600;
}

.ai-chat-settings-card__secondary-button {
  --color: #d4d4d8;
  margin: 0;
}
</style>
