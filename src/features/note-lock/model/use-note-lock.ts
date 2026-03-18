import type { Ref } from 'vue'
import type { UseWebAuthnCapability } from '@/shared/lib/security'
import type { NoteDatabase } from '@/shared/lib/storage'
import type { DeviceSecurityState, Note, NoteUnlockSession, SecuritySettings } from '@/types'
import { authService, usersService } from '@/entities/auth'
import { useNoteRepository } from '@/entities/note'
import { useWebAuthn } from '@/shared/lib/security'
import { getCurrentDatabaseName, useDexie } from '@/shared/lib/storage'
import {
  getDefaultNoteLockFields,
  normalizeNoteLockFields,
} from '@/types'
import { getTime } from '@/shared/lib/date'
import { logger } from '@/shared/lib/logger'

type MaybePromise<T> = T | Promise<T>

interface CloudPinSettings {
  note_lock_pin_hash: string | null
  note_lock_pin_salt: string | null
  note_lock_pin_version: number | null
  updated?: string | null
}

export type NoteLockViewState = 'unlocked' | 'locked' | 'unlocking' | 'cooldown'
export type NoteLockSessionChangeReason = 'verified' | 'biometric' | 'relock' | 'session_cleared'

export interface NoteLockSessionChangeEvent {
  noteId: string
  reason: NoteLockSessionChangeReason
}

export interface NoteLockSetupResult {
  ok: boolean
  code: string
  message: string | null
  note?: Note
  biometricEnabled?: boolean
  hasGlobalPin?: boolean
}

export interface NoteLockManageResult {
  ok: boolean
  code: string
  message: string | null
  note?: Note
  biometricEnabled?: boolean
}

export interface NoteLockVerifyResult {
  ok: boolean
  code: string
  message: string | null
  note?: Note
  failedAttempts: number
  cooldownUntil: number | null
  session?: NoteUnlockSession | null
}

export interface NoteLockBiometricResult {
  ok: boolean
  code: string
  message: string | null
  note?: Note
  failedAttempts: number
  cooldownUntil: number | null
  session?: NoteUnlockSession | null
}

export interface NoteLockViewSnapshot {
  viewState: NoteLockViewState
  failedAttempts: number
  cooldownUntil: number | null
  biometricEnabled: boolean
  deviceSupportsBiometric: boolean
  session: NoteUnlockSession | null
}

export interface UseNoteLockOptions {
  cooldownMs?: number
  db?: Ref<Pick<NoteDatabase, 'security_settings' | 'device_security_state' | 'note_unlock_sessions'> | undefined>
  getCloudPinSettings?: (force?: boolean) => MaybePromise<CloudPinSettings | null>
  getNote?: (id: string) => MaybePromise<Note | null | undefined>
  hashPin?: (pin: string, salt: string) => Promise<string>
  isAuthenticated?: () => boolean
  isBiometricSupported?: () => boolean
  maxFailedAttempts?: number
  now?: () => number
  saveCloudPinSettings?: (settings: SecuritySettings) => MaybePromise<void>
  sessionTtl?: number
  updateNote?: (id: string, updates: Partial<Note>) => MaybePromise<void>
  createSalt?: () => string
  webAuthn?: UseWebAuthnCapability
}

const PIN_REGEX = /^\d{6}$/
const DEFAULT_SCOPE_KEY = 'note:guest'
const CLOUD_SYNC_CACHE_TTL = 10 * 1000
export const DEFAULT_NOTE_UNLOCK_SESSION_TTL = 5 * 60 * 1000
export const DEFAULT_NOTE_UNLOCK_COOLDOWN_MS = 30 * 1000
export const DEFAULT_NOTE_UNLOCK_MAX_FAILED_ATTEMPTS = 3
const noteLockSessionChangeListeners = new Set<(event: NoteLockSessionChangeEvent) => void>()

