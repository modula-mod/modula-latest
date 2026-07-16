import type {AccountId, SessionId} from '@/api/contracts/identifiers'
import type {AccessToken, RefreshToken, SessionTokenPair} from '@/auth/contracts'
import {LocalApiClock} from '@/api/local/LocalApiClock'

let tokenCounter = 0

export class LocalTokenIssuer {
  constructor(private readonly clock: LocalApiClock) {}

  issue(input: {sessionId: SessionId; accountId: AccountId}): SessionTokenPair {
    tokenCounter += 1
    const entropy = `${Date.now()}_${tokenCounter}`
    return {
      accessToken: `local_access_${input.sessionId}_${input.accountId}_${entropy}` as AccessToken,
      refreshToken: `local_refresh_${input.sessionId}_${input.accountId}_${entropy}` as RefreshToken,
      accessTokenExpiresAt: this.clock.minutesFromNow(10),
    }
  }
}
