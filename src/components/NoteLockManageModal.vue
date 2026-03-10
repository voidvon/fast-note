<script setup lang="ts">
import type { Note } from '@/types'
import { IonButton, IonModal } from '@ionic/vue'
import { computed, reactive, watch } from 'vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useNoteLock } from '@/hooks/useNoteLock'

const props = withDefaults(defineProps<{
  biometricEnabled?: boolean
  deviceSupportsBiometric: boolean
  isOpen: boolean
  note?: Note | null
  noteId: string
}>(), {
  biometricEnabled: false,
  note: null,
})

const emit = defineEmits<{
  'updated': [payload: {
    action: 'change_global_pin' | 'toggle_biometric' | 'relock' | 'disable_lock'
    note: Note
    biometricEnabled: boolean
    code: string
    message: string | null
  }]
  'update:isOpen': [value: boolean]
}>()

const { isDesktop } = useDeviceType()
const noteLock = useNoteLock()

const state = reactive({
  biometricEnabled: false,
  errorMessage: '',
  isSubmitting: false,
  mode: 'summary' as 'summary' | 'change_global_pin',
  pin: '',
})

const canSubmitPin = computed(() => {
  return !state.isSubmitting
    && state.mode === 'change_global_pin'
    && state.pin.length === 6
    && !!props.noteId
})

const modalBreakpoints = computed(() => {
  return isDesktop.value ? undefined : [0, 1]
})

const modalInitialBreakpoint = computed(() => {
  return isDesktop.value ? undefined : 1
})

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    return
  }

  state.biometricEnabled = props.deviceSupportsBiometric && props.biometricEnabled
  state.errorMessage = ''
  state.isSubmitting = false
  state.mode = 'summary'
  state.pin = ''
}, { immediate: true })

function dismiss() {
  emit('update:isOpen', false)
}

function normalizePinValue(value: string) {
  return value.replace(/\D+/g, '').slice(0, 6)
}

function emitUpdated(
  action: 'change_global_pin' | 'toggle_biometric' | 'relock' | 'disable_lock',
  note: Note,
  options: {
    code?: string
    message?: string | null
  } = {},
) {
  emit('updated', {
    action,
    note,
    biometricEnabled: state.biometricEnabled,
    code: options.code ?? 'ok',
    message: options.message ?? null,
  })
  dismiss()
}

async function handleToggleBiometric() {
  if (!props.note) {
    return
  }

  state.isSubmitting = true
  state.errorMessage = ''

  try {
    const nextEnabled = !state.biometricEnabled
    const result = await noteLock.setBiometricEnabled(nextEnabled)
    if (!result.ok) {
      state.errorMessage = result.message || '更新生物识别设置失败，请重试'
      return
    }

    state.biometricEnabled = Boolean(result.biometricEnabled)
    emitUpdated('toggle_biometric', props.note, {
      code: result.code,
      message: result.message,
    })
  }
  finally {
    state.isSubmitting = false
  }
}

async function handleRelock() {
  if (!props.note) {
    return
  }

  state.isSubmitting = true
  state.errorMessage = ''

  try {
    await noteLock.relock(props.noteId)
    emitUpdated('relock', props.note)
  }
  finally {
    state.isSubmitting = false
  }
}

async function handleDisableLock() {
  if (!props.note) {
    return
  }

  state.isSubmitting = true
  state.errorMessage = ''

  try {
    const result = await noteLock.disableLockForNote(props.noteId)
    if (!result.ok || !result.note) {
      state.errorMessage = result.message || '关闭锁失败，请重试'
      return
    }

    emitUpdated('disable_lock', result.note, {
      code: result.code,
      message: result.message,
    })
  }
  finally {
    state.isSubmitting = false
  }
}

