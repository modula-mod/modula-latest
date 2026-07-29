import {sql} from 'kysely'
import type {Database, ModulaWorkerDb} from '../database.js'

export type ClaimedEventDelivery = Database['greenfield_event_deliveries']

export async function claimNextEventDelivery(
  db: ModulaWorkerDb,
  workerId: string,
  leaseDurationMs: number,
): Promise<ClaimedEventDelivery | undefined> {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs)

  const result = await sql<ClaimedEventDelivery>`
    UPDATE greenfield_event_deliveries
    SET
      status = 'leased',
      lease_owner = ${workerId},
      lease_expires_at = ${leaseExpiresAt},
      attempt_count = attempt_count + 1,
      updated_at = ${now}
    WHERE delivery_id = (
      SELECT delivery_id
      FROM greenfield_event_deliveries
      WHERE status IN ('pending', 'retrying') AND available_at <= ${now}
      ORDER BY available_at, created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `.execute(db)

  return result.rows[0]
}

export async function markEventDeliveryProcessing(
  db: ModulaWorkerDb,
  deliveryId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_deliveries')
    .set({status: 'processing', updated_at: now})
    .where('delivery_id', '=', deliveryId)
    .execute()
}

export async function reapExpiredEventDeliveryLeases(db: ModulaWorkerDb, now: Date = new Date()): Promise<number> {
  const result = await sql`
    UPDATE greenfield_event_deliveries
    SET
      status = 'retrying',
      lease_owner = NULL,
      lease_expires_at = NULL,
      available_at = ${now},
      failure_code = 'LEASE_EXPIRED',
      failure_message = 'Subscriber lease expired before completion',
      updated_at = ${now}
    WHERE status IN ('leased', 'processing') AND lease_expires_at IS NOT NULL AND lease_expires_at <= ${now}
  `.execute(db)

  return Number(result.numAffectedRows ?? 0n)
}

export async function completeEventDelivery(
  db: ModulaWorkerDb,
  deliveryId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_deliveries')
    .set({
      status: 'completed',
      delivered_at: now,
      updated_at: now,
      lease_owner: null,
      lease_expires_at: null,
      failure_code: null,
      failure_message: null,
    })
    .where('delivery_id', '=', deliveryId)
    .execute()
}

export async function scheduleEventDeliveryRetry(
  db: ModulaWorkerDb,
  deliveryId: string,
  availableAt: Date,
  failureCode: string,
  failureMessage: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_deliveries')
    .set({
      status: 'retrying',
      available_at: availableAt,
      failure_code: failureCode,
      failure_message: failureMessage,
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .where('delivery_id', '=', deliveryId)
    .execute()
}

export async function deadLetterEventDelivery(
  db: ModulaWorkerDb,
  deliveryId: string,
  failureCode: string,
  failureMessage: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_deliveries')
    .set({
      status: 'dead_lettered',
      failure_code: failureCode,
      failure_message: failureMessage,
      lease_owner: null,
      lease_expires_at: null,
      updated_at: now,
    })
    .where('delivery_id', '=', deliveryId)
    .execute()
}
