<script setup lang="ts">
import type { NoteLockViewState } from '@/features/note-lock'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { F7Block, F7Button, F7Icon, F7List, F7ListInput } from '@/shared/ui/f7'
import { lockClosed } from '@/shared/ui/icons'

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

const statusMessage = computed(() => {
  return props.errorMessage || cooldownText.value || (props.failedAttempts ? `已连续失败 ${props.failedAttempts} 次` : '')
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
  <div
    data-testid="note-unlock-panel"
    class="display-flex flex-direction-column justify-content-center"
  >
    <F7Block inset class="text-align-center margin-bottom-half">
      <F7Icon :icon="lockClosed" size="24" />
      <p>
        输入备忘录密码以查看
      </p>
    </F7Block>

    <F7Block inset class="display-flex justify-content-center no-margin-vertical">
      <F7List strong inset class="display-inline-block width-auto no-margin-vertical">
        <F7ListInput
          data-testid="note-unlock-panel-pin-field"
          :value="pin"
          :disabled="isCooldownActive || isSubmitting"
          :error-message="statusMessage"
          :error-message-force="!!statusMessage"
          autocomplete="new-password"
          input-id="note-unlock-panel-pin"
          inputmode="numeric"
          maxlength="6"
          name="note-unlock-pin"
          placeholder="输入密码"
          size="8"
          type="password"
          @input="normalizePinValue(($event.target as HTMLInputElement).value)"
          @keyup.enter="submit"
        />
      </F7List>
    </F7Block>

    <F7Block inset class="margin-vertical-half">
      <F7Button
        data-testid="note-unlock-panel-submit"
        :disabled="!canSubmit"
        fill
        large
        @click="submit"
      >
        {{ isSubmitting ? '解锁中...' : '解锁' }}
      </F7Button>

      <F7Button
        v-if="biometricEnabled && deviceSupportsBiometric"
        data-testid="note-unlock-panel-biometric"
        :disabled="isSubmitting || isCooldownActive"
        large
        @click="$emit('tryBiometric')"
      >
        尝试生物识别
      </F7Button>
    </F7Block>
  </div>
</template>
