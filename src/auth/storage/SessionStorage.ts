import type {RefreshToken} from '@/auth/contracts'

export const SECURE_REFRESH_TOKEN_KEY = 'modula.session.refresh-token.v1'

export interface SessionStorage {
  getRefreshToken(): Promise<RefreshToken | null>
  setRefreshToken(token: RefreshToken): Promise<void>
  clearRefreshToken(): Promise<void>
}
