import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'

export class AuditRepository {
  constructor(private readonly db: ModulaDb) {}

  async append(eventType: string, metadata: Record<string, unknown> = {}, resource?: {type?: string; id?: string}) {
    await this.db
      .insertInto('audit_events')
      .values({
        id: `audit-${randomUUID()}`,
        event_type: eventType,
        actor_id: null,
        resource_type: resource?.type ?? null,
        resource_id: resource?.id ?? null,
        metadata,
        created_at: new Date(),
      })
      .execute()
  }
}
