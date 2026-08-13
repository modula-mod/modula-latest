import type {GreenfieldAccount} from '@modula/greenfield-contracts'

import type {AuthResult, AuthenticatedSession} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts/SessionTokens'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {toModulaAccount} from '@/api/decoding/decodeGreenfieldAccount'
import {parseSessionId} from '@/api/contracts/identifiers'
import {asIsoDate, asRecord, asString} from '@/api/decoding/validation'
import type {ModulaProfile} from '@/features/profile/contracts'

function decodeLegacyAccount(value: unknown) {
  const account = asRecord(value, 'account')
  const id = asString(account.id ?? account.accountId, 'account id')
  const handle = typeof account.primaryHandle === 'string' ? account.primaryHandle : undefined
  const createdAt = asIsoDate(account.createdAt, 'account createdAt')
  const status =
    typeof account.status === 'string' &&
    ['pendingVerification', 'active', 'suspended', 'deactivated', 'deleted'].includes(account.status)
      ? (account.status as GreenfieldAccount['status'])
      : 'active'
  const greenfield: GreenfieldAccount & {email?: string} = {
    accountId: id,
    primaryHandle: handle ?? asString(account.displayName, 'display name').toLowerCase().replace(/\s+/g, ''),
    status,
    createdAt,
    updatedAt: typeof account.updatedAt === 'string' ? asIsoDate(account.updatedAt, 'updatedAt') : createdAt,
    email: typeof account.email === 'string' ? account.email : undefined,
  }
  return {
    modula: toModulaAccount(
      greenfield,
      typeof account.displayName === 'string' ? account.displayName : greenfield.primaryHandle,
    ),
    greenfield,
  }
}

export function decodeAuthenticatedSession(value: unknown): AuthenticatedSession {
  const session = asRecord(value, 'session')
  const {modula, greenfield} = decodeLegacyAccount(session.account)
  return {
    status: 'signedIn',
    sessionId: parseSessionId(session.sessionId),
    account: modula,
    greenfieldAccount: greenfield,
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
      accessTokenExpiresAt: asIsoDate(
        tokens.accessTokenExpiresAt ?? tokens.accessExpiresAt,
        'access token expiry',
      ),
      refreshTokenExpiresAt:
        tokens.refreshTokenExpiresAt || tokens.refreshExpiresAt
          ? asIsoDate(
              tokens.refreshTokenExpiresAt ?? tokens.refreshExpiresAt,
              'refresh token expiry',
            )
          : undefined,
    },
  }
}

export function decodeSessionTokenResponse(value: unknown): {
  accessToken: string
  refreshToken: string
  sessionId: string
  accessExpiresAt: string
  refreshExpiresAt: string
} {
  const result = asRecord(value, 'session tokens')
  return {
    accessToken: asString(result.accessToken, 'access token'),
    refreshToken: asString(result.refreshToken, 'refresh token'),
    sessionId: asString(result.sessionId, 'session id'),
    accessExpiresAt: asIsoDate(result.accessExpiresAt ?? result.accessTokenExpiresAt, 'access expiry'),
    refreshExpiresAt: asIsoDate(
      result.refreshExpiresAt ?? result.refreshTokenExpiresAt,
      'refresh expiry',
    ),
  }
}

export function buildAuthenticatedSession(input: {
  sessionId: string
  account: GreenfieldAccount & {email?: string}
  profile: ModulaProfile
  accessTokenExpiresAt: string
}): AuthenticatedSession {
  return {
    status: 'signedIn',
    sessionId: parseSessionId(input.sessionId),
    account: toModulaAccount(input.account, input.profile.displayName),
    greenfieldAccount: {
      accountId: input.account.accountId,
      primaryHandle: input.account.primaryHandle,
      status: input.account.status,
      createdAt: input.account.createdAt,
      updatedAt: input.account.updatedAt,
    },
    profile: input.profile,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
  }
}

export function profileFromGreenfieldAccount(
  account: GreenfieldAccount & {email?: string},
  displayName?: string,
): ModulaProfile {
  const handle = account.primaryHandle
  return {
    id: `profile-${handle}`,
    handle,
    displayName: displayName ?? handle,
    bio: '',
    kind: 'person',
    joinedAt: account.createdAt,
    followerCount: 0,
    followingCount: 0,
    moduleCount: 0,
    postCount: 0,
    isFollowing: false,
    followsViewer: false,
    identityClaims: [],
    links: [],
    featuredModuleIds: [],
    focusStatus: {
      id: 'available',
      label: 'Available',
      message: 'Open to collaborate',
      updatedAt: account.createdAt,
    },
  }
}
