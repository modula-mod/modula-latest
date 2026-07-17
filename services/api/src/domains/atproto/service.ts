import {randomBytes, randomUUID} from 'node:crypto'
import type {
  AtmosphereFeedItemDto,
  AtmosphereFeedMode,
  AtprotoConnectionDto,
  AtprotoPublicationPreference,
} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {AppConfig} from '../../config/index.js'
import {encryptSessionMaterial} from '../../security/crypto.js'
import {assertSafeHttpsUrl} from '../../security/ssrf.js'
import {AuditRepository} from '../audit/repository.js'

const INTERNAL_RETURN_ROUTE = /^\/[A-Za-z0-9/_-]*$/

export class AtprotoService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async listConnections(actorId: string): Promise<AtprotoConnectionDto[]> {
    const rows = await this.db
      .selectFrom('atproto_connections')
      .selectAll()
      .where('actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute()
    return rows.map(mapConnection)
  }

  async getConnection(actorId: string, connectionId: string): Promise<AtprotoConnectionDto | null> {
    const row = await this.db
      .selectFrom('atproto_connections')
      .selectAll()
      .where('id', '=', connectionId)
      .where('actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row ? mapConnection(row) : null
  }

  async startOAuth(input: {
    actorId: string
    sessionId: string
    clientKind: 'web' | 'native'
    returnRoute: string
    requestScope: 'atproto' | 'publish'
    handle?: string
  }): Promise<{authorizationUrl: string; state: string}> {
    if (!INTERNAL_RETURN_ROUTE.test(input.returnRoute) || input.returnRoute.includes('//')) {
      throw Object.assign(new Error('Invalid return route'), {code: 'VALIDATION_FAILED'})
    }
    const state = randomBytes(24).toString('base64url')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000)
    await this.db
      .insertInto('atproto_oauth_states')
      .values({
        id: randomUUID(),
        state,
        actor_id: input.actorId,
        session_id: input.sessionId,
        client_kind: input.clientKind,
        return_route: input.returnRoute,
        request_scope: input.requestScope,
        created_at: now,
        expires_at: expiresAt,
        consumed_at: null,
        updated_at: now,
      })
      .execute()
    await new AuditRepository(this.db).append(
      'atproto.oauth.start',
      {clientKind: input.clientKind, requestScope: input.requestScope},
      {type: 'session', id: input.sessionId, actorId: input.actorId},
    )
    // Official client wiring uses @atproto/oauth-client-node in production.
    // Preview returns a deterministic authorize URL bound to state for integration tests.
    const authorizationUrl = new URL('/oauth/atproto/authorize-preview', this.config.publicApiUrl)
    authorizationUrl.searchParams.set('state', state)
    if (input.handle) authorizationUrl.searchParams.set('handle', input.handle)
    authorizationUrl.searchParams.set('scope', input.requestScope)
    return {authorizationUrl: authorizationUrl.toString(), state}
  }

  async consumeOAuthState(input: {
    state: string
    actorId: string
    sessionId: string
  }): Promise<{returnRoute: string; requestScope: string; clientKind: string}> {
    const row = await this.db
      .selectFrom('atproto_oauth_states')
      .selectAll()
      .where('state', '=', input.state)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Invalid OAuth state'), {code: 'VALIDATION_FAILED'})
    if (row.consumed_at) throw Object.assign(new Error('OAuth state already used'), {code: 'FORBIDDEN'})
    if (row.expires_at.getTime() <= Date.now()) {
      throw Object.assign(new Error('OAuth state expired'), {code: 'FORBIDDEN'})
    }
    if (row.actor_id !== input.actorId || row.session_id !== input.sessionId) {
      throw Object.assign(new Error('OAuth state binding mismatch'), {code: 'FORBIDDEN'})
    }
    await this.db
      .updateTable('atproto_oauth_states')
      .set({consumed_at: new Date(), updated_at: new Date()})
      .where('id', '=', row.id)
      .where('consumed_at', 'is', null)
      .execute()
    return {
      returnRoute: row.return_route,
      requestScope: row.request_scope,
      clientKind: row.client_kind,
    }
  }

