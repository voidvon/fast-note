import { describe, expect, it } from 'vitest'
import {
  NOTE_DATABASE_SCHEMA_V1,
  NOTE_DATABASE_SCHEMA_V2,
  NOTE_DATABASE_SCHEMA_V3,
  NOTE_DATABASE_VERSION,
} from '@/shared/lib/storage/dexie'
import { getDefaultNoteLockFields, normalizeNoteLockFields } from '@/shared/types'

describe('dexie lock schema (t-fn-036)', () => {
  it('keeps database schema on v3 and adds dedicated security tables', () => {
    expect(NOTE_DATABASE_VERSION).toBe(3)
    expect(NOTE_DATABASE_SCHEMA_V1).not.toHaveProperty('device_security_state')
    expect(NOTE_DATABASE_SCHEMA_V2).not.toHaveProperty('security_settings')
    expect(NOTE_DATABASE_SCHEMA_V3).toMatchObject({
      security_settings: '&scope_key, updated',
      device_security_state: '&scope_key, updated',
      note_unlock_sessions: '&note_id, expires_at, updated',
    })
    expect(NOTE_DATABASE_SCHEMA_V3.notes).toContain('is_locked')
    expect(NOTE_DATABASE_SCHEMA_V3.notes).not.toContain('lock_type')
    expect(NOTE_DATABASE_SCHEMA_V3.notes).not.toContain('lock_secret_hash')
    expect(NOTE_DATABASE_SCHEMA_V3.notes).not.toContain('lock_version')
  })

  it('treats is_locked as the only source of note lock state', () => {
    expect(getDefaultNoteLockFields({
      is_locked: 1,
    })).toMatchObject({
      is_locked: 1,
      lock_type: null,
      lock_secret_salt: null,
      lock_secret_hash: null,
      lock_version: null,
    })

    expect(normalizeNoteLockFields({
      is_locked: 0,
      lock_secret_salt: 'salt',
      lock_secret_hash: 'hash',
    })).toMatchObject({
      is_locked: 0,
      lock_type: null,
      lock_secret_salt: 'salt',
      lock_secret_hash: 'hash',
      lock_version: null,
    })
  })
})
