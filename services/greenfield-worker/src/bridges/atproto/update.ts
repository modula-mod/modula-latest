import type {WorkerConfig} from '../../config.js'
import type {ModulaWorkerDb} from '../../database.js'
import {PermanentJobError} from '../../jobs/errors.js'
import {isCapabilityEnabled, isLexiconDisabled, loadConnectedConnection, requireScope, resolvePublisherClient} from './session.js'
import {validateOutgoingRecord} from './validate-record.js'

export interface AtprotoUpdatePayload {
  localRecordType: string
  localRecordId: string
  collection: string
  record: Record<string, unknown>
}

function parsePayload(payload: unknown): AtprotoUpdatePayload {
  if (!payload || typeof payload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.update payload must be an object')
  }
  const p = payload as Record<string, unknown>
  const localRecordType = String(p.localRecordType ?? '')
  const localRecordId = String(p.localRecordId ?? '')
  const collection = String(p.collection ?? '')
  const record = p.record
  if (!localRecordType || !localRecordId || !collection || !record || typeof record !== 'object') {
    throw new PermanentJobError(
      'VALIDATION_FAILED',
      'atproto.update payload requires localRecordType, localRecordId, collection, record',
    )
  }
  return {localRecordType, localRecordId, collection, record: record as Record<string, unknown>}
}

/** Updates (`putRecord`) an already-published Modula record on its PDS. */
export async function handleAtprotoUpdate(db: ModulaWorkerDb, config: WorkerConfig, rawPayload: unknown): Promise<void> {
  const payload = parsePayload(rawPayload)

  if (!(await isCapabilityEnabled(db, 'atproto.publish.enabled'))) return
  if (await isLexiconDisabled(db, payload.collection)) {
    throw new PermanentJobError('INVALID_LEXICON', `Lexicon disabled by operational control: ${payload.collection}`)
  }

  validateOutgoingRecord(payload.collection, payload.record)

  const existing = await db
    .selectFrom('atproto_publications')
    .selectAll()
    .where('local_record_type', '=', payload.localRecordType)
    .where('local_record_id', '=', payload.localRecordId)
    .where('collection', '=', payload.collection)
    .executeTakeFirst()

  // Modula-only posts never create a publication row — treat as a successful no-op.
  if (!existing) return
  if (!existing.rkey) {
    throw new PermanentJobError(
      'VALIDATION_FAILED',
      `No existing AT publication to update for ${payload.localRecordType}:${payload.localRecordId}`,
    )
  }
  if (existing.status === 'deleted' || existing.status === 'revoked') {
    throw new PermanentJobError('VALIDATION_FAILED', `Publication ${existing.id} is ${existing.status}; cannot update`)
  }

  const connection = await loadConnectedConnection(db, existing.connection_id)
  requireScope(connection, 'repo:')

  await db
    .updateTable('atproto_publications')
    .set({status: 'updating', updated_at: new Date()})
    .where('id', '=', existing.id)
    .execute()

  const client = await resolvePublisherClient(db, config, connection)
  const result = await client.putRecord(payload.collection, existing.rkey, payload.record)

  await db
    .updateTable('atproto_publications')
    .set({
      status: 'published',
      at_uri: result.uri,
      cid: result.cid,
      last_error_code: null,
      updated_at: new Date(),
    })
    .where('id', '=', existing.id)
    .execute()
}
