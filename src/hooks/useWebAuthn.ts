import { reactive } from 'vue'

const LEGACY_CREDENTIAL_STORAGE_KEY = 'webauthn_credential_id'
const LEGACY_VERIFIED_AT_STORAGE_KEY = 'webauthn_last_verified_at'
const LEGACY_VERIFICATION_EXPIRY = 60 * 1000

export type WebAuthnResultCode = 'ok' | 'unsupported' | 'not_registered' | 'cancelled' | 'timeout' | 'failed'

export interface WebAuthnOperationResult {
  ok: boolean
  code: WebAuthnResultCode
  message: string | null
  credentialId?: string | null
}

export interface WebAuthnVerifyOptions {
  credentialId?: string | null
  force?: boolean
}

export interface WebAuthnState {
  isSupported: boolean
  isRegistered: boolean
  isRegistering: boolean
  isVerifying: boolean
  errorMessage: string | null
  successMessage: string | null
}

export interface UseWebAuthnCapability {
  state: WebAuthnState
  checkSupport: () => boolean
  checkRegistrationStatus: (credentialId?: string | null) => boolean
  clearLegacyCredential: () => void
  getLegacyCredential: () => string | null
  register: () => Promise<WebAuthnOperationResult>
  verify: (options?: WebAuthnVerifyOptions) => Promise<WebAuthnOperationResult>
}

function isWebAuthnSupported() {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential
}

function generateChallenge(): ArrayBuffer {
  const challenge = new Uint8Array(32)
  globalThis.crypto.getRandomValues(challenge)
  return challenge.buffer
}

function encodeCredentialId(credentialId: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(credentialId)))
}

function decodeCredentialId(credentialId: string) {
  try {
    const binary = atob(credentialId)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index++) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes.buffer
  }
  catch {
    return null
  }
}

function saveLegacyCredential(credentialId: string) {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(LEGACY_CREDENTIAL_STORAGE_KEY, credentialId)
}

function getLegacyCredential() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  return localStorage.getItem(LEGACY_CREDENTIAL_STORAGE_KEY)
}

function saveVerificationTimestamp(timestamp: number) {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(LEGACY_VERIFIED_AT_STORAGE_KEY, String(timestamp))
}

function getVerificationTimestamp() {
  if (typeof localStorage === 'undefined') {
    return null
  }

  const timestamp = localStorage.getItem(LEGACY_VERIFIED_AT_STORAGE_KEY)
  return timestamp ? Number.parseInt(timestamp, 10) : null
}

function isVerificationExpired() {
  const lastVerifiedAt = getVerificationTimestamp()
  if (!lastVerifiedAt) {
    return true
  }

  return Date.now() - lastVerifiedAt > LEGACY_VERIFICATION_EXPIRY
}

function clearMessages(state: WebAuthnState) {
  state.errorMessage = null
  state.successMessage = null
}

function createUnsupportedResult(): WebAuthnOperationResult {
  return {
    ok: false,
    code: 'unsupported',
    message: '当前设备不支持生物识别，请改用 PIN 解锁',
  }
}

function createNotRegisteredResult(): WebAuthnOperationResult {
  return {
    ok: false,
    code: 'not_registered',
    message: '当前设备尚未启用生物识别，请改用 PIN 解锁',
  }
}

function inferErrorCode(error: unknown): Exclude<WebAuthnResultCode, 'ok' | 'unsupported' | 'not_registered'> {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message : ''

  if (name === 'AbortError') {
    return 'cancelled'
  }

  if (name === 'NotAllowedError') {
    return /timed?\s*out/i.test(message) ? 'timeout' : 'cancelled'
  }

  return 'failed'
}

function createErrorResult(error: unknown, action: 'register' | 'verify'): WebAuthnOperationResult {
  const code = inferErrorCode(error)

  if (action === 'register') {
    if (code === 'cancelled') {
      return {
        ok: false,
        code,
        message: '已取消生物识别启用，当前仅可使用 PIN 解锁',
      }
    }

    if (code === 'timeout') {
      return {
        ok: false,
        code,
        message: '生物识别启用超时，当前仅可使用 PIN 解锁',
      }
    }

    return {
      ok: false,
      code,
      message: '生物识别启用失败，当前仅可使用 PIN 解锁',
    }
  }

  if (code === 'cancelled') {
    return {
      ok: false,
      code,
      message: '已取消生物识别验证，请输入 PIN 解锁',
    }
  }

  if (code === 'timeout') {
    return {
      ok: false,
      code,
      message: '生物识别验证超时，请输入 PIN 解锁',
    }
  }

  return {
    ok: false,
    code,
    message: '生物识别验证失败，请输入 PIN 解锁',
  }
}

