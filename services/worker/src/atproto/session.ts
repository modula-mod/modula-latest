import type {ModulaWorkerDb} from '../database.js'
import type {WorkerConfig} from '../config.js'
import {PermanentJobError, TransientJobError} from '../jobs/errors.js'
import {createAtpAgentPublisherClient, type PdsPublisherClient, type StoredPdsSession} from './pds-client.js'
import {decryptJsonSessionMaterial, OAuthSessionUnavailableError} from './session-crypto.js'
import {assertSafePdsUrl} from './ssrf-guard.js'

export type ResolvedConnection = {
  id: string
  actorId: string
  did: string
  handle: string
  pdsUrl: string
  grantedScopes: string[]
}

/**
 * Global kill switches (see migration 002 `operational_controls` seed rows).
 * Checked before any outbound AT Protocol call so on-call can pause
 * publishing/ingestion without a deploy.
 */
export async function isCapabilityEnabled(db: ModulaWorkerDb, key: string, defaultValue = true): Promise<boolean> {
  const row = await db.selectFrom('operational_controls').select('value').where('key', '=', key).executeTakeFirst()
  if (!row) return defaultValue
  return row.value !== false
}

export async function loadConnectedConnection(db: ModulaWorkerDb, connectionId: string): Promise<ResolvedConnection> {
  const row = await db
    .selectFrom('atproto_connections')
    .selectAll()
    .where('id', '=', connectionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!row) {
    throw new PermanentJobError('CONNECTION_REVOKED', `AT Protocol connection ${connectionId} not found`)
  }
  if (row.status === 'revoked' || row.status === 'disconnected') {
    throw new PermanentJobError('CONNECTION_REVOKED', `AT Protocol connection ${connectionId} is ${row.status}`)
  }
  if (row.status !== 'connected') {
    throw new TransientJobError('CONNECTION_NOT_READY', `AT Protocol connection ${connectionId} is ${row.status}`)
  }
  return {
    id: row.id,
    actorId: row.actor_id,
    did: row.did,
    handle: row.handle,
    pdsUrl: row.pds_url,
    grantedScopes: row.granted_scopes,
  }
}

export function requireScope(connection: ResolvedConnection, requiredScopeSubstring: string): void {
  const hasScope = connection.grantedScopes.some(scope => scope.includes(requiredScopeSubstring) || scope === 'atproto')
  if (!hasScope && requiredScopeSubstring !== 'atproto') {
    // "atproto" alone is identity-only; anything that writes needs a publish-oriented grant.
    const canWrite = connection.grantedScopes.some(scope => scope.includes('repo:') || scope.includes('transition:generic'))
    if (!canWrite) {
      throw new PermanentJobError(
        'INSUFFICIENT_OAUTH_SCOPE',
        `Connection ${connection.id} lacks a publish-capable scope grant`,
      )
    }
  }
}

export async function resolvePublisherClient(
  db: ModulaWorkerDb,
  config: WorkerConfig,
  connection: ResolvedConnection,
): Promise<PdsPublisherClient> {
  const sessionRow = await db
    .selectFrom('atproto_oauth_sessions')
    .selectAll()
    .where('connection_id', '=', connection.id)
    .where('revoked_at', 'is', null)
    .executeTakeFirst()
  if (!sessionRow) {
    throw new PermanentJobError('CONNECTION_REVOKED', `No active OAuth session stored for connection ${connection.id}`)
  }

  let session: StoredPdsSession
  try {
    session = decryptJsonSessionMaterial<StoredPdsSession>(
      config.encryptionKeysByVersion,
      sessionRow.encrypted_session,
      sessionRow.encryption_key_version,
    )
  } catch (error) {
    if (error instanceof OAuthSessionUnavailableError) {
      // Treated as permanent for this attempt: without a decryptable session there is
      // nothing to retry until an operator rotates keys / the user reconnects.
      throw new PermanentJobError('INSUFFICIENT_OAUTH_SCOPE', error.message)
    }
    throw error
  }

  await assertSafePdsUrl(connection.pdsUrl, {allowPrivateNetworks: config.ssrfAllowPrivateNetworks})

  return createAtpAgentPublisherClient(connection.pdsUrl, session, {
    allowPrivateNetworks: config.ssrfAllowPrivateNetworks,
  })
}

export function parseAtUri(atUri: string): {did: string; collection: string; rkey: string} | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(atUri)
  if (!match) return null
  const [, did, collection, rkey] = match
  if (!did || !collection || !rkey) return null
  return {did, collection, rkey}
}
