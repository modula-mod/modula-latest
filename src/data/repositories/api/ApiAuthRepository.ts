import type {GreenfieldAccount, GreenfieldSession} from '@modula/greenfield-contracts'

import {
  buildAuthenticatedSession,
  decodeAuthenticatedSession,
  decodeSessionTokenResponse,
  profileFromGreenfieldAccount,
} from '@/api/decoding'
import {decodeGreenfieldAccount} from '@/api/decoding/decodeGreenfieldAccount'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {asRecord, asString} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {AccessTokenStore} from '@/auth/runtime/AccessTokenStore'
import type {
  AccessToken,
  AuthResult,
  AuthenticatedSession,
  ChangePasswordInput,
  ForgotPasswordInput,
  RefreshToken,
  RegisterAccountInput,
  RegisterPendingResult,
  ResetPasswordInput,
  SignInCredentials,
  VerifyEmailInput,
} from '@/auth/contracts'
import {parseAccessToken, parseRefreshToken} from '@/auth/contracts'
import type {
  AuthRepository,
  EmailVerificationResult,
  HandleAvailability,
  RepositoryExportJob,
} from '@/data/repositories/contracts/AuthRepository'

function decodeRegisterPending(value: unknown, email: string): RegisterPendingResult {
  const result = asRecord(value, 'register result')
  return {
    kind: 'pendingVerification',
    email,
    accountId: asString(result.accountId, 'accountId'),
    primaryHandle: asString(result.primaryHandle, 'primaryHandle'),
    verificationToken:
      typeof result.verificationToken === 'string' ? result.verificationToken : undefined,
  }
}

function decodeExportJob(value: unknown): RepositoryExportJob {
  const job = asRecord(value, 'export job')
  const status = asString(job.status, 'export status')
  return {
    exportId: asString(job.exportId ?? job.export_id, 'exportId'),
    status: (['queued', 'running', 'completed', 'failed'].includes(status)
      ? status
      : 'queued') as RepositoryExportJob['status'],
    createdAt: asString(job.createdAt ?? job.created_at, 'createdAt'),
    downloadUrl: typeof job.downloadUrl === 'string' ? job.downloadUrl : undefined,
    integrityNote:
      typeof job.integrityNote === 'string'
        ? job.integrityNote
        : 'Exports include integrity metadata so you can verify the Greenfield repository package.',
  }
}

function decodeSessions(value: unknown): GreenfieldSession[] {
  const list = Array.isArray(value) ? value : asRecord(value, 'sessions').items
  if (!Array.isArray(list)) return []
  return list.map(item => {
    const row = asRecord(item, 'session')
    return {
      sessionId: asString(row.sessionId ?? row.session_id, 'sessionId'),
      accountId: asString(row.accountId ?? row.account_id, 'accountId'),
      status: asString(row.status, 'status') as GreenfieldSession['status'],
      createdAt: asString(row.createdAt ?? row.created_at, 'createdAt'),
      lastSeenAt: asString(
        row.lastSeenAt ?? row.last_seen_at ?? row.createdAt ?? row.created_at,
        'lastSeenAt',
      ),
      expiresAt: asString(row.expiresAt ?? row.expires_at, 'expiresAt'),
      revokedAt:
        row.revokedAt == null && row.revoked_at == null
          ? null
          : asString(row.revokedAt ?? row.revoked_at, 'revokedAt'),
      userAgent: typeof row.userAgent === 'string' ? row.userAgent : undefined,
      platform: row.platform as GreenfieldSession['platform'],
    }
  })
}

export class ApiAuthRepository implements AuthRepository {
  constructor(
    private readonly client: ApiClient,
    private readonly accessTokenStore: AccessTokenStore,
  ) {}

  async signIn(credentials: SignInCredentials): Promise<AuthResult> {
    const tokens = await this.client.post(
      {path: '/v1/sessions', body: credentials},
      decodeSessionTokenResponse,
    )
    return this.hydrateSession(tokens)
  }

  register(input: RegisterAccountInput): Promise<RegisterPendingResult | AuthResult> {
    const email = input.email.trim().toLowerCase()
    return this.client.post(
      {
        path: '/v1/accounts/register',
        body: {
          email,
          password: input.password,
          handle: input.handle.trim().toLowerCase(),
          inviteCode: input.inviteCode,
          displayName: input.displayName,
          acceptedTerms: input.acceptedTerms === true,
        },
      },
      value => decodeRegisterPending(value, email),
    )
  }

  async verifyEmail(input: VerifyEmailInput): Promise<EmailVerificationResult> {
    const verified = await this.client.post(
      {path: '/v1/accounts/verify-email', body: {token: input.token}},
      value => {
        const row = asRecord(value, 'verify email')
        if (row.session && row.tokens) {
          return value
        }
        return row
      },
    )
    const record = asRecord(verified, 'verified')
    if (record.accessToken && record.refreshToken && record.sessionId) {
      return this.hydrateSession(decodeSessionTokenResponse(verified))
    }
    if (record.session && record.tokens) {
      const tokens = asRecord(record.tokens, 'tokens')
      return this.hydrateSession({
        accessToken: asString(tokens.accessToken, 'accessToken'),
        refreshToken: asString(tokens.refreshToken, 'refreshToken'),
        sessionId: asString(asRecord(record.session, 'session').sessionId, 'sessionId'),
        accessExpiresAt: asString(
          tokens.accessTokenExpiresAt ?? tokens.accessExpiresAt,
          'accessExpiresAt',
        ),
        refreshExpiresAt: asString(
          tokens.refreshTokenExpiresAt ?? tokens.refreshExpiresAt ?? tokens.accessTokenExpiresAt,
          'refreshExpiresAt',
        ),
      })
    }
    return {kind: 'verifiedSignInRequired'}
  }

