<script setup lang="ts">
import type { NoteLockSetupResult } from '@/hooks/useNoteLock'
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
  'confirm': [payload: NoteLockSetupResult & { note: Note }]
  'update:isOpen': [value: boolean]
}>()

const { isDesktop } = useDeviceType()
const noteLock = useNoteLock()

const form = reactive({
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

  form.pin = ''
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
      : await noteLock.setupGlobalPin(props.noteId, form.pin, form.pin, {
          biometricEnabled: form.biometricEnabled,
        })

    if (!result.ok || !result.note) {
      form.errorMessage = result.message || '设置锁失败，请重试'
      return
    }

    emit('confirm', result as NoteLockSetupResult & { note: Note })
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
          <h2>{{ hasGlobalPin ? '锁定这篇备忘录' : '设置全局 PIN' }}</h2>
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
            <input
              data-testid="note-lock-setup-pin"
              :value="form.pin"
              inputmode="numeric"
              maxlength="6"
              placeholder="请输入 6 位数字"
              type="text"
              @input="form.pin = normalizePinValue(($event.target as HTMLInputElement).value)"
            >
          </label>
        </template>

        <label class="note-lock-setup-modal__toggle" :class="{ 'is-disabled': !deviceSupportsBiometric }">
          <div>
            <div class="note-lock-setup-modal__toggle-title">
              生物识别快捷解锁
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
          {{ form.isSubmitting ? '处理中...' : '确认' }}
        </IonButton>
      </div>
    </div>
  </IonModal>
</template>

<style lang="scss">
.note-lock-setup-modal {
  --height: auto;
  --border-radius: 24px 24px 0 0;
  --note-lock-setup-panel-bg: var(--c-blue-gray-900);
  --note-lock-setup-text: var(--c-text-primary);
  --note-lock-setup-muted: var(--c-text-secondary);
  --note-lock-setup-input-bg: var(--c-blue-gray-950);
  --note-lock-setup-input-border: var(--c-border);
  --note-lock-setup-input-focus: var(--primary);
  --note-lock-setup-input-ring: color-mix(in srgb, var(--primary) 24%, transparent);
  --note-lock-setup-toggle-bg: var(--c-blue-gray-800);
  --note-lock-setup-toggle-text: var(--c-text-primary);
  --note-lock-setup-error-bg: color-mix(in srgb, var(--danger) 18%, var(--c-blue-gray-800));
  --note-lock-setup-error-text: var(--c-text-primary);

  &::part(content) {
    max-width: 460px;
    margin: auto;
  }
}

.note-lock-setup-modal__sheet {
  padding: 20px 20px 24px;
  background: var(--note-lock-setup-panel-bg);
  color: var(--note-lock-setup-text);
}

.note-lock-setup-modal__header {
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

.note-lock-setup-modal__close {
  border: 0;
  background: transparent;
  color: var(--note-lock-setup-muted);
  font-size: 14px;
}

.note-lock-setup-modal__body {
  display: grid;
  gap: 16px;
  margin-top: 20px;
}

.note-lock-setup-modal__field {
  input {
    width: 100%;
    border: 1px solid var(--note-lock-setup-input-border);
    border-radius: 14px;
    padding: 14px 16px;
    background: var(--note-lock-setup-input-bg);
    font-size: 16px;
    color: var(--note-lock-setup-text);
    outline: none;

    &::placeholder {
      color: var(--note-lock-setup-muted);
    }

    &:focus {
      border-color: var(--note-lock-setup-input-focus);
      box-shadow: 0 0 0 3px var(--note-lock-setup-input-ring);
    }
  }
}

.note-lock-setup-modal__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-radius: 16px;
  padding: 14px 16px;
  background: var(--note-lock-setup-toggle-bg);

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
  color: var(--note-lock-setup-toggle-text);
}

.note-lock-setup-modal__error {
  border-radius: 14px;
  padding: 12px 14px;
  background: var(--note-lock-setup-error-bg);
  color: var(--note-lock-setup-error-text);
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
