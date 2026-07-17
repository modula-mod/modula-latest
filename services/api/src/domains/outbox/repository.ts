import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'
import type {Kysely, Transaction} from 'kysely'
import type {Database} from '../../database/types.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

export class OutboxRepository {
  constructor(private readonly db: Db) {}

  async enqueue(input: {
    eventType: string
    aggregateType: string
    aggregateId: string
    payload: Record<string, unknown>
  }): Promise<string> {
    const id = randomUUID()
    await this.db
      .insertInto('outbox_events')
      .values({
        id,
        event_type: input.eventType,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId,
        payload: input.payload,
        created_at: new Date(),
        published_at: null,
        attempt_count: 0,
        last_error: null,
      })
      .execute()
    // Also create a background job for the worker
    await this.db
      .insertInto('background_jobs')
      .values({
        id: randomUUID(),
        job_type: input.eventType,
        payload: {outboxId: id, ...input.payload},
        status: 'pending',
        priority: 100,
        available_at: new Date(),
        lease_owner: null,
        lease_expires_at: null,
        attempt_count: 0,
        maximum_attempts: 5,
        last_error: null,
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      })
      .execute()
    return id
  }
}
