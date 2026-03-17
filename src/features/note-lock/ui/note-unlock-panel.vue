<script setup lang="ts">
import type { NoteLockViewState } from '@/features/note-lock'
import { IonButton, IonIcon } from '@ionic/vue'
import { lockClosed } from 'ionicons/icons'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  biometricEnabled?: boolean
  cooldownUntil?: number | null
  deviceSupportsBiometric?: boolean
  errorMessage?: string
  failedAttempts?: number
  isSubmitting?: boolean
  lockViewState: NoteLockViewState
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
        <IonIcon :icon="lockClosed" />
      </div>
      <h2>备忘录已锁定</h2>
      <p class="note-unlock-panel__subtitle">
        输入备忘录密码以查看
      </p>

      <IonButton
        v-if="biometricEnabled && deviceSupportsBiometric"
        data-testid="note-unlock-panel-biometric"
        :disabled="isSubmitting || isCooldownActive"
        fill="clear"
        class="note-unlock-panel__biometric"
        @click="$emit('tryBiometric')"
      >
        尝试生物识别
      </IonButton>

      <label class="note-unlock-panel__field">
        <input
          data-testid="note-unlock-panel-pin"
          :value="pin"
          :disabled="isCooldownActive"
          inputmode="numeric"
          maxlength="6"
          placeholder="输入密码"
          type="text"
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
        class="note-unlock-panel__submit"
        @click="submit"
      >
        {{ isSubmitting ? '解锁中...' : '解锁' }}
      </IonButton>
    </div>
  </div>
</template>

<style lang="scss">
.note-unlock-panel {
  --note-unlock-text: var(--c-text-primary);
  --note-unlock-muted: var(--c-text-secondary);
  --note-unlock-icon-text: var(--c-blue-gray-700);
  --note-unlock-input-border: var(--c-border);
  --note-unlock-input-focus: var(--primary);
  --note-unlock-input-ring: color-mix(in srgb, var(--primary) 24%, transparent);
  min-height: calc(100vh - 112px);
  display: grid;
  place-items: center;
  padding: 24px 20px;
}

.note-unlock-panel__card {
  width: min(100%, 420px);
  padding: 12px 0;
  text-align: center;

  h2 {
    margin: 12px 0 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--note-unlock-text);
  }
}

.note-unlock-panel__subtitle {
  margin: 8px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--note-unlock-muted);
}

.note-unlock-panel__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--note-unlock-icon-text);

  ion-icon {
    font-size: 64px;
  }
}

.note-unlock-panel__biometric {
  margin-top: 14px;
}

.note-unlock-panel__field {
  margin-top: 28px;
  display: flex;
  justify-content: center;

  input {
    width: min(100%, 220px);
    border: 1px solid var(--note-unlock-input-border);
    border-radius: 10px;
    padding: 12px 14px;
    background: transparent;
    font-size: 16px;
    color: var(--note-unlock-text);
    text-align: center;
    outline: none;

    &::placeholder {
      color: var(--note-unlock-muted);
    }

    &:focus {
      border-color: var(--note-unlock-input-focus);
      box-shadow: 0 0 0 3px var(--note-unlock-input-ring);
    }
  }
}

.note-unlock-panel__message {
  margin-top: 14px;
  color: var(--danger);
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
}

.note-unlock-panel__submit {
  margin-top: 18px;
  width: min(100%, 220px);
}
</style>