  resendVerification(email: string): Promise<{resent: boolean}> {
    return this.client.post(
      {path: '/v1/accounts/resend-verification', body: {email: email.trim().toLowerCase()}},
      value => {
        const row = asRecord(value, 'resend')
        return {resent: row.resent !== false}
      },
    )
  }

  async refresh(refreshToken: RefreshToken): Promise<AuthResult> {
    const tokens = await this.client.post(
      {path: '/v1/sessions/refresh', body: {refreshToken}},
      decodeSessionTokenResponse,
    )
    return this.hydrateSession(tokens)
  }

  async getSession(_accessToken: AccessToken): Promise<AuthenticatedSession> {
    try {
      const account = await this.client.get(
        {path: '/v1/accounts/me', authenticated: true},
        decodeGreenfieldAccount,
      )
      const profile = await this.fetchProfile(account)
      return buildAuthenticatedSession({
        sessionId: 'current',
        account,
        profile,
        accessTokenExpiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      })
    } catch {
      return this.client.get(
        {path: '/v1/auth/session', authenticated: true},
        decodeAuthenticatedSession,
      )
    }
  }

  getMe(): Promise<GreenfieldAccount & {email?: string}> {
    return this.client.get({path: '/v1/accounts/me', authenticated: true}, decodeGreenfieldAccount)
  }

  changeHandle(handle: string): Promise<{handle: string; accountId: string}> {
    return this.client.post(
      {path: '/v1/accounts/me/handle', body: {handle}, authenticated: true},
      value => {
        const row = asRecord(value, 'handle change')
        return {
          handle: asString(row.handle, 'handle'),
          accountId: asString(row.accountId, 'accountId'),
        }
      },
    )
  }

  checkHandleAvailability(handle: string): Promise<HandleAvailability> {
    return this.client.get(
      {path: `/v1/accounts/handles/${encodeURIComponent(handle)}/availability`},
      value => {
        const row = asRecord(value, 'handle availability')
        return {
          handle: asString(row.handle, 'handle'),
          available: Boolean(row.available),
          reason: typeof row.reason === 'string' ? row.reason : undefined,
        }
      },
    )
  }

  listSessions(): Promise<GreenfieldSession[]> {
    return this.client.get(
      {path: '/v1/accounts/me/sessions', authenticated: true},
      decodeSessions,
    )
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.client.delete(
      {path: `/v1/sessions/${encodeURIComponent(sessionId)}`, authenticated: true},
      () => undefined,
    )
  }

  async revokeOtherSessions(): Promise<void> {
    await this.client.delete(
      {path: '/v1/accounts/me/sessions', authenticated: true},
      () => undefined,
    )
  }

  async changePassword(input: ChangePasswordInput): Promise<void> {
    await this.client.post(
      {path: '/v1/accounts/me/password', body: input, authenticated: true},
      () => undefined,
    )
  }

  forgotPassword(input: ForgotPasswordInput): Promise<{accepted: boolean}> {
    return this.client.post({path: '/v1/accounts/forgot-password', body: input}, value => {
      const row = asRecord(value ?? {accepted: true}, 'forgot password')
      return {accepted: row.accepted !== false}
    })
  }

  resetPassword(input: ResetPasswordInput): Promise<{reset: boolean}> {
    return this.client.post({path: '/v1/accounts/reset-password', body: input}, value => {
      const row = asRecord(value ?? {reset: true}, 'reset password')
      return {reset: row.reset !== false}
    })
  }

  createRepositoryExport(): Promise<RepositoryExportJob> {
    return this.client.post(
      {path: '/v1/repositories/me/exports', authenticated: true},
      decodeExportJob,
    )
  }

  getRepositoryExport(exportId: string): Promise<RepositoryExportJob> {
    return this.client.get(
      {
        path: `/v1/repositories/me/exports/${encodeURIComponent(exportId)}`,
        authenticated: true,
      },
      decodeExportJob,
    )
  }

  async signOut(_refreshToken: RefreshToken | null): Promise<void> {
    await this.client
      .delete({path: '/v1/sessions/current', authenticated: true}, () => undefined)
      .catch(() => undefined)
  }

  private async hydrateSession(tokens: {
    accessToken: string
    refreshToken: string
    sessionId: string
    accessExpiresAt: string
    refreshExpiresAt: string
  }): Promise<AuthResult> {
    this.accessTokenStore.set(parseAccessToken(tokens.accessToken))
    const account = await this.client.get(
      {path: '/v1/accounts/me', authenticated: true},
      decodeGreenfieldAccount,
    )
    if (account.status === 'suspended') {
      this.accessTokenStore.clear()
      throw Object.assign(new Error('This Modula Account is suspended.'), {code: 'suspended'})
    }
    if (account.status === 'pendingVerification') {
      this.accessTokenStore.clear()
      throw Object.assign(new Error('Verify your email before signing in.'), {
        code: 'pendingVerification',
        email: account.email,
      })
    }
    const profile = await this.fetchProfile(account)
    return {
      session: buildAuthenticatedSession({
        sessionId: tokens.sessionId,
        account,
        profile,
        accessTokenExpiresAt: tokens.accessExpiresAt,
      }),
      tokens: {
        accessToken: parseAccessToken(tokens.accessToken),
        refreshToken: parseRefreshToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessExpiresAt,
      },
    }
  }

  private async fetchProfile(account: GreenfieldAccount & {email?: string}) {
    try {
      return await this.client.get(
        {path: `/v1/profiles/${encodeURIComponent(account.primaryHandle)}`},
        decodeProfile,
      )
    } catch {
      return profileFromGreenfieldAccount(account)
    }
  }
}
