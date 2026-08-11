import * as SecureStore from 'expo-secure-store'

import type {RefreshToken} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts'
import {
  SECURE_REFRESH_TOKEN_KEY,
  SECURE_SESSION_BUNDLE_KEY,
  type SessionStorage,
  type StoredSessionBundle,
} from '@/auth/storage/SessionStorage'

/** Prefer cold-launch survivability on Simulator + device. */
const preferredWriteOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

/** Legacy / fallback write targets used during migration and verify failures. */
const writeOptionFallbacks: SecureStore.SecureStoreOptions[] = [
  preferredWriteOptions,
  {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY},
  {keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK},
  {},
]

const readOptionCandidates: SecureStore.SecureStoreOptions[] = [
  preferredWriteOptions,
  {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY},
  {keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK},
  {},
]

function parseBundle(raw: string): StoredSessionBundle | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredSessionBundle>
    if (
      typeof value.accessToken !== 'string' ||
      typeof value.refreshToken !== 'string' ||
      typeof value.sessionId !== 'string' ||
      typeof value.accessTokenExpiresAt !== 'string'
    ) {
      return null
    }
    return {
      accessToken: parseAccessToken(value.accessToken),
      refreshToken: parseRefreshToken(value.refreshToken),
      sessionId: value.sessionId,
      accessTokenExpiresAt: value.accessTokenExpiresAt,
      refreshTokenExpiresAt:
        typeof value.refreshTokenExpiresAt === 'string' ? value.refreshTokenExpiresAt : undefined,
    }
  } catch {
    return null
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function readSecureItem(key: string): Promise<string | null> {
  for (const options of readOptionCandidates) {
    const value = await SecureStore.getItemAsync(key, options).catch(() => null)
    if (value) return value
  }
  return null
}

async function readSecureItemWithRetry(key: string, attempts = 4): Promise<string | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const value = await readSecureItem(key)
    if (value) return value
    if (attempt < attempts - 1) await sleep(50 * (attempt + 1))
  }
  return null
}

async function writeSecureItem(key: string, value: string): Promise<void> {
  let lastError: unknown
  for (const options of writeOptionFallbacks) {
    try {
      await SecureStore.setItemAsync(key, value, options)
      const verified = await readSecureItem(key)
      if (verified === value) return
      if (__DEV__) {
        console.warn(
          `SecureStore write verify mismatch for ${key}; trying next accessibility.`,
        )
      }
    } catch (error) {
      lastError = error
      if (__DEV__) {
        console.warn(
          `SecureStore write failed for ${key}:`,
          error instanceof Error ? error.message : 'unknown',
        )
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('SecureStore write failed after accessibility fallbacks.')
}

async function deleteSecureItem(key: string): Promise<void> {
  for (const options of readOptionCandidates) {
    await SecureStore.deleteItemAsync(key, options).catch(() => undefined)
  }
}

export class NativeSecureSessionStorage implements SessionStorage {
  constructor(private readonly shouldFail?: () => boolean) {}

  private assertAvailable() {
    if (this.shouldFail?.()) {
      throw new Error('Secure session storage is unavailable in this simulation.')
    }
  }

  async getSessionBundle(): Promise<StoredSessionBundle | null> {
    this.assertAvailable()
    // isAvailableAsync can flake false on cold Simulator launch — retry before giving up.
    let available = false
    for (let attempt = 0; attempt < 4; attempt += 1) {
      available = await SecureStore.isAvailableAsync().catch(() => false)
      if (available) break
      await sleep(40 * (attempt + 1))
    }
    if (!available) {
      if (__DEV__) console.warn('SecureStore unavailable during session read')
      return null
    }
    const bundled = await readSecureItemWithRetry(SECURE_SESSION_BUNDLE_KEY)
    if (bundled) return parseBundle(bundled)
    // Migrate legacy refresh-token-only storage.
    const legacy = await readSecureItemWithRetry(SECURE_REFRESH_TOKEN_KEY)
    if (!legacy) return null
    return {
      accessToken: parseAccessToken(''),
      refreshToken: parseRefreshToken(legacy),
      sessionId: '',
      accessTokenExpiresAt: new Date(0).toISOString(),
    }
  }

  async setSessionBundle(bundle: StoredSessionBundle): Promise<void> {
    this.assertAvailable()
    await writeSecureItem(SECURE_SESSION_BUNDLE_KEY, JSON.stringify(bundle))
    await deleteSecureItem(SECURE_REFRESH_TOKEN_KEY)
  }

  async clearSessionBundle(): Promise<void> {
    this.assertAvailable()
    await deleteSecureItem(SECURE_SESSION_BUNDLE_KEY)
    await deleteSecureItem(SECURE_REFRESH_TOKEN_KEY)
  }

  async getRefreshToken(): Promise<RefreshToken | null> {
    const bundle = await this.getSessionBundle()
    return bundle?.refreshToken ?? null
  }

  async setRefreshToken(token: RefreshToken): Promise<void> {
    const existing = await this.getSessionBundle()
    await this.setSessionBundle({
      accessToken: existing?.accessToken ?? parseAccessToken(''),
      refreshToken: token,
      sessionId: existing?.sessionId ?? '',
      accessTokenExpiresAt: existing?.accessTokenExpiresAt ?? new Date(0).toISOString(),
      refreshTokenExpiresAt: existing?.refreshTokenExpiresAt,
    })
  }

  async clearRefreshToken(): Promise<void> {
    await this.clearSessionBundle()
  }
}
