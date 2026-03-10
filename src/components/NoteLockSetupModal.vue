<script setup lang="ts">
import type { Note } from '@/types'
import { IonButton, IonModal } from '@ionic/vue'
import { computed, reactive, watch } from 'vue'
import { useDeviceType } from '@/hooks/useDeviceType'
import { useNoteLock } from '@/hooks/useNoteLock'

const props = withDefaults(defineProps<{
  defaultBiometricEnabled?: boolean
  deviceSupportsBiometric: boolean
  hasGlobalPin?: boolean
  isOpen: boolean
  noteId: string
}>(), {
  defaultBiometricEnabled: false,
  hasGlobalPin: false,
})

const emit = defineEmits<{
  'confirm': [note: Note]
  'update:isOpen': [value: boolean]
}>()

const { isDesktop } = useDeviceType()
const noteLock = useNoteLock()

const form = reactive({
  confirmPin: '',
  errorMessage: '',
  isSubmitting: false,
  pin: '',
  biometricEnabled: false,
})

const canSubmit = computed(() => {
  if (props.hasGlobalPin) {
    return !form.isSubmitting && !!props.noteId
  }

  return !form.isSubmitting
    && form.pin.length === 6
    && form.confirmPin.length === 6
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

  form.pin = ''
  form.confirmPin = ''
  form.errorMessage = ''
  form.isSubmitting = false
  form.biometricEnabled = props.deviceSupportsBiometric && props.defaultBiometricEnabled
}, { immediate: true })

function normalizePinValue(value: string) {
  return value.replace(/\D+/g, '').slice(0, 6)
}

function dismiss() {
  emit('update:isOpen', false)
}

async function handleSubmit() {
  if (!canSubmit.value) {
    return
  }

  form.isSubmitting = true
  form.errorMessage = ''

  try {
    const result = props.hasGlobalPin
      ? await noteLock.enableLockForNote(props.noteId, {
          biometricEnabled: form.biometricEnabled,
        })
      : await noteLock.setupGlobalPin(props.noteId, form.pin, form.confirmPin, {
          biometricEnabled: form.biometricEnabled,
        })

    if (!result.ok || !result.note) {
      form.errorMessage = result.message || '设置锁失败，请重试'
      return
    }

    emit('confirm', result.note)
    dismiss()
  }
  finally {
    form.isSubmitting = false
  }
}
</script>

<template>
  <IonModal
    :is-open="isOpen"
    :breakpoints="modalBreakpoints"
    :initial-breakpoint="modalInitialBreakpoint"
    class="note-lock-setup-modal"
    @did-dismiss="dismiss"
  >
    <div class="note-lock-setup-modal__sheet">
      <div class="note-lock-setup-modal__header">
        <div>
          <div class="note-lock-setup-modal__eyebrow">
            备忘录锁
          </div>
          <h2>{{ hasGlobalPin ? '锁定这篇备忘录' : '创建全局 PIN 并锁定' }}</h2>
          <p>PIN 适用于所有浏览器，生物识别仅作为当前设备的快捷解锁。</p>
        </div>
        <button
          type="button"
          class="note-lock-setup-modal__close"
          aria-label="关闭"
          @click="dismiss"
        >
          关闭
        </button>
      </div>

      <div class="note-lock-setup-modal__body">
        <template v-if="!hasGlobalPin">
          <label class="note-lock-setup-modal__field">
            <span>输入 6 位全局 PIN</span>
            <input
              data-testid="note-lock-setup-pin"
              :value="form.pin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入 6 位数字"
              type="password"
              @input="form.pin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>

          <label class="note-lock-setup-modal__field">
            <span>再次确认全局 PIN</span>
            <input
              data-testid="note-lock-setup-confirm-pin"
              :value="form.confirmPin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请再次输入 6 位数字"
              type="password"
              @input="form.confirmPin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>
        </template>

        <div v-else class="note-lock-setup-modal__summary">
          当前账号已创建全局 PIN。本次仅为这篇备忘录开启锁，解锁时仍使用同一个全局 PIN。
        </div>

        <label class="note-lock-setup-modal__toggle" :class="{ 'is-disabled': !deviceSupportsBiometric }">
          <div>
            <div class="note-lock-setup-modal__toggle-title">
              当前设备启用生物识别快捷解锁
            </div>
            <div class="note-lock-setup-modal__toggle-desc">
              {{ deviceSupportsBiometric ? '解锁时可优先尝试生物识别，失败后仍可回退 PIN。' : '当前设备不支持生物识别，仍可正常使用 PIN 解锁。' }}
            </div>
          </div>
          <input
            data-testid="note-lock-setup-biometric"
            :checked="form.biometricEnabled"
            :disabled="!deviceSupportsBiometric"
            type="checkbox"
            @change="form.biometricEnabled = !!($event.target as HTMLInputElement).checked"
          >
        </label>

        <div v-if="form.errorMessage" data-testid="note-lock-setup-error" class="note-lock-setup-modal__error">
          {{ form.errorMessage }}
        </div>
      </div>

      <div class="note-lock-setup-modal__footer">
        <IonButton fill="clear" @click="dismiss">
          取消
        </IonButton>
        <IonButton
          data-testid="note-lock-setup-submit"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ form.isSubmitting ? '处理中...' : (hasGlobalPin ? '确认锁定' : '创建并锁定') }}
        </IonButton>
      </div>
    </div>
  </IonModal>
</template>

<style lang="scss">
.note-lock-setup-modal {
  --height: auto;
  --border-radius: 24px 24px 0 0;

  &::part(content) {
    max-width: 460px;
    margin: auto;
  }
}

.note-lock-setup-modal__sheet {
  padding: 20px 20px 24px;
  background: linear-gradient(180deg, rgba(244, 248, 252, 0.96) 0%, rgba(255, 255, 255, 0.98) 100%);
  color: #122033;
}

.note-lock-setup-modal__header {
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

.note-lock-setup-modal__eyebrow {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #4b6b96;
}

.note-lock-setup-modal__close {
  border: 0;
  background: transparent;
  color: #6b7a8b;
  font-size: 14px;
}

.note-lock-setup-modal__body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.note-lock-setup-modal__field {
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

.note-lock-setup-modal__toggle {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  border-radius: 16px;
  padding: 14px 16px;
  background: rgba(224, 233, 243, 0.55);

  input {
    width: 18px;
    height: 18px;
    margin-top: 2px;
  }

  &.is-disabled {
    opacity: 0.75;
  }
}

.note-lock-setup-modal__toggle-title {
  font-size: 14px;
  font-weight: 600;
  color: #223145;
}

.note-lock-setup-modal__toggle-desc {
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.5;
  color: #607184;
}

.note-lock-setup-modal__error {
  border-radius: 14px;
  padding: 12px 14px;
  background: #fdeaea;
  color: #a74141;
  font-size: 13px;
  line-height: 1.5;
}

.note-lock-setup-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 22px;
}
</style>
