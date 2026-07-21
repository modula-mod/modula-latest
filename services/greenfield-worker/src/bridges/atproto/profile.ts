import {randomUUID} from 'node:crypto'
import {PROFILE_EXTENSION_NSID} from '@modula/atproto-lexicons'
import type {WorkerConfig} from '../../config.js'
import type {ModulaWorkerDb} from '../../database.js'
import {PermanentJobError} from '../../jobs/errors.js'
import {isCapabilityEnabled, isLexiconDisabled, loadConnectedConnection, requireScope, resolvePublisherClient} from './session.js'
import {validateOutgoingRecord} from './validate-record.js'

const PROFILE_SELF_RKEY = 'self'

export interface AtprotoProfilePublishPayload {
  connectionId?: string
  actorId?: string
  record: Record<string, unknown>
}

function parsePayload(payload: unknown): AtprotoProfilePublishPayload {
  if (!payload || typeof payload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.publish.profile payload must be an object')
  }
  const p = payload as Record<string, unknown>
  const record = p.record
  if (!record || typeof record !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.publish.profile payload requires record')
  }
  return {
    connectionId: typeof p.connectionId === 'string' ? p.connectionId : undefined,
    actorId: typeof p.actorId === 'string' ? p.actorId : undefined,
    record: record as Record<string, unknown>,
  }
}

async function resolveConnectionId(db: ModulaWorkerDb, payload: AtprotoProfilePublishPayload): Promise<string> {
  if (payload.connectionId) return payload.connectionId
  if (!payload.actorId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.publish.profile payload requires connectionId or actorId')
  }
  const row = await db
    .selectFrom('atproto_connections')
    .select('id')
    .where('actor_id', '=', payload.actorId)
    .where('status', '=', 'connected')
    .where('deleted_at', 'is', null)
    .orderBy('connected_at', 'desc')
    .executeTakeFirst()
  if (!row) {
    throw new PermanentJobError('CONNECTION_REVOKED', `No connected AT Protocol connection for actor ${payload.actorId}`)
  }
  return row.id
}

/**
 * Publishes (upserts, `key: literal:self`) Modula's experimental public
 * profile extension record. Gated separately from post publication by
 * `atproto_publication_preferences.publish_profile_extension` on the API
 * side — the worker trusts that the outbox event was only enqueued because
 * the actor opted in.
 */
export async function handleAtprotoProfilePublish(
  db: ModulaWorkerDb,
  config: WorkerConfig,
  rawPayload: unknown,
): Promise<void> {
  const payload = parsePayload(rawPayload)

  if (!(await isCapabilityEnabled(db, 'atproto.publish.enabled'))) return
  if (await isLexiconDisabled(db, PROFILE_EXTENSION_NSID)) {
    throw new PermanentJobError('INVALID_LEXICON', `Lexicon disabled by operational control: ${PROFILE_EXTENSION_NSID}`)
  }

  validateOutgoingRecord(PROFILE_EXTENSION_NSID, payload.record)

  const connectionId = await resolveConnectionId(db, payload)
  const connection = await loadConnectedConnection(db, connectionId)
  requireScope(connection, 'repo:')

  const now = new Date()
  await db
    .insertInto('atproto_publications')
    .values({
      id: randomUUID(),
      connection_id: connection.id,
      local_record_type: 'profileExtension',
      local_record_id: connection.actorId,
      collection: PROFILE_EXTENSION_NSID,
      rkey: PROFILE_SELF_RKEY,
      at_uri: null,
      cid: null,
      status: 'publishing',
      attempt_count: 1,
      published_at: null,
      deleted_at: null,
      last_error_code: null,
      next_retry_at: null,
      created_at: now,
      updated_at: now,
      version: 1,
    })
    .onConflict(oc =>
      oc.columns(['connection_id', 'local_record_type', 'local_record_id', 'collection']).doUpdateSet({
        status: 'publishing',
        updated_at: now,
      }),
    )
    .execute()

  const client = await resolvePublisherClient(db, config, connection)
  const result = await client.putRecord(PROFILE_EXTENSION_NSID, PROFILE_SELF_RKEY, payload.record)

  await db
    .updateTable('atproto_publications')
    .set({
      status: 'published',
      at_uri: result.uri,
      cid: result.cid,
      last_error_code: null,
      published_at: new Date(),
      updated_at: new Date(),
    })
    .where('connection_id', '=', connection.id)
    .where('local_record_type', '=', 'profileExtension')
    .where('local_record_id', '=', connection.actorId)
    .where('collection', '=', PROFILE_EXTENSION_NSID)
    .execute()
}
