<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'
import { lockClosedOutline } from 'ionicons/icons'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  biometricEnabled?: boolean
  cooldownUntil?: number | null
  deviceSupportsBiometric?: boolean
  errorMessage?: string
  failedAttempts?: number
  isSubmitting?: boolean
  lockViewState: 'unlocked' | 'locked' | 'unlocking' | 'cooldown'
}>(), {
  biometricEnabled: false,
  cooldownUntil: null,
  deviceSupportsBiometric: false,
  errorMessage: '',
  failedAttempts: 0,
  isSubmitting: false,
})

const emit = defineEmits<{
  submitPin: [pin: string]
  tryBiometric: []
}>()

const pin = ref('')
const nowTick = ref(Date.now())
let cooldownTimer: number | null = null

const cooldownText = computed(() => {
  if (!props.cooldownUntil) {
    return ''
  }

  const remainingMs = props.cooldownUntil - nowTick.value
  if (remainingMs <= 0) {
    return ''
  }

  return `${Math.ceil(remainingMs / 1000)} 秒后可重试`
})

const isCooldownActive = computed(() => {
  return !!cooldownText.value
})

const canSubmit = computed(() => {
  return !props.isSubmitting && !isCooldownActive.value && pin.value.length === 6
})

watch(() => props.lockViewState, () => {
  if (props.lockViewState !== 'unlocked') {
    pin.value = ''
  }
})

watch(() => props.cooldownUntil, (cooldownUntil) => {
  if (cooldownTimer) {
    window.clearInterval(cooldownTimer)
    cooldownTimer = null
  }

  nowTick.value = Date.now()
  if (!cooldownUntil || cooldownUntil <= nowTick.value) {
    return
  }

  cooldownTimer = window.setInterval(() => {
    nowTick.value = Date.now()
    if (cooldownUntil <= nowTick.value && cooldownTimer) {
      window.clearInterval(cooldownTimer)
      cooldownTimer = null
    }
  }, 1000)
}, { immediate: true })

onBeforeUnmount(() => {
  if (cooldownTimer) {
    window.clearInterval(cooldownTimer)
  }
})

function normalizePinValue(value: string) {
  pin.value = value.replace(/\D+/g, '').slice(0, 6)
}

function submit() {
  if (!canSubmit.value) {
    return
  }

  emit('submitPin', pin.value)
}
</script>

<template>
  <div data-testid="note-unlock-panel" class="note-unlock-panel">
    <div class="note-unlock-panel__card">
      <div class="note-unlock-panel__icon">
        <IonIcon :icon="lockClosedOutline" />
      </div>
      <h2>这篇备忘录已锁定</h2>
      <p>输入 6 位全局 PIN 解锁，支持时也可以使用生物识别快捷解锁。</p>

      <IonButton
        v-if="biometricEnabled && deviceSupportsBiometric"
        data-testid="note-unlock-panel-biometric"
        :disabled="isSubmitting || isCooldownActive"
        fill="outline"
        class="note-unlock-panel__biometric"
        @click="$emit('tryBiometric')"
      >
        尝试生物识别
      </IonButton>

      <label class="note-unlock-panel__field">
        <span>输入 6 位全局 PIN</span>
        <input
          data-testid="note-unlock-panel-pin"
          :value="pin"
          :disabled="isCooldownActive"
          inputmode="numeric"
          maxlength="6"
          placeholder="请输入 6 位数字"
          type="password"
          @input="normalizePinValue(($event.target as HTMLInputElement).value)"
          @keyup.enter="submit"
        >
      </label>

      <div
        v-if="errorMessage || cooldownText || failedAttempts"
        data-testid="note-unlock-panel-message"
        class="note-unlock-panel__message"
      >
        {{ errorMessage || cooldownText || `已连续失败 ${failedAttempts} 次` }}
      </div>

      <IonButton
        data-testid="note-unlock-panel-submit"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ isSubmitting ? '解锁中...' : '解锁' }}
      </IonButton>
    </div>
  </div>
</template>

<style lang="scss">
.note-unlock-panel {
  min-height: calc(100vh - 112px);
  display: grid;
  place-items: center;
  padding: 24px 20px;
}

.note-unlock-panel__card {
  width: min(100%, 420px);
  padding: 28px 24px;
  border-radius: 28px;
  background: linear-gradient(180deg, rgba(245, 248, 252, 0.98) 0%, rgba(255, 255, 255, 0.98) 100%);
  border: 1px solid rgba(177, 194, 214, 0.5);
  box-shadow: 0 18px 40px rgba(34, 49, 69, 0.12);
  text-align: center;

  h2 {
    margin: 14px 0 8px;
    font-size: 26px;
    color: #132033;
  }

  p {
    margin: 0;
    color: #607184;
    line-height: 1.6;
  }
}

.note-unlock-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 24px;
  background: #e8eef6;
  color: #355578;

  ion-icon {
    font-size: 36px;
  }
}

.note-unlock-panel__biometric {
  margin-top: 18px;
}

.note-unlock-panel__field {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  text-align: left;

  span {
    font-size: 14px;
    font-weight: 600;
    color: #314255;
  }

  input {
    width: 100%;
    border: 1px solid #d5deea;
    border-radius: 14px;
    padding: 14px 16px;
    background: rgba(255, 255, 255, 0.92);
    font-size: 16px;
    color: #122033;
    outline: none;

    &:focus {
      border-color: #4f7fb7;
      box-shadow: 0 0 0 3px rgba(79, 127, 183, 0.15);
    }
  }
}

.note-unlock-panel__message {
  margin-top: 14px;
  border-radius: 14px;
  padding: 12px 14px;
  background: #f6ece5;
  color: #92552f;
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
}
</style>
