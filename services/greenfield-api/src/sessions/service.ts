import {createHash, randomBytes} from 'node:crypto'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'

export type IssuedSessionTokens = {
  accessToken: string
  refreshToken: string
  sessionId: string
  accessExpiresAt: Date
  refreshExpiresAt: Date
}

/**
 * Opaque access + refresh tokens. Only SHA-256 hashes (optionally peppered) are stored.
 * Refresh tokens are single-use; reuse revokes the entire token family.
 */
export class GreenfieldSessionService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(`${this.config.sessionPepper ?? ''}:${token}`).digest('hex')
  }

  async issue(accountId: string, context: {userAgent?: string; ipHash?: string} = {}): Promise<IssuedSessionTokens> {
    const accessToken = randomBytes(32).toString('base64url')
    const refreshToken = randomBytes(48).toString('base64url')
    const now = new Date()
    const sessionId = uuidv7()
    const familyId = uuidv7()
    const accessExpiresAt = new Date(now.getTime() + this.config.accessTokenTtlMinutes * 60_000)
    const refreshExpiresAt = new Date(now.getTime() + this.config.refreshTokenTtlDays * 86_400_000)

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_sessions')
        .values({
          session_id: sessionId,
          account_id: accountId,
          status: 'active',
          family_id: familyId,
          created_at: now,
          expires_at: refreshExpiresAt,
          revoked_at: null,
          last_seen_at: now,
          user_agent: context.userAgent ?? null,
          ip_hash: context.ipHash ?? null,
        })
        .execute()
      await trx
        .insertInto('greenfield_session_tokens')
        .values([
          {
            token_id: uuidv7(),
            session_id: sessionId,
            kind: 'access',
            token_hash: this.hash(accessToken),
            family_id: familyId,
            expires_at: accessExpiresAt,
            rotated_at: null,
            reused_at: null,
            revoked_at: null,
            created_at: now,
          },
          {
            token_id: uuidv7(),
            session_id: sessionId,
            kind: 'refresh',
            token_hash: this.hash(refreshToken),
            family_id: familyId,
            expires_at: refreshExpiresAt,
            rotated_at: null,
            reused_at: null,
            revoked_at: null,
            created_at: now,
          },
        ])
        .execute()
      await this.insertEvent(trx, sessionId, accountId, 'session.created')
    })

    return {accessToken, refreshToken, sessionId, accessExpiresAt, refreshExpiresAt}
  }

  async refresh(refreshToken: string): Promise<IssuedSessionTokens> {
    const now = new Date()
    const token = await this.db
      .selectFrom('greenfield_session_tokens')
      .selectAll()
      .where('token_hash', '=', this.hash(refreshToken))
      .where('kind', '=', 'refresh')
      .executeTakeFirst()

    if (!token) {
      throw Object.assign(new Error('Invalid refresh token'), {code: 'UNAUTHENTICATED'})
    }

    const session = await this.db
      .selectFrom('greenfield_sessions')
      .selectAll()
      .where('session_id', '=', token.session_id)
      .executeTakeFirstOrThrow()

    const reuse =
      Boolean(token.rotated_at) ||
      Boolean(token.reused_at) ||
      Boolean(token.revoked_at) ||
      session.status !== 'active' ||
      token.expires_at <= now

    if (reuse) {
      await this.db
        .updateTable('greenfield_session_tokens')
        .set({reused_at: now})
        .where('token_id', '=', token.token_id)
        .execute()
      await this.revokeFamily(token.family_id, token.session_id, session.account_id, 'session.refreshReuseDetected')
      throw Object.assign(new Error('Refresh token reuse detected'), {code: 'UNAUTHENTICATED'})
    }

    const accessToken = randomBytes(32).toString('base64url')
    const newRefreshToken = randomBytes(48).toString('base64url')
    const accessExpiresAt = new Date(now.getTime() + this.config.accessTokenTtlMinutes * 60_000)
    const refreshExpiresAt = new Date(now.getTime() + this.config.refreshTokenTtlDays * 86_400_000)

    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_session_tokens')
        .set({rotated_at: now, revoked_at: now})
        .where('token_id', '=', token.token_id)
        .execute()
      // Revoke prior access tokens for this session.
      await trx
        .updateTable('greenfield_session_tokens')
        .set({revoked_at: now})
        .where('session_id', '=', token.session_id)
        .where('kind', '=', 'access')
        .where('revoked_at', 'is', null)
        .execute()
      await trx
        .insertInto('greenfield_session_tokens')
        .values([
          {
            token_id: uuidv7(),
            session_id: token.session_id,
            kind: 'access',
            token_hash: this.hash(accessToken),
            family_id: token.family_id,
            expires_at: accessExpiresAt,
            rotated_at: null,
            reused_at: null,
            revoked_at: null,
            created_at: now,
          },
          {
            token_id: uuidv7(),
            session_id: token.session_id,
            kind: 'refresh',
            token_hash: this.hash(newRefreshToken),
            family_id: token.family_id,
            expires_at: refreshExpiresAt,
            rotated_at: null,
            reused_at: null,
            revoked_at: null,
            created_at: now,
          },
        ])
        .execute()
      await trx
        .updateTable('greenfield_sessions')
        .set({last_seen_at: now, expires_at: refreshExpiresAt})
        .where('session_id', '=', token.session_id)
        .execute()
      await this.insertEvent(trx, token.session_id, session.account_id, 'session.refreshed')
    })

    return {
      accessToken,
      refreshToken: newRefreshToken,
      sessionId: token.session_id,
      accessExpiresAt,
      refreshExpiresAt,
    }
  }

  async resolveAccess(accessToken: string): Promise<{accountId: string; sessionId: string} | null> {
    if (!accessToken || accessToken.length < 16 || accessToken.length > 512) return null
    const token = await this.db
      .selectFrom('greenfield_session_tokens')
      .innerJoin('greenfield_sessions', 'greenfield_sessions.session_id', 'greenfield_session_tokens.session_id')
      .select([
        'greenfield_sessions.account_id',
        'greenfield_sessions.session_id',
        'greenfield_sessions.status',
        'greenfield_session_tokens.expires_at',
        'greenfield_session_tokens.revoked_at',
      ])
      .where('greenfield_session_tokens.token_hash', '=', this.hash(accessToken))
      .where('greenfield_session_tokens.kind', '=', 'access')
      .executeTakeFirst()

    if (!token || token.status !== 'active' || token.revoked_at || token.expires_at <= new Date()) return null
    await this.db
      .updateTable('greenfield_sessions')
      .set({last_seen_at: new Date()})
      .where('session_id', '=', token.session_id)
      .execute()
    return {accountId: token.account_id, sessionId: token.session_id}
  }

  async listSessions(accountId: string) {
    return this.db
      .selectFrom('greenfield_sessions')
      .select(['session_id', 'status', 'created_at', 'expires_at', 'last_seen_at', 'revoked_at', 'user_agent'])
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute()
  }

  async revokeSession(sessionId: string, accountId?: string): Promise<void> {
    const row = await this.db
      .selectFrom('greenfield_sessions')
      .selectAll()
      .where('session_id', '=', sessionId)
      .$if(Boolean(accountId), qb => qb.where('account_id', '=', accountId!))
      .executeTakeFirst()
    if (row) await this.revokeFamily(row.family_id, sessionId, row.account_id, 'session.revoked')
  }

  async revokeAllForAccount(accountId: string): Promise<void> {
    const rows = await this.db
      .selectFrom('greenfield_sessions')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('status', '=', 'active')
      .execute()
    for (const row of rows) {
      await this.revokeFamily(row.family_id, row.session_id, accountId, 'session.revoked')
    }
  }

  private async revokeFamily(familyId: string, sessionId: string, accountId: string, eventType: string): Promise<void> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_session_tokens').set({revoked_at: now}).where('family_id', '=', familyId).execute()
      await trx
        .updateTable('greenfield_sessions')
        .set({status: 'revoked', revoked_at: now})
        .where('family_id', '=', familyId)
        .execute()
      await this.insertEvent(trx, sessionId, accountId, eventType)
    })
  }

  private insertEvent(db: any, sessionId: string, accountId: string, eventType: string) {
    return db
      .insertInto('greenfield_session_events')
      .values({
        event_id: uuidv7(),
        session_id: sessionId,
        account_id: accountId,
        event_type: eventType,
        metadata: {},
        created_at: new Date(),
      })
      .execute()
  }
}
