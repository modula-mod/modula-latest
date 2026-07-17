import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'
import {isCapabilityEnabled, isLexiconDisabled, loadConnectedConnection, parseAtUri, requireScope, resolvePublisherClient} from './session.js'
import {validateOutgoingRecord} from './validate-record.js'

export interface AtprotoPublishPayload {
  connectionId?: string
  actorId?: string
  localRecordType: string
  localRecordId: string
  collection: string
  record: Record<string, unknown>
}

function parsePayload(payload: unknown): AtprotoPublishPayload {
  if (!payload || typeof payload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.publish payload must be an object')
  }
  const p = payload as Record<string, unknown>
  const localRecordType = String(p.localRecordType ?? '')
  const localRecordId = String(p.localRecordId ?? '')
  const collection = String(p.collection ?? '')
  const record = p.record
  if (!localRecordType || !localRecordId || !collection || !record || typeof record !== 'object') {
    throw new PermanentJobError(
      'VALIDATION_FAILED',
      'atproto.publish payload requires localRecordType, localRecordId, collection, record',
    )
  }
  return {
    connectionId: typeof p.connectionId === 'string' ? p.connectionId : undefined,
    actorId: typeof p.actorId === 'string' ? p.actorId : undefined,
    localRecordType,
    localRecordId,
    collection,
    record: record as Record<string, unknown>,
  }
}

async function resolveConnectionId(db: ModulaWorkerDb, payload: AtprotoPublishPayload): Promise<string> {
  if (payload.connectionId) return payload.connectionId
  if (!payload.actorId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.publish payload requires connectionId or actorId')
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
 * Publishes a brand-new Modula record to the connected actor's own PDS.
 * Always runs after the Modula write already committed (triggered via the
 * outbox), so a failure here can never roll back the original Modula post —
 * it only affects the AT Protocol mirror.
 */
export async function handleAtprotoPublish(db: ModulaWorkerDb, config: WorkerConfig, rawPayload: unknown): Promise<void> {
  const payload = parsePayload(rawPayload)

  if (!(await isCapabilityEnabled(db, 'atproto.publish.enabled'))) {
    return // operational pause, not a failure — no publication row is created
  }

  if (await isLexiconDisabled(db, payload.collection)) {
    throw new PermanentJobError('INVALID_LEXICON', `Lexicon disabled by operational control: ${payload.collection}`)
  }

  validateOutgoingRecord(payload.collection, payload.record)

  const connectionId = await resolveConnectionId(db, payload)
  const connection = await loadConnectedConnection(db, connectionId)
  requireScope(connection, 'repo:')

  const now = new Date()
  await db
    .insertInto('atproto_publications')
    .values({
      id: randomUUID(),
      connection_id: connection.id,
      local_record_type: payload.localRecordType,
      local_record_id: payload.localRecordId,
      collection: payload.collection,
      rkey: null,
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
        attempt_count: sql`atproto_publications.attempt_count + 1`,
        updated_at: now,
      }),
    )
    .execute()

  const client = await resolvePublisherClient(db, config, connection)
  const created = await client.createRecord(payload.collection, payload.record)
  const parsed = parseAtUri(created.uri)

  await db
    .updateTable('atproto_publications')
    .set({
      status: 'published',
      rkey: parsed?.rkey ?? null,
      at_uri: created.uri,
      cid: created.cid,
      last_error_code: null,
      published_at: new Date(),
      updated_at: new Date(),
    })
    .where('connection_id', '=', connection.id)
    .where('local_record_type', '=', payload.localRecordType)
    .where('local_record_id', '=', payload.localRecordId)
    .where('collection', '=', payload.collection)
    .execute()
}
