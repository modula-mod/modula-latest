import type {AuthResult, AuthenticatedSession} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts/SessionTokens'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {parseAccountId, parseSessionId} from '@/api/contracts/identifiers'
import {asIsoDate, asRecord, asString} from '@/api/decoding/validation'

function decodeAccount(value: unknown) {
  const account = asRecord(value, 'account')
  return {
    id: parseAccountId(account.id),
    email: asString(account.email, 'account email'),
    displayName: asString(account.displayName, 'account display name'),
    createdAt: asIsoDate(account.createdAt, 'account createdAt'),
  }
}

export function decodeAuthenticatedSession(value: unknown): AuthenticatedSession {
  const session = asRecord(value, 'session')
  return {
    status: 'signedIn',
    sessionId: parseSessionId(session.sessionId),
    account: decodeAccount(session.account),
    profile: decodeProfile(session.profile),
    accessTokenExpiresAt: asIsoDate(session.accessTokenExpiresAt, 'access token expiry'),
  }
}

export function decodeAuthResult(value: unknown): AuthResult {
  const result = asRecord(value, 'auth result')
  const tokens = asRecord(result.tokens, 'session tokens')
  return {
    session: decodeAuthenticatedSession(result.session),
    tokens: {
      accessToken: parseAccessToken(asString(tokens.accessToken, 'access token')),
      refreshToken: parseRefreshToken(asString(tokens.refreshToken, 'refresh token')),
      accessTokenExpiresAt: asIsoDate(tokens.accessTokenExpiresAt, 'access token expiry'),
    },
  }
}