export function useWebAuthn(): UseWebAuthnCapability {
  const state = reactive<WebAuthnState>({
    isSupported: isWebAuthnSupported(),
    isRegistered: false,
    isRegistering: false,
    isVerifying: false,
    errorMessage: null,
    successMessage: null,
  })

  function checkSupport() {
    state.isSupported = isWebAuthnSupported()
    return state.isSupported
  }

  function checkRegistrationStatus(credentialId?: string | null) {
    const source = credentialId ?? getLegacyCredential()
    const isRegistered = !!source && !!decodeCredentialId(source)
    state.isRegistered = isRegistered
    return isRegistered
  }

  async function register(): Promise<WebAuthnOperationResult> {
    clearMessages(state)

    if (!checkSupport()) {
      const result = createUnsupportedResult()
      state.errorMessage = result.message
      return result
    }

    state.isRegistering = true

    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: generateChallenge(),
          rp: {
            name: 'Fast Note',
            id: window.location.hostname,
          },
          user: {
            id: new Uint8Array([1, 2, 3, 4]),
            name: 'local-user',
            displayName: '本地用户',
          },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
        },
      }) as PublicKeyCredential | null

      if (!credential) {
        const result = createErrorResult(new Error('credential_missing'), 'register')
        state.errorMessage = result.message
        return result
      }

      const credentialId = encodeCredentialId(credential.rawId)
      saveLegacyCredential(credentialId)
      state.isRegistered = true
      state.successMessage = 'ok'

      return {
        ok: true,
        code: 'ok',
        message: null,
        credentialId,
      }
    }
    catch (error) {
      const result = createErrorResult(error, 'register')
      state.errorMessage = result.message
      return result
    }
    finally {
      state.isRegistering = false
    }
  }

  async function verify(options: WebAuthnVerifyOptions = {}): Promise<WebAuthnOperationResult> {
    clearMessages(state)

    if (!checkSupport()) {
      const result = createUnsupportedResult()
      state.errorMessage = result.message
      return result
    }

    const credentialId = options.credentialId ?? getLegacyCredential()
    if (!checkRegistrationStatus(credentialId)) {
      const result = createNotRegisteredResult()
      state.errorMessage = result.message
      return result
    }

    if (!options.force && !options.credentialId && !isVerificationExpired()) {
      saveVerificationTimestamp(Date.now())
      state.successMessage = 'ok'
      return {
        ok: true,
        code: 'ok',
        message: null,
        credentialId,
      }
    }

    const decodedCredentialId = decodeCredentialId(credentialId!)
    if (!decodedCredentialId) {
      const result = createNotRegisteredResult()
      state.errorMessage = result.message
      return result
    }

    state.isVerifying = true

    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: generateChallenge(),
          allowCredentials: [
            {
              id: decodedCredentialId,
              type: 'public-key',
            },
          ],
          userVerification: 'required',
          timeout: 60000,
        },
      })

      saveVerificationTimestamp(Date.now())
      state.successMessage = 'ok'

      return {
        ok: true,
        code: 'ok',
        message: null,
        credentialId,
      }
    }
    catch (error) {
      const result = createErrorResult(error, 'verify')
      state.errorMessage = result.message
      return result
    }
    finally {
      state.isVerifying = false
    }
  }

  function clearLegacyCredential() {
    if (typeof localStorage === 'undefined') {
      state.isRegistered = false
      state.errorMessage = null
      state.successMessage = null
      return
    }

    localStorage.removeItem(LEGACY_CREDENTIAL_STORAGE_KEY)
    localStorage.removeItem(LEGACY_VERIFIED_AT_STORAGE_KEY)
    state.isRegistered = false
    state.errorMessage = null
    state.successMessage = null
  }

  checkRegistrationStatus()

  return {
    state,
    checkSupport,
    checkRegistrationStatus,
    clearLegacyCredential,
    getLegacyCredential,
    register,
    verify,
  }
}
