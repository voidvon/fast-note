<script setup lang="ts">
import type { NoteLockSetupResult } from '../model/use-note-lock'
import type { Note } from '@/shared/types'
import { computed, reactive, watch } from 'vue'
import { useDeviceType } from '@/shared/lib/device'
import { F7Button, F7List, F7ListInput, F7Modal } from '@/shared/ui/f7'
import { useNoteLock } from '../model/use-note-lock'

const props = withDefaults(defineProps<{
  defaultBiometricEnabled?: boolean
  deviceSupportsBiometric: boolean
  hasGlobalPin?: boolean
  isOpen: boolean
  noteId: string
  prepareForLock: () => Promise<void>
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
    await props.prepareForLock()

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
  catch (error) {
    form.errorMessage = error instanceof Error ? error.message : '保存备忘录失败，无法锁定'
  }
  finally {
    form.isSubmitting = false
  }
}
</script>

<template>
  <F7Modal
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
          <F7List strong inset class="note-lock-setup-modal__pin-list">
            <F7ListInput
              data-testid="note-lock-setup-pin"
              :value="form.pin"
              input-id="note-lock-setup-pin-input"
              inputmode="numeric"
              maxlength="6"
              outline
              placeholder="请输入 6 位数字"
              type="text"
              @input="form.pin = normalizePinValue(($event.target as HTMLInputElement).value)"
            />
          </F7List>
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
        <F7Button fill="clear" @click="dismiss">
          取消
        </F7Button>
        <F7Button
          data-testid="note-lock-setup-submit"
          :disabled="!canSubmit"
          @click="handleSubmit"
        >
          {{ form.isSubmitting ? '处理中...' : '确认' }}
        </F7Button>
      </div>
    </div>
  </F7Modal>
</template>

<style lang="scss">
.note-lock-setup-modal {
  --f7-sheet-height: auto;
  --f7-sheet-border-radius: 24px;
  --note-lock-setup-panel-bg: var(--c-blue-gray-900);
  --note-lock-setup-text: var(--c-text-primary);
  --note-lock-setup-muted: var(--c-text-secondary);
  --note-lock-setup-toggle-bg: var(--c-blue-gray-800);
  --note-lock-setup-toggle-text: var(--c-text-primary);
  --note-lock-setup-error-bg: color-mix(in srgb, var(--danger) 18%, var(--c-blue-gray-800));
  --note-lock-setup-error-text: var(--c-text-primary);

  > .sheet-modal-inner {
    width: min(460px, 100%);
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

.note-lock-setup-modal__pin-list {
  margin: 0;
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
