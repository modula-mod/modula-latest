import {randomUUID} from 'node:crypto'
import type {Kysely, Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

export class AuditRepository {
  constructor(private readonly db: Db) {}

  async append(
    eventType: string,
    metadata: Record<string, unknown> = {},
    resource?: {type?: string; id?: string; actorId?: string | null},
  ) {
    await this.db
      .insertInto('audit_events')
      .values({
        id: `audit-${randomUUID()}`,
        event_type: eventType,
        actor_id: resource?.actorId ?? null,
        resource_type: resource?.type ?? null,
        resource_id: resource?.id ?? null,
        metadata,
        created_at: new Date(),
      })
      .execute()
  }
}
