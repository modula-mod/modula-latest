import {randomUUID} from 'node:crypto'
import type {Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

export type OutboxEventType =
  | 'notification.create'
  | 'notification.reaction'
  | 'notification.comment'
  | 'notification.reply'
  | 'notification.mention'
  | 'notification.repost'
  | 'notification.quote'
  | 'notification.follow'
  | 'extension.notification'
  | 'plugin.install'
  | 'plugin.enable'
  | 'plugin.disable'
  | 'plugin.configure'
  | 'plugin.uninstall'
  | 'function.invoke'
  | 'search.index.post'
  | 'search.index.profile'
  | 'atproto.publish.create'
  | 'atproto.publish.update'
  | 'atproto.publish.delete'

export type EnqueueOutboxEventInput = {
  eventType: OutboxEventType
  aggregateType: string
  aggregateId: string
  payload: Record<string, unknown>
}

/**
 * Transactional outbox + job queue. The API process only ever enqueues rows
 * here — it never performs the side effects (sending notifications,
 * indexing, publishing to AT Protocol) itself. Every enqueue writes:
 *  - an immutable event row to `outbox_events` (source-of-truth log), and
 *  - a leasable row to `background_jobs` (what `services/greenfield-worker` polls).
 * Both writes happen inside the caller's transaction so they commit
 * atomically with the domain write that caused them.
 */
export class OutboxRepository {
  constructor(private readonly db: ModulaDb | Transaction<Database>) {}

  async enqueue(trx: Transaction<Database> | ModulaDb, input: EnqueueOutboxEventInput): Promise<void> {
    const now = new Date()
    const outboxId = `outbox-${randomUUID()}`
    await trx
      .insertInto('outbox_events')
      .values({
        id: outboxId,
        event_type: input.eventType,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        payload: input.payload,
        created_at: now,
        published_at: null,
        attempt_count: 0,
        last_error: null,
      })
      .execute()

    await trx
      .insertInto('background_jobs')
      .values({
        id: `job-${randomUUID()}`,
        job_type: input.eventType,
        payload: {...input.payload, outboxEventId: outboxId, aggregateType: input.aggregateType, aggregateId: input.aggregateId},
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
}
