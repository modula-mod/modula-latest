import type {RefreshToken} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts'
import type {SessionStorage, StoredSessionBundle} from '@/auth/storage/SessionStorage'

export const WEB_SESSION_BUNDLE_KEY = 'modula.web.session.bundle.v1'

function getLocalStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage
  } catch {
    return null
  }
}

function isExpired(value: string | undefined): boolean {
  if (!value) return false
  const expiresAt = Date.parse(value)
  return Number.isFinite(expiresAt) && expiresAt <= Date.now()
}

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
    if (isExpired(value.refreshTokenExpiresAt)) return null
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

/**
 * Web persists the opaque session bundle in one localStorage key so a valid
 * Greenfield session survives reload and browser restart. The access token is
 * still mirrored only through AccessTokenStore for request headers.
 */
export class WebPersistentSessionStorage implements SessionStorage {
  private fallbackBundle: StoredSessionBundle | null = null

  async getSessionBundle(): Promise<StoredSessionBundle | null> {
    const storage = getLocalStorage()
    if (!storage) return this.fallbackBundle

    const raw = storage.getItem(WEB_SESSION_BUNDLE_KEY)
    if (!raw) return null
    const bundle = parseBundle(raw)
    if (!bundle) {
      storage.removeItem(WEB_SESSION_BUNDLE_KEY)
      return null
    }
    return bundle
  }

  async setSessionBundle(bundle: StoredSessionBundle): Promise<void> {
    const storage = getLocalStorage()
    if (!storage) {
      this.fallbackBundle = bundle
      return
    }
    storage.setItem(WEB_SESSION_BUNDLE_KEY, JSON.stringify(bundle))
  }

  async clearSessionBundle(): Promise<void> {
    this.fallbackBundle = null
    getLocalStorage()?.removeItem(WEB_SESSION_BUNDLE_KEY)
  }

  async getRefreshToken(): Promise<RefreshToken | null> {
    return (await this.getSessionBundle())?.refreshToken ?? null
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
