import type {WorkerConfig} from '../../config.js'
import type {ModulaWorkerDb} from '../../database.js'
import {PermanentJobError} from '../../jobs/errors.js'
import {isCapabilityEnabled, loadConnectedConnection, resolvePublisherClient} from './session.js'

export interface AtprotoDeletePayload {
  localRecordType: string
  localRecordId: string
  collection: string
}

function parsePayload(payload: unknown): AtprotoDeletePayload {
  if (!payload || typeof payload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.delete payload must be an object')
  }
  const p = payload as Record<string, unknown>
  const localRecordType = String(p.localRecordType ?? '')
  const localRecordId = String(p.localRecordId ?? '')
  const collection = String(p.collection ?? '')
  if (!localRecordType || !localRecordId || !collection) {
    throw new PermanentJobError('VALIDATION_FAILED', 'atproto.delete payload requires localRecordType, localRecordId, collection')
  }
  return {localRecordType, localRecordId, collection}
}

async function markDeleted(db: ModulaWorkerDb, publicationId: string): Promise<void> {
  await db
    .updateTable('atproto_publications')
    .set({status: 'deleted', deleted_at: new Date(), updated_at: new Date()})
    .where('id', '=', publicationId)
    .execute()
}

/**
 * Deletes a Modula record's AT Protocol mirror. Idempotent: missing or
 * already-deleted publications, and connections that were revoked before
 * the delete could run, are treated as a successful no-op rather than an
 * error — there is nothing more Modula can (or needs to) do.
 */
export async function handleAtprotoDelete(db: ModulaWorkerDb, config: WorkerConfig, rawPayload: unknown): Promise<void> {
  const payload = parsePayload(rawPayload)

  if (!(await isCapabilityEnabled(db, 'atproto.publish.enabled'))) return

  const existing = await db
    .selectFrom('atproto_publications')
    .selectAll()
    .where('local_record_type', '=', payload.localRecordType)
    .where('local_record_id', '=', payload.localRecordId)
    .where('collection', '=', payload.collection)
    .executeTakeFirst()

  if (!existing || existing.status === 'deleted') return

  if (!existing.rkey || !existing.at_uri) {
    await markDeleted(db, existing.id)
    return
  }

  let connection
  try {
    connection = await loadConnectedConnection(db, existing.connection_id)
  } catch (error) {
    if (error instanceof PermanentJobError && error.code === 'CONNECTION_REVOKED') {
      await markDeleted(db, existing.id)
      return
    }
    throw error
  }

  await db
    .updateTable('atproto_publications')
    .set({status: 'deleting', updated_at: new Date()})
    .where('id', '=', existing.id)
    .execute()

  const client = await resolvePublisherClient(db, config, connection)
  await client.deleteRecord(payload.collection, existing.rkey)
  await markDeleted(db, existing.id)
}
