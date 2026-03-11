import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { onNoteLockSessionChanged, useNoteLock, validatePinSetup } from '@/hooks/useNoteLock'
import { logger } from '@/utils/logger'
import { makeNote } from '../../factories/note.factory'

function createMockTable<T extends Record<string, any>>(key: keyof T) {
  const store = new Map<string, T>()

  return {
    async delete(id: string) {
      store.delete(id)
    },
    async get(id: string) {
      return store.get(id) ?? null
    },
    async put(value: T) {
      store.set(String(value[key]), value)
      return value
    },
  }
}

function createMockDb() {
  return {
    security_settings: createMockTable<any>('scope_key'),
    device_security_state: createMockTable<any>('scope_key'),
    note_unlock_sessions: createMockTable<any>('note_id'),
  }
}

describe('useNoteLock setup flow (t-fn-037)', () => {
  it('validates 6-digit pin and matching confirmation', () => {
    expect(validatePinSetup('12345', '12345')).toMatchObject({
      ok: false,
      code: 'pin_format_invalid',
    })
    expect(validatePinSetup('123456', '654321')).toMatchObject({
      ok: false,
      code: 'pin_mismatch',
    })
    expect(validatePinSetup('123456', '123456')).toMatchObject({
      ok: true,
      code: 'ok',
    })
  })

  it('creates a global pin, persists it locally, and locks the note', async () => {
    const note = makeNote({
      id: 'note-1',
      is_locked: 0,
    })
    const dbTables = createMockDb()
    const updateNoteMock = vi.fn(async (_id: string, updates: Partial<typeof note>) => {
      Object.assign(note, updates)
    })
    const noteLock = useNoteLock({
      createSalt: () => 'salt',
      db: ref(dbTables as any),
      getNote: async () => note,
      hashPin: async (pin, salt) => `${salt}:${pin}:hash`,
      isBiometricSupported: () => false,
      updateNote: updateNoteMock,
    })

    const result = await noteLock.setupGlobalPin('note-1', '123456', '123456', {
      biometricEnabled: true,
    })

    expect(result).toMatchObject({
      ok: true,
      biometricEnabled: false,
      hasGlobalPin: true,
    })
    expect(updateNoteMock).toHaveBeenCalledWith('note-1', expect.objectContaining({
      is_locked: 1,
      lock_type: null,
      lock_secret_hash: null,
      lock_secret_salt: null,
      lock_version: null,
    }))

    const securitySettings = await dbTables.security_settings.get('note:guest')
    expect(securitySettings).toMatchObject({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'salt:123456:hash',
      pin_version: 1,
    })

    const deviceState = await dbTables.device_security_state.get('note:guest')
    expect(deviceState).toMatchObject({
      scope_key: 'note:guest',
      biometric_enabled: 0,
    })
  })

  it('locks another note with the existing global pin and registers biometric quick unlock', async () => {
    const note = makeNote({
      id: 'note-biometric',
      is_locked: 0,
    })
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'salt:123456:hash',
      pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })
    const registerMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      credentialId: 'credential-1',
    }))
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getNote: async () => note,
      isBiometricSupported: () => true,
      updateNote: vi.fn(async (_id: string, updates: Partial<typeof note>) => {
        Object.assign(note, updates)
      }),
      webAuthn: {
        state: {} as any,
        checkSupport: () => true,
        checkRegistrationStatus: credentialId => !!credentialId,
        clearLegacyCredential: vi.fn(),
        getLegacyCredential: () => null,
        register: registerMock,
        verify: vi.fn(),
      },
    })

    const result = await noteLock.enableLockForNote('note-biometric', {
      biometricEnabled: true,
    })

    expect(result).toMatchObject({
      ok: true,
      biometricEnabled: true,
      hasGlobalPin: true,
    })
    expect(registerMock).toHaveBeenCalledTimes(1)

    const deviceState = await dbTables.device_security_state.get('note:guest')
    expect(deviceState).toMatchObject({
      scope_key: 'note:guest',
      biometric_enabled: 1,
      webauthn_credential_id: 'credential-1',
    })
  })

  it('uses cloud pin settings as the source of truth when syncing security settings', async () => {
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'local-salt',
      pin_secret_hash: 'local-hash',
      pin_version: 1,
      updated: '2026-03-10 09:00:00',
    })
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getCloudPinSettings: async () => ({
        note_lock_pin_salt: 'cloud-salt',
        note_lock_pin_hash: 'cloud-hash',
        note_lock_pin_version: 3,
        updated: '2026-03-10 10:00:00',
      }),
      getNote: async () => null,
      isAuthenticated: () => true,
      updateNote: vi.fn(async () => undefined),
    })

    const settings = await noteLock.syncSecuritySettingsFromCloud(true)

    expect(settings).toMatchObject({
      scope_key: 'note:guest',
      pin_secret_salt: 'cloud-salt',
      pin_secret_hash: 'cloud-hash',
      pin_version: 3,
    })
    expect(await dbTables.security_settings.get('note:guest')).toMatchObject({
      pin_secret_salt: 'cloud-salt',
      pin_secret_hash: 'cloud-hash',
      pin_version: 3,
    })
  })

  it('logs when cloud pin settings override a different local pin', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'local-salt',
      pin_secret_hash: 'local-hash',
      pin_version: 1,
      updated: '2026-03-10 09:00:00',
    })
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getCloudPinSettings: async () => ({
        note_lock_pin_salt: 'cloud-salt',
        note_lock_pin_hash: 'cloud-hash',
        note_lock_pin_version: 3,
        updated: '2026-03-10 10:00:00',
      }),
      getNote: async () => null,
      isAuthenticated: () => true,
      updateNote: vi.fn(async () => undefined),
    })

    await noteLock.syncSecuritySettingsFromCloud(true)

    expect(warnSpy).toHaveBeenCalledWith('note-lock cloud pin overrides local settings', expect.objectContaining({
      scopeKey: 'note:guest',
      local: expect.objectContaining({
        hasPin: true,
        pinVersion: 1,
      }),
      cloud: expect.objectContaining({
        hasPin: true,
        pinVersion: 3,
      }),
    }))
    warnSpy.mockRestore()
  })

  it('persists global pin changes to cloud when authenticated', async () => {
    const note = makeNote({
      id: 'note-cloud',
      is_locked: 0,
    })
    const dbTables = createMockDb()
    const saveCloudPinSettingsMock = vi.fn(async () => undefined)
    let latestCloudSettings: any = null
    const noteLock = useNoteLock({
      createSalt: () => 'cloud-salt',
      db: ref(dbTables as any),
      getCloudPinSettings: async () => latestCloudSettings,
      getNote: async () => note,
      hashPin: async (pin, salt) => `${salt}:${pin}:hash`,
      isAuthenticated: () => true,
      isBiometricSupported: () => false,
      saveCloudPinSettings: async (settings) => {
        latestCloudSettings = {
          note_lock_pin_salt: settings.pin_secret_salt,
          note_lock_pin_hash: settings.pin_secret_hash,
          note_lock_pin_version: settings.pin_version,
          updated: settings.updated,
        }
        await saveCloudPinSettingsMock(settings)
      },
      updateNote: vi.fn(async (_id: string, updates: Partial<typeof note>) => {
        Object.assign(note, updates)
      }),
    })

    const setupResult = await noteLock.setupGlobalPin('note-cloud', '123456', '123456')
    const changeResult = await noteLock.changeGlobalPin('654321', '654321')

    expect(setupResult).toMatchObject({
      ok: true,
      hasGlobalPin: true,
    })
    expect(changeResult).toMatchObject({
      ok: true,
      code: 'ok',
    })
    expect(saveCloudPinSettingsMock).toHaveBeenCalledTimes(2)
    expect(saveCloudPinSettingsMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      pin_secret_salt: 'cloud-salt',
      pin_secret_hash: 'cloud-salt:123456:hash',
      pin_version: 1,
    }))
    expect(saveCloudPinSettingsMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      pin_secret_salt: 'cloud-salt',
      pin_secret_hash: 'cloud-salt:654321:hash',
      pin_version: 2,
    }))
  })

  it('returns cloud_sync_failed and logs when saving global pin to cloud fails', async () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
    const note = makeNote({
      id: 'note-cloud-fail',
      is_locked: 0,
    })
    const dbTables = createMockDb()
    const noteLock = useNoteLock({
      createSalt: () => 'cloud-salt',
      db: ref(dbTables as any),
      getNote: async () => note,
      hashPin: async (pin, salt) => `${salt}:${pin}:hash`,
      isAuthenticated: () => true,
      saveCloudPinSettings: async () => {
        throw new Error('users update failed')
      },
      updateNote: vi.fn(async (_id: string, updates: Partial<typeof note>) => {
        Object.assign(note, updates)
      }),
    })

    const result = await noteLock.setupGlobalPin('note-cloud-fail', '123456', '123456')

    expect(result).toMatchObject({
      ok: true,
      code: 'cloud_sync_failed',
      hasGlobalPin: true,
      message: '已在当前设备创建 PIN，但云端同步失败，请稍后重试',
    })
    expect(errorSpy).toHaveBeenCalledWith('同步全局 PIN 到云端失败:', expect.objectContaining({
      scopeKey: 'note:guest',
      pinVersion: 1,
    }))
    errorSpy.mockRestore()
  })

  it('creates cooldown after three invalid global pin attempts', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const note = makeNote({
      id: 'note-2',
      is_locked: 1,
    })
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'expected',
      pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })
    const noteLock = useNoteLock({
      cooldownMs: 30000,
      db: ref(dbTables as any),
      getNote: async () => note,
      hashPin: async () => 'wrong',
      maxFailedAttempts: 3,
      now: () => 1000,
      updateNote: vi.fn(async () => undefined),
    })

    await noteLock.verifyPin('note-2', '111111')
    await noteLock.verifyPin('note-2', '111111')
    const result = await noteLock.verifyPin('note-2', '111111')

    expect(result).toMatchObject({
      ok: false,
      code: 'cooldown',
      failedAttempts: 3,
      cooldownUntil: 31000,
    })

    const session = await dbTables.note_unlock_sessions.get('note-2')
    expect(session).toMatchObject({
      note_id: 'note-2',
      failed_attempts: 3,
      cooldown_until: 31000,
    })
    expect(warnSpy).toHaveBeenCalledWith('note-lock pin cooldown triggered', expect.objectContaining({
      noteId: 'note-2',
      failedAttempts: 3,
      cooldownUntil: 31000,
    }))
    warnSpy.mockRestore()
  })

  it('emits session change events after verify success and relock', async () => {
    const note = makeNote({
      id: 'note-session-events',
      is_locked: 1,
    })
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'expected',
      pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getNote: async () => note,
      hashPin: async () => 'expected',
      now: () => 1000,
      updateNote: vi.fn(async () => undefined),
    })
    const events: Array<{ noteId: string, reason: string }> = []
    const unsubscribe = onNoteLockSessionChanged((event) => {
      events.push(event)
    })

    await noteLock.verifyPin('note-session-events', '123456')
    await noteLock.relock('note-session-events')
    unsubscribe()

    expect(events).toEqual([
      {
        noteId: 'note-session-events',
        reason: 'verified',
      },
      {
        noteId: 'note-session-events',
        reason: 'relock',
      },
    ])
  })

  it('migrates legacy credential into device state and unlocks via biometric', async () => {
    const note = makeNote({
      id: 'note-legacy',
      is_locked: 1,
    })
    const dbTables = createMockDb()
    await dbTables.device_security_state.put({
      scope_key: 'note:guest',
      webauthn_credential_id: null,
      biometric_enabled: 1,
      updated: '2026-03-10 10:00:00',
    })
    const verifyMock = vi.fn(async () => ({
      ok: true,
      code: 'ok',
      message: null,
      credentialId: 'legacy-credential',
    }))
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getNote: async () => note,
      isBiometricSupported: () => true,
      now: () => 1000,
      updateNote: vi.fn(async () => undefined),
      webAuthn: {
        state: {} as any,
        checkSupport: () => true,
        checkRegistrationStatus: credentialId => !!credentialId,
        clearLegacyCredential: vi.fn(),
        getLegacyCredential: () => 'legacy-credential',
        register: vi.fn(),
        verify: verifyMock,
      },
    })

    const result = await noteLock.tryBiometricUnlock('note-legacy')

    expect(result).toMatchObject({
      ok: true,
      code: 'ok',
    })
    expect(verifyMock).toHaveBeenCalledWith({
      credentialId: 'legacy-credential',
      force: true,
    })
    expect(await dbTables.device_security_state.get('note:guest')).toMatchObject({
      biometric_enabled: 1,
      webauthn_credential_id: 'legacy-credential',
    })
    expect(await dbTables.note_unlock_sessions.get('note-legacy')).toMatchObject({
      note_id: 'note-legacy',
      verified_at: 1000,
    })
  })

  it('changes the global pin version and can disable note lock independently', async () => {
    const note = makeNote({
      id: 'note-disable-lock',
      is_locked: 1,
    })
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'old-hash',
      pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })
    const updateNoteMock = vi.fn(async (_id: string, updates: Partial<typeof note>) => {
      Object.assign(note, updates)
    })
    const noteLock = useNoteLock({
      createSalt: () => 'next-salt',
      db: ref(dbTables as any),
      getNote: async () => note,
      hashPin: async (pin, salt) => `${salt}:${pin}:hash`,
      updateNote: updateNoteMock,
    })

    const changeResult = await noteLock.changeGlobalPin('123456', '123456')
    const disableResult = await noteLock.disableLockForNote('note-disable-lock')

    expect(changeResult).toMatchObject({
      ok: true,
      code: 'ok',
    })
    expect(await dbTables.security_settings.get('note:guest')).toMatchObject({
      pin_secret_salt: 'next-salt',
      pin_secret_hash: 'next-salt:123456:hash',
      pin_version: 2,
    })

    expect(disableResult).toMatchObject({
      ok: true,
      note: expect.objectContaining({
        is_locked: 0,
        lock_type: null,
        lock_secret_hash: null,
        lock_secret_salt: null,
        lock_version: null,
      }),
    })
    expect(updateNoteMock).toHaveBeenCalledWith('note-disable-lock', expect.objectContaining({
      is_locked: 0,
    }))
  })

  it('logs biometric downgrade when registration fails and falls back to pin', async () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
    const note = makeNote({
      id: 'note-biometric-downgrade',
      is_locked: 0,
    })
    const dbTables = createMockDb()
    await dbTables.security_settings.put({
      scope_key: 'note:guest',
      pin_secret_salt: 'salt',
      pin_secret_hash: 'salt:123456:hash',
      pin_version: 1,
      updated: '2026-03-10 10:00:00',
    })
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getNote: async () => note,
      isBiometricSupported: () => true,
      updateNote: vi.fn(async (_id: string, updates: Partial<typeof note>) => {
        Object.assign(note, updates)
      }),
      webAuthn: {
        state: {} as any,
        checkSupport: () => true,
        checkRegistrationStatus: () => false,
        clearLegacyCredential: vi.fn(),
        getLegacyCredential: () => null,
        register: vi.fn(async () => ({
          ok: false,
          code: 'cancelled',
          message: '已取消生物识别验证，请使用 PIN',
        })),
        verify: vi.fn(),
      },
    })

    const result = await noteLock.enableLockForNote('note-biometric-downgrade', {
      biometricEnabled: true,
    })

    expect(result).toMatchObject({
      ok: true,
      code: 'pin_only',
      biometricEnabled: false,
    })
    expect(warnSpy).toHaveBeenCalledWith('note-lock biometric degraded to pin', expect.objectContaining({
      scopeKey: 'note:guest',
      reasonCode: 'cancelled',
    }))
    warnSpy.mockRestore()
  })

  it('toggles biometric quick unlock in device state', async () => {
    const dbTables = createMockDb()
    const noteLock = useNoteLock({
      db: ref(dbTables as any),
      getNote: async () => null,
      isBiometricSupported: () => true,
      updateNote: vi.fn(async () => undefined),
      webAuthn: {
        state: {} as any,
        checkSupport: () => true,
        checkRegistrationStatus: credentialId => !!credentialId,
        clearLegacyCredential: vi.fn(),
        getLegacyCredential: () => null,
        register: vi.fn(async () => ({
          ok: true,
          code: 'ok',
          message: null,
          credentialId: 'credential-2',
        })),
        verify: vi.fn(),
      },
    })

    const enableResult = await noteLock.setBiometricEnabled(true)
    const disableResult = await noteLock.setBiometricEnabled(false)

    expect(enableResult).toMatchObject({
      ok: true,
      biometricEnabled: true,
    })
    expect(disableResult).toMatchObject({
      ok: true,
      biometricEnabled: false,
    })
    expect(await dbTables.device_security_state.get('note:guest')).toMatchObject({
      biometric_enabled: 0,
      webauthn_credential_id: 'credential-2',
    })
  })
})
