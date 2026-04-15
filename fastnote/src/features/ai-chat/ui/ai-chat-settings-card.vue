<script setup lang="ts">
import { IonButton, IonInput, IonItem, IonLabel, IonList, IonNote } from '@ionic/vue'

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
  <section>
    <IonNote>
      当前是浏览器直连模式，API Key 会保存在本地浏览器，请只在受信任环境中使用。
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
          :model-value="props.apiKey"
          label="API Key"
          label-placement="stacked"
          type="password"
          placeholder="sk-..."
          @update:model-value="emit('update:apiKey', String($event ?? ''))"
        />
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
