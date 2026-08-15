import {createHash, randomBytes, randomUUID} from 'node:crypto'
import type {BackendCapability, ModulaSession} from '@modula/api-contracts'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'

export type ResolvedSession = {
  sessionId: string
  accountId: string
  actorId: string
  capabilities: BackendCapability[]
  expiresAt: Date
}

export type CreatedSession = {
  /** Raw bearer token — returned to the caller exactly once, never persisted or logged. */
  token: string
  session: ModulaSession
}

function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Sessions are opaque bearer tokens. Only a sha256 hash of the token is ever
 * persisted or compared — the raw token is never written to a log, audit
 * event, or error message anywhere in this module.
 */
export class SessionService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async createSession(actorId: string, capabilities: BackendCapability[]): Promise<CreatedSession> {
    const token = randomBytes(32).toString('base64url')
    const tokenHash = hashToken(token)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + this.config.sessionTtlHours * 3_600_000)
    const sessionId = `session-${randomUUID()}`

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('sessions')
        .values({
          id: sessionId,
          actor_id: actorId,
          status: 'active',
          token_hash: tokenHash,
          created_at: now,
          expires_at: expiresAt,
          last_seen_at: now,
          revoked_at: null,
          updated_at: now,
          version: 1,
        })
        .execute()

      const uniqueCapabilities = Array.from(new Set(capabilities))
      if (uniqueCapabilities.length > 0) {
        await trx
          .insertInto('session_capabilities')
          .values(
            uniqueCapabilities.map(capability => ({
              id: `session-cap-${randomUUID()}`,
              session_id: sessionId,
              capability,
              granted_at: now,
              revoked_at: null,
              created_at: now,
              updated_at: now,
            })),
          )
          .execute()
      }
    })

    return {
      token,
      session: {
        id: sessionId,
        actorId,
        status: 'active',
        createdAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        lastSeenAt: now.toISOString(),
        revokedAt: null,
        capabilities,
      },
    }
  }

  /**
   * Resolves a bearer token to its session + capabilities. Returns null for
   * any invalid, expired, or revoked session — callers must treat a null
   * result as "not authenticated" without distinguishing further (this
   * avoids leaking session existence via timing/response differences).
   */
  async resolveSession(bearerToken: string): Promise<ResolvedSession | null> {
    if (!bearerToken || bearerToken.length < 16 || bearerToken.length > 512) return null
    const tokenHash = hashToken(bearerToken)
    const row = await this.db.selectFrom('sessions').selectAll().where('token_hash', '=', tokenHash).executeTakeFirst()
    if (!row) return null
    const now = new Date()
    if (row.status !== 'active') return null
    if (row.expires_at.getTime() <= now.getTime()) {
      await this.db
        .updateTable('sessions')
        .set({status: 'expired', updated_at: now})
        .where('id', '=', row.id)
        .where('status', '=', 'active')
        .execute()
      return null
    }
    const actor = await this.db
      .selectFrom('actors')
      .select('account_id')
      .where('id', '=', row.actor_id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!actor?.account_id) return null

    const capabilityRows = await this.db
      .selectFrom('session_capabilities')
      .select('capability')
      .where('session_id', '=', row.id)
      .where('revoked_at', 'is', null)
      .execute()

    await this.db.updateTable('sessions').set({last_seen_at: now}).where('id', '=', row.id).execute()

    return {
      sessionId: row.id,
      accountId: actor.account_id,
      actorId: row.actor_id,
      capabilities: capabilityRows.map(r => r.capability as BackendCapability),
      expiresAt: row.expires_at,
    }
  }

  /** Full session projection for GET /v1/sessions/me — resolves fresh capabilities from the DB. */
  async describeSession(sessionId: string): Promise<ModulaSession | null> {
    const row = await this.db.selectFrom('sessions').selectAll().where('id', '=', sessionId).executeTakeFirst()
    if (!row) return null
    const capabilityRows = await this.db
      .selectFrom('session_capabilities')
      .select('capability')
      .where('session_id', '=', row.id)
      .where('revoked_at', 'is', null)
      .execute()
    return {
      id: row.id,
      actorId: row.actor_id,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      lastSeenAt: row.last_seen_at.toISOString(),
      revokedAt: row.revoked_at?.toISOString() ?? null,
      capabilities: capabilityRows.map(r => r.capability as BackendCapability),
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    const now = new Date()
    await this.db
      .updateTable('sessions')
      .set({status: 'revoked', revoked_at: now, updated_at: now})
      .where('id', '=', sessionId)
      .where('status', '=', 'active')
      .execute()
  }

  async revokeAllForActor(actorId: string): Promise<void> {
    const now = new Date()
    await this.db
      .updateTable('sessions')
      .set({status: 'revoked', revoked_at: now, updated_at: now})
      .where('actor_id', '=', actorId)
      .where('status', '=', 'active')
      .execute()
  }
}