  async completePreviewOAuth(input: {
    actorId: string
    sessionId: string
    state: string
    did: string
    handle: string
    pdsUrl: string
  }): Promise<AtprotoConnectionDto> {
    await assertSafeHttpsUrl(input.pdsUrl)
    const consumed = await this.consumeOAuthState({
      state: input.state,
      actorId: input.actorId,
      sessionId: input.sessionId,
    })
    const scopes =
      consumed.requestScope === 'publish'
        ? ['atproto', 'repo:app.bsky.feed.post', 'repo:app.bsky.graph.follow']
        : ['atproto']
    const now = new Date()
    // Reuse an existing row for the same DID (unique constraint) after disconnect/revoke.
    const existing = await this.db
      .selectFrom('atproto_connections')
      .select(['id', 'actor_id'])
      .where('did', '=', input.did)
      .executeTakeFirst()
    if (existing && existing.actor_id !== input.actorId) {
      throw Object.assign(new Error('AT Protocol identity already linked to another actor'), {
        code: 'CONFLICT',
      })
    }
    const connectionId = existing?.id ?? randomUUID()
    await this.db.transaction().execute(async trx => {
      if (existing) {
        await trx
          .updateTable('atproto_connections')
          .set({
            actor_id: input.actorId,
            handle: input.handle,
            pds_url: input.pdsUrl,
            status: 'connected',
            granted_scopes: scopes,
            connected_at: now,
            refreshed_at: now,
            disconnected_at: null,
            last_error_code: null,
            updated_at: now,
            deleted_at: null,
          })
          .where('id', '=', connectionId)
          .execute()
        await trx
          .updateTable('atproto_oauth_sessions')
          .set({revoked_at: now, updated_at: now})
          .where('connection_id', '=', connectionId)
          .where('revoked_at', 'is', null)
          .execute()
      } else {
        await trx
          .insertInto('atproto_connections')
          .values({
            id: connectionId,
            actor_id: input.actorId,
            did: input.did,
            handle: input.handle,
            pds_url: input.pdsUrl,
            status: 'connected',
            granted_scopes: scopes,
            connected_at: now,
            refreshed_at: now,
            disconnected_at: null,
            last_error_code: null,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version: 1,
          })
          .execute()
      }
      const encrypted = encryptSessionMaterial(
        this.config,
        Buffer.from(JSON.stringify({did: input.did, placeholder: true})),
      )
      await trx
        .insertInto('atproto_oauth_sessions')
        .values({
          id: randomUUID(),
          connection_id: connectionId,
          encrypted_session: encrypted.ciphertext,
          encryption_key_version: encrypted.keyVersion,
          created_at: now,
          updated_at: now,
          revoked_at: null,
        })
        .execute()
      await trx
        .insertInto('atproto_publication_preferences')
        .values({
          id: randomUUID(),
          actor_id: input.actorId,
          enabled: false,
          default_mode: 'modulaOnly',
          publish_profile_extension: false,
          publish_module_metadata: false,
          created_at: now,
          updated_at: now,
          version: 1,
        })
        .onConflict(oc => oc.column('actor_id').doNothing())
        .execute()
    })
    const connection = await this.getConnection(input.actorId, connectionId)
    if (!connection) throw new Error('Failed to load connection')
    return connection
  }

