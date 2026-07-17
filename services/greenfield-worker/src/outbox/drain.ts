import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'

/**
 * Classic transactional-outbox drain: converts unpublished `outbox_events`
 * rows into `background_jobs`. Idempotent by design — if a `background_jobs`
 * row already exists for a given outbox event (e.g. because the API's write
 * path also eagerly enqueues a job in the same DB transaction as a fast
 * path), this is a no-op reconciliation pass rather than a duplicate
 * enqueue. That makes it safe to run this drain loop unconditionally as a
 * backstop: any outbox row that *didn't* get an eager job (crash between the
 * two inserts, a future writer that only writes the outbox, etc.) still
 * reliably gets one.
 *
 * The whole batch runs inside a single transaction so `FOR UPDATE SKIP
 * LOCKED` actually holds its locks for the duration of the claim + convert
 * + mark-published sequence (Postgres releases row locks from a bare
 * top-level `SELECT ... FOR UPDATE` as soon as that statement finishes).
 */
export async function drainOutboxOnce(db: ModulaWorkerDb, batchSize: number): Promise<number> {
  return db.transaction().execute(async trx => {
    const now = new Date()

    const pending = await trx
      .selectFrom('outbox_events')
      .selectAll()
      .where('published_at', 'is', null)
      .orderBy('created_at')
      .limit(batchSize)
      .forUpdate()
      .skipLocked()
      .execute()

    for (const event of pending) {
      const alreadyEnqueued = await trx
        .selectFrom('background_jobs')
        .select('id')
        .where('job_type', '=', event.event_type)
        .where(sql<boolean>`payload ->> 'outboxId' = ${event.id}`)
        .executeTakeFirst()

      if (!alreadyEnqueued) {
        await trx
          .insertInto('background_jobs')
          .values({
            id: randomUUID(),
            job_type: event.event_type,
            payload: {
              outboxId: event.id,
              aggregateType: event.aggregate_type,
              aggregateId: event.aggregate_id,
              ...(event.payload as object),
            },
            status: 'pending',
            priority: 100,
            available_at: now,
            lease_owner: null,
            lease_expires_at: null,
            attempt_count: 0,
            maximum_attempts: 5,
            last_error: null,
            created_at: now,
            updated_at: now,
            completed_at: null,
          })
          .execute()
      }

      await trx
        .updateTable('outbox_events')
        .set({published_at: now, attempt_count: sql`attempt_count + 1`})
        .where('id', '=', event.id)
        .where('published_at', 'is', null)
        .execute()
    }

    return pending.length
  })
}
