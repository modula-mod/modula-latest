import type {AccessToken, AuthResult} from '@/auth/contracts'
import type {SessionStorage} from '@/auth/storage'
import type {AuthRepository} from '@/data/repositories/contracts'
import {AccessTokenStore} from '@/auth/runtime/AccessTokenStore'

export class SessionRefreshCoordinator {
  private inFlight: Promise<AuthResult | null> | null = null
  private failedHandler: (() => void) | null = null

  constructor(
    private readonly authRepository: AuthRepository,
    private readonly sessionStorage: SessionStorage,
    private readonly accessTokenStore: AccessTokenStore,
  ) {}

  onFailed(handler: () => void) {
    this.failedHandler = handler
  }

  async refresh(): Promise<AccessToken | null> {
    const before = await this.sessionStorage.getRefreshToken()
    if (!before) {
      this.failedHandler?.()
      return null
    }
    const result = await this.refreshSession()
    if (result) return result.tokens.accessToken

    // Mid-session 401 recovery: wipe only if the vault still holds the dead token.
    const after = await this.sessionStorage.getRefreshToken()
    if (!after || after === before) {
      this.accessTokenStore.clear()
      await this.sessionStorage.clearSessionBundle().catch(() => undefined)
      this.failedHandler?.()
    }
    return null
  }

  /** Single-flight session refresh used by HTTP 401 recovery and cold-start bootstrap. */
  async refreshSession(): Promise<AuthResult | null> {
    if (!this.inFlight) {
      this.inFlight = this.runRefresh().finally(() => {
        this.inFlight = null
      })
    }
    return this.inFlight
  }

  private async runRefresh(): Promise<AuthResult | null> {
    const refreshToken = await this.sessionStorage.getRefreshToken()
    if (!refreshToken) return null
    try {
      const result = await this.authRepository.refresh(refreshToken)
      this.accessTokenStore.set(result.tokens.accessToken)
      await this.sessionStorage.setSessionBundle({
        accessToken: result.tokens.accessToken,
        refreshToken: result.tokens.refreshToken,
        sessionId: result.session.sessionId,
        accessTokenExpiresAt: result.tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt,
      })
      return result
    } catch {
      // Callers decide whether the failure is definitive (avoid Strict Mode wipe races).
      return null
    }
  }
}
