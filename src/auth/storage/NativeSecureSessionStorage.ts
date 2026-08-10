import * as SecureStore from 'expo-secure-store'

import type {RefreshToken} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts'
import {
  SECURE_REFRESH_TOKEN_KEY,
  SECURE_SESSION_BUNDLE_KEY,
  type SessionStorage,
  type StoredSessionBundle,
} from '@/auth/storage/SessionStorage'

const writeOptions: SecureStore.SecureStoreOptions = {
  // AFTER_FIRST_UNLOCK survives cold launches more reliably than WHEN_UNLOCKED
  // on Simulator while still remaining device-local.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
}

const readOptionCandidates: SecureStore.SecureStoreOptions[] = [
  writeOptions,
  {keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY},
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

async function readSecureItem(key: string): Promise<string | null> {
  for (const options of readOptionCandidates) {
    const value = await SecureStore.getItemAsync(key, options).catch(() => null)
    if (value) return value
  }
  return null
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
    const available = await SecureStore.isAvailableAsync()
    if (!available) return null
    const bundled = await readSecureItem(SECURE_SESSION_BUNDLE_KEY)
    if (bundled) return parseBundle(bundled)
    // Migrate legacy refresh-token-only storage.
    const legacy = await readSecureItem(SECURE_REFRESH_TOKEN_KEY)
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
    await SecureStore.setItemAsync(SECURE_SESSION_BUNDLE_KEY, JSON.stringify(bundle), writeOptions)
    await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY, writeOptions).catch(() => undefined)
    await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }).catch(() => undefined)
  }

  async clearSessionBundle(): Promise<void> {
    this.assertAvailable()
    for (const options of readOptionCandidates) {
      await SecureStore.deleteItemAsync(SECURE_SESSION_BUNDLE_KEY, options).catch(() => undefined)
      await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY, options).catch(() => undefined)
    }
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
