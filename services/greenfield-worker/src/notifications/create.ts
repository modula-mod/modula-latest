import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaWorkerDb, NotificationCategory, NotificationChannel} from '../database.js'
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

const CATEGORIES = new Set<NotificationCategory>([
  'social',
  'module',
  'AI',
  'connector',
  'automation',
  'security',
  'system',
  'DIMON',
  'marketplace',
])
const CHANNELS = new Set<NotificationChannel>(['in-app', 'email', 'web-push'])
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export interface NotificationCreatePayload {
  recipientActorId: string
  actorId?: string
  type: NotificationType
  category?: NotificationCategory
  channels?: NotificationChannel[]
  dedupeKey?: string
  aggregateBody?: string
  moduleId?: string
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
    category: parseCategory(p.category),
    channels: parseChannels(p.channels),
    dedupeKey: typeof p.dedupeKey === 'string' && p.dedupeKey.trim() ? p.dedupeKey.trim().slice(0, 180) : undefined,
    aggregateBody: typeof p.aggregateBody === 'string' ? p.aggregateBody.slice(0, 500) : undefined,
    moduleId: typeof p.moduleId === 'string' ? p.moduleId : undefined,
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
  const category = payload.category ?? categoryForType(payload.type)
  const requestedChannels: NotificationChannel[] = payload.channels?.length ? payload.channels : ['in-app']
  const channels = preferences ? enabledChannels(preferences, requestedChannels) : requestedChannels
  if (channels.length === 0) return
  if (preferences) {
    const column = PREFERENCE_COLUMN[payload.type] as keyof typeof preferences
    if (preferences[column] === false) return
    if (categoryDisabled(preferences.category_preferences, category)) return
    if (category === 'AI' && !preferences.ai_completion_enabled) return
    if (category === 'automation' && !preferences.automation_failure_enabled) return
    if (category === 'DIMON' && !preferences.dimon_transaction_confirmation_enabled) return
    if (category === 'connector' && payload.type === 'module_event' && !preferences.connector_failure_enabled) return
    if (payload.moduleId && moduleDisabled(preferences.module_preferences, payload.moduleId)) return
  }

  const now = new Date()
  const body = payload.body ?? DEFAULT_BODIES[payload.type]
  if (payload.dedupeKey) {
    const existing = await db
      .selectFrom('notifications')
      .selectAll()
      .where('recipient_actor_id', '=', payload.recipientActorId)
      .where('dedupe_key', '=', payload.dedupeKey)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (existing) {
      await db
        .updateTable('notifications')
        .set({
          category,
          channels: jsonb(channels),
          body: payload.aggregateBody ?? aggregateBody(category, existing.aggregate_count + 1, body),
          aggregate_count: existing.aggregate_count + 1,
          last_aggregated_at: now,
          updated_at: now,
          version: existing.version + 1,
        })
        .where('id', '=', existing.id)
        .execute()
      return
    }
  }

  await db
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      recipient_actor_id: payload.recipientActorId,
      actor_id: payload.actorId ?? null,
      type: payload.type,
      category,
      channels: jsonb(channels),
      dedupe_key: payload.dedupeKey ?? null,
      aggregate_count: 1,
      aggregate_window_started_at: now,
      last_aggregated_at: now,
      resource_type: payload.resourceType ?? null,
      resource_id: payload.resourceId ?? null,
      body,
      read_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}

function parseCategory(value: unknown): NotificationCategory | undefined {
  return typeof value === 'string' && CATEGORIES.has(value as NotificationCategory)
    ? value as NotificationCategory
    : undefined
}

function parseChannels(value: unknown): NotificationChannel[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is NotificationChannel =>
    typeof item === 'string' && CHANNELS.has(item as NotificationChannel),
  )
}

function categoryForType(type: NotificationType): NotificationCategory {
  return type === 'module_event' ? 'module' : 'social'
}

function enabledChannels(preferences: Record<string, unknown>, requested: NotificationChannel[]): NotificationChannel[] {
  const enabled = new Set<NotificationChannel>()
  if (preferences.in_app_enabled) enabled.add('in-app')
  if (preferences.email_enabled) enabled.add('email')
  if (preferences.web_push_enabled) enabled.add('web-push')
  const channelPreferences = objectOrEmpty(preferences.channel_preferences)
  return requested.filter(channel => enabled.has(channel) && channelPreferences[channel] !== false)
}

function categoryDisabled(value: unknown, category: NotificationCategory): boolean {
  return objectOrEmpty(value)[category] === false
}

function moduleDisabled(value: unknown, moduleId: string): boolean {
  const preference = objectOrEmpty(value)[moduleId]
  return Boolean(preference && typeof preference === 'object' && (preference as Record<string, unknown>).enabled === false)
}

function aggregateBody(category: NotificationCategory, count: number, fallback: string): string {
  if (category === 'module') return `${count} module updates need attention`
  if (category === 'AI') return `${count} AI updates are ready`
  if (category === 'connector') return `${count} connector updates need attention`
  if (category === 'automation') return `${count} automation updates need attention`
  if (category === 'DIMON') return `${count} DIMON updates need attention`
  return count > 1 ? `${count} related updates` : fallback
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}