export function onNoteLockSessionChanged(listener: (event: NoteLockSessionChangeEvent) => void) {
  noteLockSessionChangeListeners.add(listener)

  return () => {
    noteLockSessionChangeListeners.delete(listener)
  }
}

function emitNoteLockSessionChanged(event: NoteLockSessionChangeEvent) {
  noteLockSessionChangeListeners.forEach((listener) => {
    try {
      listener(event)
    }
    catch (error) {
      logger.error('note-lock session change listener failed', {
        event,
        error,
      })
    }
  })
}

function sanitizePinSyncState(settings?: Partial<SecuritySettings> | null) {
  return {
    hasPin: hasConfiguredPin(settings),
    pinVersion: settings?.pin_version ?? null,
    updated: settings?.updated ?? null,
  }
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function isWebAuthnAvailable() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

export function createPinSalt() {
  const salt = new Uint8Array(16)
  globalThis.crypto.getRandomValues(salt)
  return toHex(salt.buffer)
}

export async function hashPinSecret(pin: string, salt: string) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('当前环境不支持安全摘要计算')
  }

  const source = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', source)
  return toHex(digest)
}

export function validatePinSetup(pin: string, confirmPin: string): NoteLockSetupResult {
  if (!PIN_REGEX.test(pin)) {
    return {
      ok: false,
      code: 'pin_format_invalid',
      message: '请输入 6 位数字 PIN',
    }
  }

  if (pin !== confirmPin) {
    return {
      ok: false,
      code: 'pin_mismatch',
      message: '两次输入的 PIN 不一致',
    }
  }

  return {
    ok: true,
    code: 'ok',
    message: null,
  }
}

export function createNoteUnlockSession(
  noteId: string,
  options: {
    now?: number
    sessionTtl?: number
    failedAttempts?: number
    cooldownUntil?: number | null
  } = {},
): NoteUnlockSession {
  const now = options.now ?? Date.now()
  const sessionTtl = options.sessionTtl ?? DEFAULT_NOTE_UNLOCK_SESSION_TTL

  return {
    note_id: noteId,
    verified_at: now,
    expires_at: now + sessionTtl,
    failed_attempts: options.failedAttempts ?? 0,
    cooldown_until: options.cooldownUntil ?? null,
    updated: getTime(),
  }
}

export function isNoteUnlockSessionValid(session?: NoteUnlockSession | null, now = Date.now()) {
  if (!session || session.verified_at == null || session.expires_at == null) {
    return false
  }

  if (session.cooldown_until && session.cooldown_until > now) {
    return false
  }

  return session.expires_at > now
}

function createDefaultDeviceSecurityState(scopeKey: string): DeviceSecurityState {
  return {
    scope_key: scopeKey,
    webauthn_credential_id: null,
    biometric_enabled: 0,
    updated: getTime(),
  }
}

function createDefaultSecuritySettings(scopeKey: string): SecuritySettings {
  return {
    scope_key: scopeKey,
    pin_secret_salt: null,
    pin_secret_hash: null,
    pin_version: null,
    updated: getTime(),
  }
}

function hasConfiguredPin(settings?: Partial<SecuritySettings> | null) {
  return !!settings?.pin_secret_hash && !!settings?.pin_secret_salt
}

function mapCloudPinSettingsToLocal(scopeKey: string, cloudSettings: CloudPinSettings | null): SecuritySettings | null {
  if (!cloudSettings) {
    return null
  }

  return {
    scope_key: scopeKey,
    pin_secret_salt: cloudSettings.note_lock_pin_salt ?? null,
    pin_secret_hash: cloudSettings.note_lock_pin_hash ?? null,
    pin_version: cloudSettings.note_lock_pin_version ?? null,
    updated: cloudSettings.updated || getTime(),
  }
}

function stripLegacyLockFields(note: Note, locked: 0 | 1) {
  return normalizeNoteLockFields({
    ...note,
    is_locked: locked,
    lock_type: null,
    lock_secret_salt: null,
    lock_secret_hash: null,
    lock_version: null,
    updated: getTime(),
  })
}

