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
  confirmPin: '',
  errorMessage: '',
  isSubmitting: false,
  mode: 'summary' as 'summary' | 'change_global_pin',
  pin: '',
})

const canSubmitPin = computed(() => {
  return !state.isSubmitting
    && state.mode === 'change_global_pin'
    && state.pin.length === 6
    && state.confirmPin.length === 6
    && !!props.noteId
})

const modalBreakpoints = computed(() => {
  return isDesktop.value ? undefined : [0, 0.72]
})

const modalInitialBreakpoint = computed(() => {
  return isDesktop.value ? undefined : 0.72
})

watch(() => props.isOpen, (isOpen) => {
  if (!isOpen) {
    return
  }

  state.biometricEnabled = props.deviceSupportsBiometric && props.biometricEnabled
  state.confirmPin = ''
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
    const result = await noteLock.changeGlobalPin(state.pin, state.confirmPin)
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
          <div class="note-lock-manage-modal__eyebrow">
            锁设置
          </div>
          <h2>管理备忘录锁</h2>
          <p>已锁备忘录共用同一个全局 PIN，可按需调整快捷解锁和这篇备忘录的锁状态。</p>
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
        <div class="note-lock-manage-modal__summary">
          <div>当前状态：已启用备忘录锁</div>
          <div>
            当前设备：{{ state.biometricEnabled ? '已启用生物识别快捷解锁' : '未启用生物识别快捷解锁' }}
          </div>
          <div>修改全局 PIN 后，将影响全部已锁备忘录。</div>
        </div>

        <label class="note-lock-manage-modal__toggle" :class="{ 'is-disabled': !deviceSupportsBiometric }">
          <div>
            <div class="note-lock-manage-modal__toggle-title">
              当前设备启用生物识别快捷解锁
            </div>
            <div class="note-lock-manage-modal__toggle-desc">
              {{ deviceSupportsBiometric ? '启用后解锁页可优先尝试生物识别。' : '当前设备不支持生物识别，仍可正常使用 PIN 解锁。' }}
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
            <span>输入新的 6 位全局 PIN</span>
            <input
              data-testid="note-lock-manage-pin"
              :value="state.pin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入新的 6 位数字"
              type="password"
              @input="state.pin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>

          <label class="note-lock-manage-modal__field">
            <span>再次确认新的全局 PIN</span>
            <input
              data-testid="note-lock-manage-confirm-pin"
              :value="state.confirmPin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请再次输入新的 6 位数字"
              type="password"
              @input="state.confirmPin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>

          <IonButton
            data-testid="note-lock-manage-submit-pin"
            :disabled="!canSubmitPin"
            @click="handleChangePin"
          >
            {{ state.isSubmitting ? '处理中...' : '确认修改全局 PIN' }}
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

  &::part(content) {
    max-width: 480px;
    margin: auto;
  }
}

.note-lock-manage-modal__sheet {
  padding: 20px 20px 24px;
  background: linear-gradient(180deg, rgba(244, 248, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
  color: #122033;
}

.note-lock-manage-modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;

  h2 {
    margin: 6px 0 8px;
    font-size: 24px;
    line-height: 1.2;
  }

  p {
    margin: 0;
    color: #5b6b7d;
    line-height: 1.5;
  }
}

.note-lock-manage-modal__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #4b6b96;
}

.note-lock-manage-modal__close {
  border: 0;
  background: transparent;
  color: #6b7a8b;
  font-size: 14px;
}

.note-lock-manage-modal__body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.note-lock-manage-modal__summary {
  display: grid;
  gap: 8px;
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(232, 238, 246, 0.72);
  color: #314255;
  font-size: 14px;
}

.note-lock-manage-modal__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-radius: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #d5deea;

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
  color: #223447;
}

.note-lock-manage-modal__toggle-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: #607184;
}

.note-lock-manage-modal__actions {
  display: grid;
  gap: 10px;
}

.note-lock-manage-modal__action {
  width: 100%;
  border: 1px solid #d5deea;
  border-radius: 14px;
  padding: 14px 16px;
  background: #fff;
  text-align: left;
  color: #223447;
  font-size: 15px;

  &:disabled {
    opacity: 0.6;
  }
}

.note-lock-manage-modal__action--danger {
  color: #b64242;
  border-color: rgba(182, 66, 66, 0.24);
  background: rgba(255, 244, 244, 0.92);
}

.note-lock-manage-modal__pin-form {
  display: grid;
  gap: 14px;
}

.note-lock-manage-modal__field {
  display: grid;
  gap: 8px;

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
    background: rgba(255, 255, 255, 0.9);
    font-size: 16px;
    color: #122033;
    outline: none;

    &:focus {
      border-color: #4f7fb7;
      box-shadow: 0 0 0 3px rgba(79, 127, 183, 0.15);
    }
  }
}

.note-lock-manage-modal__error {
  border-radius: 14px;
  padding: 12px 14px;
  background: #f6ece5;
  color: #92552f;
  text-align: left;
  font-size: 13px;
  line-height: 1.5;
}
</style>