async function handleChangePin() {
  if (!props.noteId || !canSubmitPin.value) {
    return
  }

  state.isSubmitting = true
  state.errorMessage = ''

  try {
    const result = await noteLock.changeGlobalPin(state.pin, state.pin)
    if (!result.ok) {
      state.errorMessage = result.message || '修改全局 PIN 失败，请重试'
      return
    }

    emitUpdated('change_global_pin', props.note!, {
      code: result.code,
      message: result.message,
    })
  }
  finally {
    state.isSubmitting = false
  }
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :breakpoints="modalBreakpoints"
    :initial-breakpoint="modalInitialBreakpoint"
    class="note-lock-manage-modal"
    @did-dismiss="dismiss"
  >
    <div class="note-lock-manage-modal__sheet">
      <div class="note-lock-manage-modal__header">
        <div>
          <h2>{{ state.mode === 'change_global_pin' ? '修改全局 PIN' : 'PIN 设置' }}</h2>
        </div>
        <button
          type="button"
          class="note-lock-manage-modal__close"
          aria-label="关闭"
          @click="dismiss"
        >
          关闭
        </button>
      </div>

      <div class="note-lock-manage-modal__body">
        <label class="note-lock-manage-modal__toggle" :class="{ 'is-disabled': !deviceSupportsBiometric }">
          <div>
            <div class="note-lock-manage-modal__toggle-title">
              生物识别快捷解锁
            </div>
          </div>
          <input
            data-testid="note-lock-manage-biometric"
            :checked="state.biometricEnabled"
            :disabled="!deviceSupportsBiometric || state.isSubmitting"
            type="checkbox"
            @change="handleToggleBiometric"
          >
        </label>

        <div class="note-lock-manage-modal__actions">
          <button
            data-testid="note-lock-manage-change-pin"
            type="button"
            class="note-lock-manage-modal__action"
            :disabled="state.isSubmitting"
            @click="state.mode = state.mode === 'change_global_pin' ? 'summary' : 'change_global_pin'"
          >
            {{ state.mode === 'change_global_pin' ? '取消修改全局 PIN' : '修改全局 PIN' }}
          </button>
          <button
            data-testid="note-lock-manage-relock"
            type="button"
            class="note-lock-manage-modal__action"
            :disabled="state.isSubmitting"
            @click="handleRelock"
          >
            立即重新锁定
          </button>
          <button
            data-testid="note-lock-manage-disable"
            type="button"
            class="note-lock-manage-modal__action note-lock-manage-modal__action--danger"
            :disabled="state.isSubmitting"
            @click="handleDisableLock"
          >
            关闭这篇备忘录的锁
          </button>
        </div>

        <div v-if="state.mode === 'change_global_pin'" class="note-lock-manage-modal__pin-form">
          <label class="note-lock-manage-modal__field">
            <input
              data-testid="note-lock-manage-pin"
              :value="state.pin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入新的 6 位数字"
              type="text"
              @input="state.pin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>

          <IonButton
            data-testid="note-lock-manage-submit-pin"
            :disabled="!canSubmitPin"
            @click="handleChangePin"
          >
            {{ state.isSubmitting ? '处理中...' : '确认修改' }}
          </IonButton>
        </div>

        <div v-if="state.errorMessage" data-testid="note-lock-manage-error" class="note-lock-manage-modal__error">
          {{ state.errorMessage }}
        </div>
      </div>
    </div>
  </IonModal>
</template>

<style lang="scss">
.note-lock-manage-modal {
  --height: auto;
  --border-radius: 24px 24px 0 0;
  --note-lock-manage-panel-bg: var(--c-blue-gray-900);
  --note-lock-manage-text: var(--c-text-primary);
  --note-lock-manage-muted: var(--c-text-secondary);
  --note-lock-manage-surface: var(--c-blue-gray-800);
  --note-lock-manage-border: var(--c-border);
  --note-lock-manage-focus: var(--primary);
  --note-lock-manage-focus-ring: color-mix(in srgb, var(--primary) 24%, transparent);
  --note-lock-manage-toggle-text: var(--c-text-primary);
  --note-lock-manage-danger-bg: color-mix(in srgb, var(--danger) 18%, var(--c-blue-gray-800));
  --note-lock-manage-danger-border: color-mix(in srgb, var(--danger) 40%, var(--c-border));
  --note-lock-manage-danger-text: var(--c-text-primary);
  --note-lock-manage-error-bg: color-mix(in srgb, var(--danger) 18%, var(--c-blue-gray-800));
  --note-lock-manage-error-text: var(--c-text-primary);

  &::part(content) {
    max-width: 480px;
    margin: auto;
  }
}

.note-lock-manage-modal__sheet {
  padding: 20px 20px 24px;
  background: var(--note-lock-manage-panel-bg);
  color: var(--note-lock-manage-text);
}

.note-lock-manage-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 24px;
    line-height: 1.2;
  }
}

.note-lock-manage-modal__close {
  border: 0;
  background: transparent;
  color: var(--note-lock-manage-muted);
  font-size: 14px;
}

.note-lock-manage-modal__body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.note-lock-manage-modal__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 16px;
  padding: 16px;
  background: var(--note-lock-manage-surface);
  border: 1px solid var(--note-lock-manage-border);

  &.is-disabled {
    opacity: 0.7;
  }

  input {
    width: 18px;
    height: 18px;
  }
}

.note-lock-manage-modal__toggle-title {
  font-weight: 600;
  color: var(--note-lock-manage-toggle-text);
}

.note-lock-manage-modal__actions {
  display: grid;
  gap: 10px;
}

.note-lock-manage-modal__action {
  width: 100%;
  border: 1px solid var(--note-lock-manage-border);
  border-radius: 14px;
  padding: 14px 16px;
  background: var(--note-lock-manage-surface);
  text-align: left;
  color: var(--note-lock-manage-toggle-text);
  font-size: 15px;

  &:disabled {
    opacity: 0.6;
  }
}

.note-lock-manage-modal__action--danger {
  color: var(--note-lock-manage-danger-text);
  border-color: var(--note-lock-manage-danger-border);
  background: var(--note-lock-manage-danger-bg);
}

.note-lock-manage-modal__pin-form {
  display: grid;
  gap: 14px;
}

.note-lock-manage-modal__field {
  input {
    width: 100%;
    border: 1px solid var(--note-lock-manage-border);
    border-radius: 14px;
    padding: 14px 16px;
    background: var(--note-lock-manage-surface);
    font-size: 16px;
    color: var(--note-lock-manage-text);
    outline: none;

    &::placeholder {
      color: var(--note-lock-manage-muted);
    }

    &:focus {
      border-color: var(--note-lock-manage-focus);
      box-shadow: 0 0 0 3px var(--note-lock-manage-focus-ring);
    }
  }
}

.note-lock-manage-modal__error {
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--note-lock-manage-error-bg);
  color: var(--note-lock-manage-error-text);
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
}
</style>
