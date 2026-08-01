import {createHash, randomBytes} from 'node:crypto'
import type {Kysely, Transaction} from 'kysely'
import type {GreenfieldConnectorDefinition} from '@modula/greenfield-connector-contracts'
import type {AppConfig} from '../../../config/index.js'
import type {ModulaDb} from '../../../database/client.js'
import type {Database, GreenfieldConnectorOAuthStateStatus} from '../../../database/types.js'
import {AuditRepository} from '../../audit/repository.js'
import {uuidv7} from '../../../lib/uuidv7.js'
import {
  ConnectorCredentialEncryptionService,
  type ConnectorCredentialEnvelope,
} from '../../../security/encryption/connector-credentials.js'
import {GreenfieldConnectorProviderRegistry} from '../../../connectors/provider-registry.js'
import {connectorError} from '../errors.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
type OAuthStateRow = Database['greenfield_connector_oauth_states']

const OAUTH_STATE_TTL_MS = 10 * 60_000

const OAUTH_STATE_TRANSITIONS: Record<GreenfieldConnectorOAuthStateStatus, readonly GreenfieldConnectorOAuthStateStatus[]> = {
  created: ['authorising', 'expired', 'cancelled', 'failed'],
  authorising: ['consumed', 'expired', 'cancelled', 'failed'],
  consumed: [],
  expired: [],
  cancelled: [],
  failed: [],
}

export type ConnectorOAuthInitiation = {
  stateId: string
  accountId: string
  providerId: string
  state: string
  status: 'authorising'
  redirectUri: string
  pkceChallenge: string | null
  pkceChallengeMethod: 'S256' | null
  expiresAt: string
}

export type ConsumedConnectorOAuthState = {
  stateId: string
  accountId: string
  providerId: string
  redirectUri: string
  pkceVerifier: string | null
}