  /** Admin emergency control — force-disconnects a connection regardless of owning actor. */
  async adminRevokeConnection(connectionId: string, adminActorId: string): Promise<void> {
    const row = await this.db.selectFrom('atproto_connections').selectAll().where('id', '=', connectionId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw Object.assign(new Error('Connection not found'), {code: 'NOT_FOUND'})
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('atproto_connections')
        .set({status: 'revoked', disconnected_at: now, updated_at: now})
        .where('id', '=', connectionId)
        .execute()
      await trx.updateTable('atproto_oauth_sessions').set({revoked_at: now, updated_at: now}).where('connection_id', '=', connectionId).execute()
      await new AuditRepository(trx).append('admin.atproto.connection.revoked', {connectionId}, {type: 'connection', id: connectionId, actorId: adminActorId})
    })
  }

  async disconnect(actorId: string, connectionId: string): Promise<void> {
    const row = await this.getConnection(actorId, connectionId)
    if (!row) throw Object.assign(new Error('Connection not found'), {code: 'NOT_FOUND'})
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('atproto_connections')
        .set({status: 'disconnected', disconnected_at: now, updated_at: now})
        .where('id', '=', connectionId)
        .where('actor_id', '=', actorId)
        .execute()
      await trx
        .updateTable('atproto_oauth_sessions')
        .set({revoked_at: now, updated_at: now})
        .where('connection_id', '=', connectionId)
        .execute()
    })
  }

  async getPreferences(actorId: string): Promise<AtprotoPublicationPreference> {
    const row = await this.db
      .selectFrom('atproto_publication_preferences')
      .selectAll()
      .where('actor_id', '=', actorId)
      .executeTakeFirst()
    if (!row) {
      return {
        enabled: false,
        defaultMode: 'modulaOnly',
        publishProfileExtension: false,
        publishModuleMetadata: false,
      }
    }
    return {
      enabled: row.enabled,
      defaultMode: row.default_mode as AtprotoPublicationPreference['defaultMode'],
      publishProfileExtension: row.publish_profile_extension,
      publishModuleMetadata: row.publish_module_metadata,
    }
  }

  async updatePreferences(actorId: string, prefs: Partial<AtprotoPublicationPreference>) {
    const current = await this.getPreferences(actorId)
    const next = {...current, ...prefs}
    const now = new Date()
    await this.db
      .insertInto('atproto_publication_preferences')
      .values({
        id: randomUUID(),
        actor_id: actorId,
        enabled: next.enabled,
        default_mode: next.defaultMode,
        publish_profile_extension: next.publishProfileExtension,
        publish_module_metadata: next.publishModuleMetadata,
        created_at: now,
        updated_at: now,
        version: 1,
      })
      .onConflict(oc =>
        oc.column('actor_id').doUpdateSet({
          enabled: next.enabled,
          default_mode: next.defaultMode,
          publish_profile_extension: next.publishProfileExtension,
          publish_module_metadata: next.publishModuleMetadata,
          updated_at: now,
        }),
      )
      .execute()
    return next
  }

  async atmosphereFeed(mode: AtmosphereFeedMode, limit: number): Promise<AtmosphereFeedItemDto[]> {
    let query = this.db
      .selectFrom('atproto_records')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('collection', 'in', [
        'app.bsky.feed.post',
        'digital.modula.temp.publication',
        'digital.modula.temp.profileExtension',
      ])
      .orderBy('indexed_at', 'desc')
      .limit(limit)
    if (mode === 'modula-network') {
      query = query.where('collection', 'like', 'digital.modula.temp.%')
    }
    const rows = await query.execute()
    return rows.map(row => {
      const record = row.record_json as {text?: string; createdAt?: string}
      return {
        id: `${row.did}:${row.collection}:${row.rkey}`,
        origin: row.collection.startsWith('digital.modula.temp') ? 'modula+atproto' : 'atproto',
        did: row.did,
        text: record.text,
        createdAt: record.createdAt ?? row.indexed_at.toISOString(),
        collection: row.collection,
        uri: row.uri,
      }
    })
  }

  webClientMetadata() {
    return {
      client_id: `${this.config.publicApiUrl}/oauth/atproto/web-client-metadata.json`,
      client_name: 'Modula Web',
      client_uri: 'https://modula.digital',
      redirect_uris: [`${this.config.publicApiUrl}/v1/atproto/oauth/callback`],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'web',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
      scope: 'atproto',
    }
  }

  nativeClientMetadata() {
    return {
      client_id: 'https://modula.digital/oauth/atproto/native-client-metadata.json',
      client_name: 'Modula Native',
      client_uri: 'https://modula.digital',
      redirect_uris: ['modula://oauth/atproto'],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      application_type: 'native',
      token_endpoint_auth_method: 'none',
      dpop_bound_access_tokens: true,
      scope: 'atproto',
    }
  }
}

function mapConnection(row: any): AtprotoConnectionDto {
  return {
    id: row.id,
    did: row.did,
    handle: row.handle,
    pdsUrl: row.pds_url,
    status: row.status,
    grantedScopes: row.granted_scopes ?? [],
    connectedAt: row.connected_at?.toISOString() ?? null,
    refreshedAt: row.refreshed_at?.toISOString() ?? null,
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at?.toISOString?.() ?? new Date().toISOString(),
  }
}
