import type {RefreshToken} from '@/auth/contracts'
import {parseAccessToken} from '@/auth/contracts'
import type {SessionStorage, StoredSessionBundle} from '@/auth/storage/SessionStorage'

/** Web keeps the session bundle in memory only — never LocalStorage / AsyncStorage. */
export class WebMemorySessionStorage implements SessionStorage {
  private bundle: StoredSessionBundle | null = null

  async getSessionBundle(): Promise<StoredSessionBundle | null> {
    return this.bundle
  }

  async setSessionBundle(bundle: StoredSessionBundle): Promise<void> {
    this.bundle = bundle
  }

  async clearSessionBundle(): Promise<void> {
    this.bundle = null
  }

  async getRefreshToken(): Promise<RefreshToken | null> {
    return this.bundle?.refreshToken ?? null
  }

  async setRefreshToken(token: RefreshToken): Promise<void> {
    this.bundle = {
      accessToken: this.bundle?.accessToken ?? parseAccessToken(''),
      refreshToken: token,
      sessionId: this.bundle?.sessionId ?? '',
      accessTokenExpiresAt: this.bundle?.accessTokenExpiresAt ?? new Date(0).toISOString(),
      refreshTokenExpiresAt: this.bundle?.refreshTokenExpiresAt,
    }
  }

  async clearRefreshToken(): Promise<void> {
    this.bundle = null
  }
}