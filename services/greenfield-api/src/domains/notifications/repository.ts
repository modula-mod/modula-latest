import type {NotificationDto} from '@modula/api-contracts'
import type {NotificationChannel} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'

export class NotificationRepository {
  constructor(private readonly db: ModulaDb) {}

  async listForActor(actorId: string, limit: number, cursor: string | null): Promise<NotificationDto[]> {
    let query = this.db
      .selectFrom('notifications')
      .selectAll()
      .where('recipient_actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
    if (cursor) {
      const [createdAt, id] = cursor.split('|')
      if (!createdAt || !id) throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      query = query.where(({eb, or, and}) =>
        or([
          eb('created_at', '<', new Date(createdAt)),
          and([eb('created_at', '=', new Date(createdAt)), eb('id', '<', id)]),
        ]),
      )
    }
    const rows = await query.execute()
    return rows.map(row => ({
      id: row.id,
      type: row.type as NotificationDto['type'],
      category: row.category,
      channels: channels(row.channels),
      dedupeKey: row.dedupe_key ?? undefined,
      aggregateCount: row.aggregate_count,
      body: row.body,
      actorId: row.actor_id ?? undefined,
      resourceType: row.resource_type ?? undefined,
      resourceId: row.resource_id ?? undefined,
      readAt: row.read_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    }))
  }

  async markRead(actorId: string, notificationId: string): Promise<boolean> {
    const result = await this.db
      .updateTable('notifications')
      .set({read_at: new Date(), updated_at: new Date()})
      .where('id', '=', notificationId)
      .where('recipient_actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return Number(result.numUpdatedRows ?? 0) > 0
  }

  async markAllRead(actorId: string): Promise<number> {
    const result = await this.db
      .updateTable('notifications')
      .set({read_at: new Date(), updated_at: new Date()})
      .where('recipient_actor_id', '=', actorId)
      .where('read_at', 'is', null)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return Number(result.numUpdatedRows ?? 0)
  }
}

function channels(value: unknown): NotificationChannel[] {
  if (!Array.isArray(value)) return ['in-app']
  return value.filter((item): item is NotificationChannel =>
    item === 'in-app' || item === 'email' || item === 'web-push',
  )
}