export class ConnectorOAuthStateService {
  private readonly encryption: ConnectorCredentialEncryptionService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly providers: GreenfieldConnectorProviderRegistry,
  ) {
    this.encryption = new ConnectorCredentialEncryptionService(config)
  }

  async initiate(input: {
    accountId: string
    providerId: string
    redirectUri?: string
    idempotencyKey?: string
  }): Promise<ConnectorOAuthInitiation> {
    const definition = this.requireOAuthProvider(input.providerId)
    const redirectUri = this.resolveAllowedRedirectUri(definition, input.redirectUri)
    const rawState = randomBytes(32).toString('base64url')
    const stateHash = hashState(rawState)
    const stateId = uuidv7()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + OAUTH_STATE_TTL_MS)
    const pkce = definition.authorisation.supportsPkce
      ? createPkce()
      : {verifier: null, challenge: null, method: null as 'S256' | null}
    const pkceEnvelope = pkce.verifier
      ? this.encryption.encryptString(
          {
            accountId: input.accountId,
            providerId: input.providerId,
            connectionId: stateId,
            purpose: 'oauth-pkce-verifier',
          },
          pkce.verifier,
        )
      : null

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_connector_oauth_states')
        .values({
          state_id: stateId,
          account_id: input.accountId,
          provider_id: input.providerId,
          state_hash: stateHash,
          status: 'created',
          redirect_uri: redirectUri,
          pkce_challenge: pkce.challenge,
          pkce_challenge_method: pkce.method,
          pkce_verifier_key_version: pkceEnvelope?.keyVersion ?? null,
          pkce_verifier_nonce: pkceEnvelope?.nonce ?? null,
          pkce_verifier_auth_tag: pkceEnvelope?.authTag ?? null,
          pkce_verifier_ciphertext: pkceEnvelope?.ciphertext ?? null,
          idempotency_key: input.idempotencyKey ?? null,
          failure_code: null,
          failure_message: null,
          created_at: now,
          authorising_at: null,
          expires_at: expiresAt,
          consumed_at: null,
          cancelled_at: null,
          failed_at: null,
          replay_detected_at: null,
          consume_attempt_count: 0,
        })
        .execute()
      await this.recordAudit(trx, input.accountId, input.providerId, stateId, 'connector.oauth_state.created', {
        redirectUri,
        expiresAt: expiresAt.toISOString(),
      })
      await this.transition(trx, stateId, input.accountId, 'created', 'authorising', now)
    })

    return {
      stateId,
      accountId: input.accountId,
      providerId: input.providerId,
      state: rawState,
      status: 'authorising',
      redirectUri,
      pkceChallenge: pkce.challenge,
      pkceChallengeMethod: pkce.method,
      expiresAt: expiresAt.toISOString(),
    }
  }

  async consume(input: {
    state: string
    providerId: string
    redirectUri: string
    accountId?: string
  }): Promise<ConsumedConnectorOAuthState> {
    const now = new Date()
    const row = await this.db
      .selectFrom('greenfield_connector_oauth_states')
      .selectAll()
      .where('state_hash', '=', hashState(input.state))
      .executeTakeFirst()
    if (!row) throw sanitizedCallbackError()

    if (row.status === 'consumed') {
      await this.markReplay(row, now)
      throw connectorError('CONFLICT', 'OAuth state has already been consumed')
    }
    if (row.status === 'cancelled' || row.status === 'failed' || row.status === 'expired') {
      await this.markReplay(row, now)
      throw sanitizedCallbackError()
    }
    if (row.expires_at <= now) {
      await this.transition(this.db, row.state_id, row.account_id, row.status, 'expired', now, {
        failureCode: 'state_expired',
      })
      throw sanitizedCallbackError()
    }
    if (input.accountId && input.accountId !== row.account_id) {
      await this.fail(row, 'account_mismatch', now)
      throw sanitizedCallbackError()
    }
    if (input.providerId !== row.provider_id) {
      await this.fail(row, 'provider_mismatch', now)
      throw sanitizedCallbackError()
    }
    if (input.redirectUri !== row.redirect_uri) {
      await this.fail(row, 'redirect_mismatch', now)
      throw sanitizedCallbackError()
    }

    await this.transition(this.db, row.state_id, row.account_id, row.status, 'consumed', now)
    const pkceVerifier = this.decryptPkceVerifier(row)
    return {
      stateId: row.state_id,
      accountId: row.account_id,
      providerId: row.provider_id,
      redirectUri: row.redirect_uri,
      pkceVerifier,
    }
  }

  async cancel(accountId: string, stateId: string): Promise<void> {
    const row = await this.getForAccount(accountId, stateId)
    if (!row) throw connectorError('NOT_FOUND', 'OAuth state not found')
    await this.transition(this.db, stateId, accountId, row.status, 'cancelled', new Date())
  }

  async expireStale(now = new Date()): Promise<number> {
    const rows = await this.db
      .selectFrom('greenfield_connector_oauth_states')
      .select(['state_id', 'account_id', 'status'])
      .where('status', 'in', ['created', 'authorising'])
      .where('expires_at', '<=', now)
      .execute()
    for (const row of rows) {
      await this.transition(this.db, row.state_id, row.account_id, row.status, 'expired', now, {
        failureCode: 'state_expired',
      })
    }
    return rows.length
  }

  private requireOAuthProvider(providerId: string): GreenfieldConnectorDefinition {
    const definition = this.providers.get(providerId)
    if (!definition) throw connectorError('NOT_FOUND', 'Connector provider not found')
    if (definition.authorisation.method !== 'oauth2') {
      throw connectorError('VALIDATION_FAILED', 'Connector provider does not support OAuth authorisation')
    }
    return definition
  }

  private resolveAllowedRedirectUri(definition: GreenfieldConnectorDefinition, requested?: string): string {
    const callbackPath = definition.authorisation.callbackPath
    if (!callbackPath) throw connectorError('VALIDATION_FAILED', 'Connector provider callback is not configured')
    const allowed = new URL(callbackPath, this.config.publicApiUrl).toString()
    const redirect = requested ? new URL(requested, this.config.publicApiUrl).toString() : allowed
    if (redirect !== allowed) throw connectorError('VALIDATION_FAILED', 'Connector redirect URI is not allowed')
    return redirect
  }

  private async getForAccount(accountId: string, stateId: string): Promise<OAuthStateRow | undefined> {
    return this.db
      .selectFrom('greenfield_connector_oauth_states')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('state_id', '=', stateId)
      .executeTakeFirst()
  }

  private async fail(row: OAuthStateRow, failureCode: string, now: Date): Promise<void> {
    await this.transition(this.db, row.state_id, row.account_id, row.status, 'failed', now, {failureCode})
  }

  private async markReplay(row: OAuthStateRow, now: Date): Promise<void> {
    await this.db
      .updateTable('greenfield_connector_oauth_states')
      .set({
        consume_attempt_count: row.consume_attempt_count + 1,
        replay_detected_at: now,
      })
      .where('state_id', '=', row.state_id)
      .execute()
    await this.recordAudit(this.db, row.account_id, row.provider_id, row.state_id, 'connector.oauth_state.replay_rejected', {
      status: row.status,
    })
  }

  private async transition(
    db: Db,
    stateId: string,
    accountId: string,
    from: GreenfieldConnectorOAuthStateStatus,
    to: GreenfieldConnectorOAuthStateStatus,
    now: Date,
    options: {failureCode?: string} = {},
  ): Promise<void> {
    assertOAuthStateTransition(from, to)
    const updates: Partial<OAuthStateRow> = {
      status: to,
    }
    if (to === 'authorising') updates.authorising_at = now
    if (to === 'consumed') {
      updates.consumed_at = now
      updates.consume_attempt_count = 1
    }
    if (to === 'cancelled') updates.cancelled_at = now
    if (to === 'failed') {
      updates.failed_at = now
      updates.failure_code = options.failureCode ?? 'oauth_state_failed'
      updates.failure_message = 'OAuth callback rejected'
    }
    if (to === 'expired') {
      updates.failure_code = options.failureCode ?? 'state_expired'
      updates.failure_message = 'OAuth state expired'
    }
    const result = await db
      .updateTable('greenfield_connector_oauth_states')
      .set(updates)
      .where('state_id', '=', stateId)
      .where('account_id', '=', accountId)
      .where('status', '=', from)
      .executeTakeFirst()
    if (updatedRows(result) !== 1) throw connectorError('CONFLICT', 'OAuth state transition failed')
    const row = await db
      .selectFrom('greenfield_connector_oauth_states')
      .select(['provider_id'])
      .where('state_id', '=', stateId)
      .executeTakeFirstOrThrow()
    await this.recordAudit(db, accountId, row.provider_id, stateId, `connector.oauth_state.${to}`, {
      from,
      to,
      failureCode: options.failureCode ?? null,
    })
  }

  private decryptPkceVerifier(row: OAuthStateRow): string | null {
    if (!row.pkce_verifier_ciphertext) return null
    return this.encryption.decryptString(
      {
        accountId: row.account_id,
        providerId: row.provider_id,
        connectionId: row.state_id,
        purpose: 'oauth-pkce-verifier',
      },
      {
        algorithm: 'AES-256-GCM',
        keyVersion: row.pkce_verifier_key_version ?? '',
        nonce: requiredBuffer(row.pkce_verifier_nonce),
        authTag: requiredBuffer(row.pkce_verifier_auth_tag),
        ciphertext: row.pkce_verifier_ciphertext,
      } satisfies ConnectorCredentialEnvelope,
    )
  }

  private async recordAudit(
    db: Db,
    accountId: string,
    providerId: string,
    stateId: string,
    eventType: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await new AuditRepository(db).append(eventType, {providerId, ...metadata}, {
      type: 'connectorOAuthState',
      id: stateId,
      actorId: accountId,
    })
  }
}

export function sanitizeConnectorOAuthCallbackFailure(error: unknown): {code: string; message: string} {
  const code = typeof (error as any)?.code === 'string' ? (error as any).code : 'VALIDATION_FAILED'
  return {code, message: 'OAuth callback rejected'}
}

function createPkce(): {verifier: string; challenge: string; method: 'S256'} {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier, 'utf8').digest('base64url')
  return {verifier, challenge, method: 'S256'}
}

function hashState(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function assertOAuthStateTransition(
  from: GreenfieldConnectorOAuthStateStatus,
  to: GreenfieldConnectorOAuthStateStatus,
): void {
  if (!OAUTH_STATE_TRANSITIONS[from].includes(to)) {
    throw connectorError('CONFLICT', `Invalid connector OAuth state transition: ${from} -> ${to}`)
  }
}

function sanitizedCallbackError(): Error {
  return connectorError('VALIDATION_FAILED', 'OAuth callback rejected')
}

function requiredBuffer(value: Buffer | null): Buffer {
  if (!value) throw connectorError('SERVER_ERROR', 'OAuth PKCE envelope is incomplete')
  return value
}

function updatedRows(result: {numUpdatedRows?: bigint | number | string}): number {
  return Number(result.numUpdatedRows ?? 0)
}
