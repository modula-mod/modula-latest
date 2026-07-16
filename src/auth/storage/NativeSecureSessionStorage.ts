import * as SecureStore from 'expo-secure-store'

import type {RefreshToken} from '@/auth/contracts'
import {parseRefreshToken} from '@/auth/contracts'
import {SECURE_REFRESH_TOKEN_KEY, type SessionStorage} from '@/auth/storage/SessionStorage'

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
}

export class NativeSecureSessionStorage implements SessionStorage {
  constructor(private readonly shouldFail?: () => boolean) {}

  private assertAvailable() {
    if (this.shouldFail?.()) {
      throw new Error('Secure session storage is unavailable in this simulation.')
    }
  }

  async getRefreshToken(): Promise<RefreshToken | null> {
    this.assertAvailable()
    const available = await SecureStore.isAvailableAsync()
    if (!available) return null
    const value = await SecureStore.getItemAsync(SECURE_REFRESH_TOKEN_KEY, options)
    return value ? parseRefreshToken(value) : null
  }

  async setRefreshToken(token: RefreshToken): Promise<void> {
    this.assertAvailable()
    await SecureStore.setItemAsync(SECURE_REFRESH_TOKEN_KEY, token, options)
  }

  async clearRefreshToken(): Promise<void> {
    this.assertAvailable()
    await SecureStore.deleteItemAsync(SECURE_REFRESH_TOKEN_KEY, options)
  }
}