export function useNoteLock(options: UseNoteLockOptions = {}) {
  const noteStore = options.getNote || options.updateNote ? null : useNoteRepository()
  const dexieApi = options.db ? null : useDexie()
  const webAuthn = options.webAuthn ?? useWebAuthn()
  const now = options.now ?? (() => Date.now())
  const createSalt = options.createSalt ?? createPinSalt
  const hashPin = options.hashPin ?? hashPinSecret
  const sessionTtl = options.sessionTtl ?? DEFAULT_NOTE_UNLOCK_SESSION_TTL
  const cooldownMs = options.cooldownMs ?? DEFAULT_NOTE_UNLOCK_COOLDOWN_MS
  const maxFailedAttempts = options.maxFailedAttempts ?? DEFAULT_NOTE_UNLOCK_MAX_FAILED_ATTEMPTS
  const isBiometricSupported = options.isBiometricSupported ?? (() => webAuthn.checkSupport())
  const isAuthenticated = options.isAuthenticated ?? (() => authService.isAuthenticated())
  const db = options.db ?? dexieApi?.db
  let lastCloudSyncAt = 0

  async function resolveNote(noteId: string) {
    const note = options.getNote
      ? await Promise.resolve(options.getNote(noteId))
      : await Promise.resolve(noteStore?.getNote(noteId))

    if (!note) {
      return null
    }

    return normalizeNoteLockFields(note)
  }

  async function persistNote(noteId: string, note: Note) {
    if (options.updateNote) {
      await Promise.resolve(options.updateNote(noteId, note))
      return
    }

    await Promise.resolve(noteStore?.updateNote(noteId, note))
  }

  function getScopeKey() {
    return getCurrentDatabaseName() || DEFAULT_SCOPE_KEY
  }

  async function getDeviceSecurityState() {
    const scopeKey = getScopeKey()
    const existing = await db?.value?.device_security_state?.get(scopeKey)
    if (!existing) {
      const defaultState = createDefaultDeviceSecurityState(scopeKey)
      const legacyCredential = webAuthn.getLegacyCredential()
      if (!legacyCredential) {
        return defaultState
      }

      const migratedState: DeviceSecurityState = {
        ...defaultState,
        webauthn_credential_id: legacyCredential,
      }
      await db?.value?.device_security_state?.put(migratedState)
      return migratedState
    }

    if (!existing.webauthn_credential_id) {
      const legacyCredential = webAuthn.getLegacyCredential()
      if (legacyCredential) {
        const migratedState: DeviceSecurityState = {
          ...existing,
          webauthn_credential_id: legacyCredential,
          updated: getTime(),
        }
        await db?.value?.device_security_state?.put(migratedState)
        return migratedState
      }
    }

    return existing
  }

  async function setDeviceSecurityState(patch: Partial<DeviceSecurityState>) {
    const current = await getDeviceSecurityState()
    const nextState: DeviceSecurityState = {
      ...current,
      ...patch,
      scope_key: current.scope_key,
      updated: getTime(),
    }

    await db?.value?.device_security_state?.put(nextState)
    return nextState
  }

  async function getLocalSecuritySettings() {
    const scopeKey = getScopeKey()
    const existing = await db?.value?.security_settings?.get(scopeKey)
    return existing ?? createDefaultSecuritySettings(scopeKey)
  }

  async function putLocalSecuritySettings(settings: SecuritySettings) {
    await db?.value?.security_settings?.put(settings)
    return settings
  }

  async function persistCloudPinSettings(settings: SecuritySettings) {
    if (!isAuthenticated()) {
      return
    }

    if (options.saveCloudPinSettings) {
      await Promise.resolve(options.saveCloudPinSettings(settings))
      lastCloudSyncAt = now()
      return
    }

    await usersService.updateCurrentUserPinSettings({
      note_lock_pin_salt: settings.pin_secret_salt,
      note_lock_pin_hash: settings.pin_secret_hash,
      note_lock_pin_version: settings.pin_version,
    })
    lastCloudSyncAt = now()
  }

  async function readCloudPinSettings(force = false) {
    if (!isAuthenticated()) {
      return null
    }

    const shouldForce = force || (now() - lastCloudSyncAt) > CLOUD_SYNC_CACHE_TTL

    if (options.getCloudPinSettings) {
      const cloudSettings = await Promise.resolve(options.getCloudPinSettings(shouldForce))
      if (shouldForce) {
        lastCloudSyncAt = now()
      }
      return cloudSettings
    }

    const cloudSettings = await usersService.getCurrentUserPinSettings({ force: shouldForce })
    if (shouldForce) {
      lastCloudSyncAt = now()
    }
    return cloudSettings
  }

  async function syncSecuritySettingsFromCloud(force = false) {
    const localSettings = await getLocalSecuritySettings()

    if (!isAuthenticated()) {
      return localSettings
    }

    try {
      const cloudSettings = await readCloudPinSettings(force)
      const mappedCloudSettings = mapCloudPinSettingsToLocal(getScopeKey(), cloudSettings)
      if (!mappedCloudSettings || !hasConfiguredPin(mappedCloudSettings)) {
        return localSettings
      }

      const willOverrideLocal = hasConfiguredPin(localSettings)
        && (
          localSettings.pin_secret_hash !== mappedCloudSettings.pin_secret_hash
          || localSettings.pin_secret_salt !== mappedCloudSettings.pin_secret_salt
          || localSettings.pin_version !== mappedCloudSettings.pin_version
        )

      await putLocalSecuritySettings(mappedCloudSettings)
      if (willOverrideLocal) {
        logger.warn('note-lock cloud pin overrides local settings', {
          scopeKey: getScopeKey(),
          local: sanitizePinSyncState(localSettings),
          cloud: sanitizePinSyncState(mappedCloudSettings),
        })
      }
      else {
        logger.info('note-lock cloud pin synced', {
          scopeKey: getScopeKey(),
          cloud: sanitizePinSyncState(mappedCloudSettings),
        })
      }
      return mappedCloudSettings
    }
    catch (error) {
      logger.error('同步全局 PIN 到本地失败，回退本地配置:', {
        scopeKey: getScopeKey(),
        error,
      })
      return localSettings
    }
  }

  async function getGlobalSecuritySettings(forceSync = false) {
    return await syncSecuritySettingsFromCloud(forceSync)
  }

  async function hasGlobalPin(forceSync = false) {
    const settings = await getGlobalSecuritySettings(forceSync)
    return hasConfiguredPin(settings)
  }

  async function getSession(noteId: string) {
    return await db?.value?.note_unlock_sessions?.get(noteId) ?? null
  }

  async function putSession(session: NoteUnlockSession) {
    await db?.value?.note_unlock_sessions?.put(session)
    return session
  }

  async function clearSession(noteId: string, reason: NoteLockSessionChangeReason = 'session_cleared') {
    await db?.value?.note_unlock_sessions?.delete(noteId)
    emitNoteLockSessionChanged({
      noteId,
      reason,
    })
  }

  function isPinLockNote(note?: Partial<Note> | null) {
    if (!note) {
      return false
    }

    return getDefaultNoteLockFields(note).is_locked === 1
  }

  async function applyBiometricPreference(enabled: boolean) {
    const requestedBiometric = Boolean(enabled && isBiometricSupported())
    const deviceState = await getDeviceSecurityState()
    let biometricEnabled = false
    let webauthnCredentialId = deviceState.webauthn_credential_id
    let resultCode = 'ok'
    let resultMessage: string | null = null

    if (requestedBiometric) {
      if (webAuthn.checkRegistrationStatus(webauthnCredentialId)) {
        biometricEnabled = true
      }
      else {
        const registerResult = await webAuthn.register()
        if (registerResult.ok && registerResult.credentialId) {
          biometricEnabled = true
          webauthnCredentialId = registerResult.credentialId
        }
        else {
          resultCode = 'pin_only'
          resultMessage = registerResult.message
          logger.warn('note-lock biometric degraded to pin', {
            scopeKey: deviceState.scope_key,
            reasonCode: registerResult.code,
            message: registerResult.message ?? null,
          })
        }
      }
    }

    await setDeviceSecurityState({
      biometric_enabled: biometricEnabled ? 1 : 0,
      webauthn_credential_id: webauthnCredentialId ?? null,
    })

    return {
      biometricEnabled,
      code: resultCode,
      message: resultMessage,
    }
  }

  async function enableLockForNote(
    noteId: string,
    options: {
      biometricEnabled?: boolean
    } = {},
  ): Promise<NoteLockSetupResult> {
    const note = await resolveNote(noteId)
    if (!note) {
      return {
        ok: false,
        code: 'note_not_found',
        message: '当前备忘录不存在',
      }
    }

    const globalSettings = await getGlobalSecuritySettings()
    if (!hasConfiguredPin(globalSettings)) {
      return {
        ok: false,
        code: 'pin_required',
        message: '请先创建全局 PIN',
        hasGlobalPin: false,
      }
    }

    try {
      const nextNote = stripLegacyLockFields(note, 1)
      await persistNote(noteId, nextNote)
      await clearSession(noteId)

      const biometricResult = await applyBiometricPreference(Boolean(options.biometricEnabled))

      return {
        ok: true,
        code: biometricResult.code,
        message: biometricResult.message,
        note: nextNote,
        biometricEnabled: biometricResult.biometricEnabled,
        hasGlobalPin: true,
      }
    }
    catch (error) {
      console.error('锁定备忘录失败:', error)
      return {
        ok: false,
        code: 'enable_lock_failed',
        message: '锁定失败，请重试',
        hasGlobalPin: true,
      }
    }
  }

  async function setupGlobalPin(
    noteId: string,
    pin: string,
    confirmPin: string,
    options: {
      biometricEnabled?: boolean
    } = {},
  ): Promise<NoteLockSetupResult> {
    const validation = validatePinSetup(pin, confirmPin)
    if (!validation.ok) {
      return validation
    }

    const note = await resolveNote(noteId)
    if (!note) {
      return {
        ok: false,
        code: 'note_not_found',
        message: '当前备忘录不存在',
      }
    }

    try {
      const salt = createSalt()
      const secretHash = await hashPin(pin, salt)
      const nextSettings: SecuritySettings = {
        scope_key: getScopeKey(),
        pin_secret_salt: salt,
        pin_secret_hash: secretHash,
        pin_version: 1,
        updated: getTime(),
      }

      await putLocalSecuritySettings(nextSettings)

      let resultCode = 'ok'
      let resultMessage: string | null = null
      if (isAuthenticated()) {
        try {
          await persistCloudPinSettings(nextSettings)
        }
        catch (error) {
          logger.error('同步全局 PIN 到云端失败:', {
            scopeKey: nextSettings.scope_key,
            pinVersion: nextSettings.pin_version,
            error,
          })
          resultCode = 'cloud_sync_failed'
          resultMessage = '已在当前设备创建 PIN，但云端同步失败，请稍后重试'
        }
      }

      const lockResult = await enableLockForNote(noteId, options)
      if (!lockResult.ok) {
        return lockResult
      }

      return {
        ...lockResult,
        code: resultCode === 'ok' ? lockResult.code : resultCode,
        message: resultCode === 'ok' ? lockResult.message : resultMessage,
        hasGlobalPin: true,
      }
    }
    catch (error) {
      console.error('创建全局 PIN 失败:', error)
      return {
        ok: false,
        code: 'setup_failed',
        message: '创建 PIN 失败，请重试',
        hasGlobalPin: false,
      }
    }
  }

  async function changeGlobalPin(pin: string, confirmPin: string): Promise<NoteLockManageResult> {
    const validation = validatePinSetup(pin, confirmPin)
    if (!validation.ok) {
      return validation
    }

    try {
      const salt = createSalt()
      const secretHash = await hashPin(pin, salt)
      const currentSettings = await getLocalSecuritySettings()
      const nextSettings: SecuritySettings = {
        ...currentSettings,
        pin_secret_salt: salt,
        pin_secret_hash: secretHash,
        pin_version: (currentSettings.pin_version ?? 0) + 1,
        updated: getTime(),
      }

      await putLocalSecuritySettings(nextSettings)

      if (isAuthenticated()) {
        try {
          await persistCloudPinSettings(nextSettings)
        }
        catch (error) {
          logger.error('同步新全局 PIN 到云端失败:', {
            scopeKey: nextSettings.scope_key,
            pinVersion: nextSettings.pin_version,
            error,
          })
          return {
            ok: true,
            code: 'cloud_sync_failed',
            message: '全局 PIN 已更新，但云端同步失败，请稍后重试',
          }
        }
      }

      return {
        ok: true,
        code: 'ok',
        message: null,
      }
    }
    catch (error) {
      console.error('修改全局 PIN 失败:', error)
      return {
        ok: false,
        code: 'change_pin_failed',
        message: '修改全局 PIN 失败，请重试',
      }
    }
  }

  async function verifyPin(noteId: string, pin: string): Promise<NoteLockVerifyResult> {
    const note = await resolveNote(noteId)
    if (!note || !isPinLockNote(note)) {
      return {
        ok: false,
        code: 'not_locked',
        message: '当前备忘录未设置锁',
        failedAttempts: 0,
        cooldownUntil: null,
      }
    }

    const currentTime = now()
    const currentSession = await getSession(noteId)
    if (currentSession?.cooldown_until && currentSession.cooldown_until > currentTime) {
      return {
        ok: false,
        code: 'cooldown',
        message: 'PIN 输入错误次数过多，请稍后再试',
        failedAttempts: currentSession.failed_attempts,
        cooldownUntil: currentSession.cooldown_until,
        session: currentSession,
      }
    }

    const securitySettings = await getGlobalSecuritySettings(true)
    if (!hasConfiguredPin(securitySettings)) {
      return {
        ok: false,
        code: 'pin_not_configured',
        message: '当前账号尚未配置全局 PIN',
        failedAttempts: currentSession?.failed_attempts ?? 0,
        cooldownUntil: currentSession?.cooldown_until ?? null,
        session: currentSession,
      }
    }

    try {
      const secretHash = await hashPin(pin, securitySettings.pin_secret_salt!)
      if (secretHash === securitySettings.pin_secret_hash) {
        const session = createNoteUnlockSession(noteId, {
          now: currentTime,
          sessionTtl,
        })
        await putSession(session)
        emitNoteLockSessionChanged({
          noteId,
          reason: 'verified',
        })

        return {
          ok: true,
          code: 'ok',
          message: null,
          note,
          failedAttempts: 0,
          cooldownUntil: null,
          session,
        }
      }
    }
    catch (error) {
      console.error('校验全局 PIN 失败:', error)
      return {
        ok: false,
        code: 'verify_failed',
        message: '解锁失败，请重试',
        failedAttempts: currentSession?.failed_attempts ?? 0,
        cooldownUntil: currentSession?.cooldown_until ?? null,
        session: currentSession,
      }
    }

    const failedAttempts = (currentSession?.failed_attempts ?? 0) + 1
    const cooldownUntil = failedAttempts >= maxFailedAttempts ? currentTime + cooldownMs : null
    const failedSession: NoteUnlockSession = {
      note_id: noteId,
      verified_at: currentSession?.verified_at ?? null,
      expires_at: currentSession?.expires_at ?? null,
      failed_attempts: failedAttempts,
      cooldown_until: cooldownUntil,
      updated: getTime(),
    }
    await putSession(failedSession)

    if (cooldownUntil) {
      logger.warn('note-lock pin cooldown triggered', {
        noteId,
        failedAttempts,
        cooldownUntil,
      })
    }

    return {
      ok: false,
      code: cooldownUntil ? 'cooldown' : 'invalid_pin',
      message: cooldownUntil ? 'PIN 输入错误次数过多，请稍后再试' : 'PIN 不正确，请重试',
      failedAttempts,
      cooldownUntil,
      session: failedSession,
    }
  }

  async function tryBiometricUnlock(
    noteId: string,
    noteInput?: Note | null,
  ): Promise<NoteLockBiometricResult> {
    const note = noteInput ? normalizeNoteLockFields(noteInput) : await resolveNote(noteId)
    if (!note || !isPinLockNote(note)) {
      return {
        ok: false,
        code: 'not_locked',
        message: '当前备忘录未设置锁',
        failedAttempts: 0,
        cooldownUntil: null,
      }
    }

    const currentTime = now()
    const currentSession = await getSession(noteId)
    if (currentSession?.cooldown_until && currentSession.cooldown_until > currentTime) {
      return {
        ok: false,
        code: 'cooldown',
        message: 'PIN 输入错误次数过多，请稍后再试',
        failedAttempts: currentSession.failed_attempts,
        cooldownUntil: currentSession.cooldown_until,
        session: currentSession,
      }
    }

    const deviceState = await getDeviceSecurityState()
    if (deviceState.biometric_enabled !== 1) {
      return {
        ok: false,
        code: 'biometric_disabled',
        message: '当前设备未启用生物识别，请输入 PIN 解锁',
        failedAttempts: currentSession?.failed_attempts ?? 0,
        cooldownUntil: currentSession?.cooldown_until ?? null,
        session: currentSession,
      }
    }

    if (!isBiometricSupported()) {
      logger.warn('note-lock biometric unavailable', {
        noteId,
        reasonCode: 'unsupported',
      })
      return {
        ok: false,
        code: 'unsupported',
        message: '当前设备不支持生物识别，请输入 PIN 解锁',
        failedAttempts: currentSession?.failed_attempts ?? 0,
        cooldownUntil: currentSession?.cooldown_until ?? null,
        session: currentSession,
      }
    }

    const verifyResult = await webAuthn.verify({
      credentialId: deviceState.webauthn_credential_id,
      force: true,
    })
    if (!verifyResult.ok) {
      logger.warn('note-lock biometric verify failed', {
        noteId,
        reasonCode: verifyResult.code,
        message: verifyResult.message ?? null,
      })
      return {
        ok: false,
        code: verifyResult.code,
        message: verifyResult.message,
        failedAttempts: currentSession?.failed_attempts ?? 0,
        cooldownUntil: currentSession?.cooldown_until ?? null,
        session: currentSession,
      }
    }

    const session = createNoteUnlockSession(noteId, {
      now: currentTime,
      sessionTtl,
    })
    await putSession(session)
    emitNoteLockSessionChanged({
      noteId,
      reason: 'biometric',
    })

    return {
      ok: true,
      code: 'ok',
      message: null,
      note,
      failedAttempts: 0,
      cooldownUntil: null,
      session,
    }
  }

  async function relock(noteId: string) {
    await clearSession(noteId, 'relock')
  }

  async function setBiometricEnabled(enabled: boolean): Promise<NoteLockManageResult> {
    try {
      if (!enabled) {
        await setDeviceSecurityState({
          biometric_enabled: 0,
        })

        return {
          ok: true,
          code: 'ok',
          message: null,
          biometricEnabled: false,
        }
      }

      if (!isBiometricSupported()) {
        await setDeviceSecurityState({
          biometric_enabled: 0,
        })

        return {
          ok: false,
          code: 'unsupported',
          message: '当前设备不支持生物识别，仍可使用 PIN 解锁',
          biometricEnabled: false,
        }
      }

      const currentDeviceState = await getDeviceSecurityState()
      let credentialId = currentDeviceState.webauthn_credential_id
      if (!webAuthn.checkRegistrationStatus(credentialId)) {
        const registerResult = await webAuthn.register()
        if (!registerResult.ok || !registerResult.credentialId) {
          await setDeviceSecurityState({
            biometric_enabled: 0,
          })

          return {
            ok: false,
            code: registerResult.code,
            message: registerResult.message,
            biometricEnabled: false,
          }
        }

        credentialId = registerResult.credentialId
      }

      await setDeviceSecurityState({
        biometric_enabled: 1,
        webauthn_credential_id: credentialId ?? null,
      })

      return {
        ok: true,
        code: 'ok',
        message: null,
        biometricEnabled: true,
      }
    }
    catch (error) {
      console.error('切换生物识别快捷解锁失败:', error)
      return {
        ok: false,
        code: 'update_failed',
        message: '更新生物识别设置失败，请重试',
        biometricEnabled: false,
      }
    }
  }

  async function disableLockForNote(noteId: string): Promise<NoteLockManageResult> {
    const note = await resolveNote(noteId)
    if (!note) {
      return {
        ok: false,
        code: 'note_not_found',
        message: '当前备忘录不存在',
      }
    }

    const nextNote = stripLegacyLockFields(note, 0)

    try {
      await persistNote(noteId, nextNote)
      await clearSession(noteId)

      return {
        ok: true,
        code: 'ok',
        message: null,
        note: nextNote,
      }
    }
    catch (error) {
      console.error('关闭备忘录锁失败:', error)
      return {
        ok: false,
        code: 'disable_failed',
        message: '关闭锁失败，请重试',
      }
    }
  }

  async function getLockViewState(noteId: string, noteInput?: Note | null): Promise<NoteLockViewSnapshot> {
    const note = noteInput ? normalizeNoteLockFields(noteInput) : await resolveNote(noteId)
    const deviceState = await getDeviceSecurityState()
    const session = await getSession(noteId)
    const currentTime = now()
    const biometricEnabled = deviceState.biometric_enabled === 1
      && webAuthn.checkRegistrationStatus(deviceState.webauthn_credential_id)
    const deviceSupportsBiometric = isBiometricSupported()

    if (!note?.is_locked) {
      return {
        viewState: 'unlocked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled,
        deviceSupportsBiometric,
        session,
      }
    }

    if (isNoteUnlockSessionValid(session, currentTime)) {
      return {
        viewState: 'unlocked',
        failedAttempts: 0,
        cooldownUntil: null,
        biometricEnabled,
        deviceSupportsBiometric,
        session,
      }
    }

    if (session?.cooldown_until && session.cooldown_until > currentTime) {
      return {
        viewState: 'cooldown',
        failedAttempts: session.failed_attempts,
        cooldownUntil: session.cooldown_until,
        biometricEnabled,
        deviceSupportsBiometric,
        session,
      }
    }

    return {
      viewState: 'locked',
      failedAttempts: session?.failed_attempts ?? 0,
      cooldownUntil: session?.cooldown_until ?? null,
      biometricEnabled,
      deviceSupportsBiometric,
      session,
    }
  }

  return {
    changeGlobalPin,
    clearSession,
    disableLock: disableLockForNote,
    disableLockForNote,
    enableLockForNote,
    getDeviceSecurityState,
    getGlobalSecuritySettings,
    getLockViewState,
    getSession,
    hasGlobalPin,
    isBiometricSupported,
    isPinLockNote,
    relock,
    setBiometricEnabled,
    setDeviceSecurityState,
    setupGlobalPin,
    setupPinLock: setupGlobalPin,
    syncSecuritySettingsFromCloud,
    tryBiometricUnlock,
    verifyPin,
  }
}
