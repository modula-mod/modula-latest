import type {AccessToken, RefreshToken} from '@/auth/contracts'

/** SecureStore / memory key for the opaque session bundle (tokens + metadata). */
export const SECURE_SESSION_BUNDLE_KEY = 'modula.session.bundle.v1'

/** @deprecated Prefer SECURE_SESSION_BUNDLE_KEY — retained for migration reads. */
export const SECURE_REFRESH_TOKEN_KEY = 'modula.session.refresh-token.v1'

export type StoredSessionBundle = {
  accessToken: AccessToken
  refreshToken: RefreshToken
  sessionId: string
  accessTokenExpiresAt: string
  refreshTokenExpiresAt?: string
}

export interface SessionStorage {
  getRefreshToken(): Promise<RefreshToken | null>
  setRefreshToken(token: RefreshToken): Promise<void>
  clearRefreshToken(): Promise<void>
  getSessionBundle(): Promise<StoredSessionBundle | null>
  setSessionBundle(bundle: StoredSessionBundle): Promise<void>
  clearSessionBundle(): Promise<void>
}
