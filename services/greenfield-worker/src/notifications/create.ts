import {randomUUID} from 'node:crypto'
import type {ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'

const NOTIFICATION_TYPES = ['follow', 'like', 'repost', 'reply', 'mention', 'module_event'] as const
type NotificationType = (typeof NOTIFICATION_TYPES)[number]

const PREFERENCE_COLUMN: Record<NotificationType, string> = {
  follow: 'follow_enabled',
  like: 'like_enabled',
  repost: 'repost_enabled',
  reply: 'reply_enabled',
  mention: 'mention_enabled',
  module_event: 'module_event_enabled',
}

const DEFAULT_BODIES: Record<NotificationType, string> = {
  follow: 'started following you',
  like: 'liked your post',
  repost: 'reposted your post',
  reply: 'replied to your post',
  mention: 'mentioned you',
  module_event: 'sent you an update',
}

export interface NotificationCreatePayload {
  recipientActorId: string
  actorId?: string
  type: NotificationType
  resourceType?: string
  resourceId?: string
  body?: string
}

function parsePayload(payload: unknown): NotificationCreatePayload {
  if (!payload || typeof payload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'notification.create payload must be an object')
  }
  const p = payload as Record<string, unknown>
  const recipientActorId = String(p.recipientActorId ?? '')
  const type = String(p.type ?? '')
  if (!recipientActorId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'notification.create payload requires recipientActorId')
  }
  if (!(NOTIFICATION_TYPES as readonly string[]).includes(type)) {
    throw new PermanentJobError('VALIDATION_FAILED', `Unsupported notification type: ${type}`)
  }
  return {
    recipientActorId,
    actorId: typeof p.actorId === 'string' ? p.actorId : undefined,
    type: type as NotificationType,
    resourceType: typeof p.resourceType === 'string' ? p.resourceType : undefined,
    resourceId: typeof p.resourceId === 'string' ? p.resourceId : undefined,
    body: typeof p.body === 'string' ? p.body : undefined,
  }
}

/** notification.create outbox handler: writes a row into `notifications`, honouring per-type preferences. */
export async function handleNotificationCreate(db: ModulaWorkerDb, rawPayload: unknown): Promise<void> {
  const payload = parsePayload(rawPayload)

  if (payload.actorId && payload.actorId === payload.recipientActorId) return // never notify yourself

  const preferences = await db
    .selectFrom('notification_preferences')
    .selectAll()
    .where('actor_id', '=', payload.recipientActorId)
    .executeTakeFirst()
  if (preferences) {
    const column = PREFERENCE_COLUMN[payload.type] as keyof typeof preferences
    if (preferences[column] === false) return
  }

  await db
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      recipient_actor_id: payload.recipientActorId,
      actor_id: payload.actorId ?? null,
      type: payload.type,
      resource_type: payload.resourceType ?? null,
      resource_id: payload.resourceId ?? null,
      body: payload.body ?? DEFAULT_BODIES[payload.type],
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    })
    .execute()
}
