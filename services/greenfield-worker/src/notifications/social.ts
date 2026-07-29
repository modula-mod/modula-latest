import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaWorkerDb, NotificationChannel} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'

type SocialNotificationKind =
  | 'reaction'
  | 'comment'
  | 'reply'
  | 'mention'
  | 'repost'
  | 'quote'
  | 'follow'
  | 'extension'

const KIND_TO_LEGACY: Record<SocialNotificationKind, 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'> = {
  reaction: 'like',
  comment: 'reply',
  reply: 'reply',
  mention: 'mention',
  repost: 'repost',
  quote: 'repost',
  follow: 'follow',
  extension: 'module_event',
}

const BODIES: Record<SocialNotificationKind, string> = {
  reaction: 'reacted to your post',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  mention: 'mentioned you',
  repost: 'reposted your post',
  quote: 'quoted your post',
  follow: 'started following you',
  extension: 'sent an extension notification',
}

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

/**
 * Social notification writer with self-notification suppression.
 * Burst reactions reuse a recent matching notification body when possible.
 */
export async function handleSocialNotification(
  db: ModulaWorkerDb,
  kind: SocialNotificationKind,
  rawPayload: unknown,
): Promise<void> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'notification payload must be an object')
  }
  const p = rawPayload as Record<string, unknown>
  const recipientActorId = String(p.recipientActorId ?? '')
  const actorId = typeof p.actorId === 'string' ? p.actorId : null
  const resourceType = typeof p.resourceType === 'string' ? p.resourceType : 'post'
  const resourceId = typeof p.resourceId === 'string' ? p.resourceId : null
  if (!recipientActorId || !resourceId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'recipientActorId and resourceId required')
  }
  if (actorId && actorId === recipientActorId) return

  const category = kind === 'extension' ? 'module' : 'social'
  const prefs = await db
    .selectFrom('notification_preferences')
    .selectAll()
    .where('actor_id', '=', recipientActorId)
    .executeTakeFirst()
  if (prefs) {
    if (!prefs.in_app_enabled || categoryDisabled(prefs.category_preferences, category)) return
    const enabled =
      kind === 'reaction'
        ? prefs.like_enabled && prefs.reaction_enabled
        : kind === 'repost'
          ? prefs.repost_enabled
          : kind === 'quote'
            ? prefs.quote_enabled
            : kind === 'comment'
              ? prefs.comment_enabled
        : kind === 'follow'
          ? prefs.follow_enabled
          : kind === 'mention'
            ? prefs.mention_enabled
            : kind === 'extension'
              ? prefs.module_event_enabled && prefs.extension_enabled
              : prefs.reply_enabled
    if (!enabled) return
  }

  const now = new Date()
  const channels: NotificationChannel[] = ['in-app']
  const dedupeKey = kind === 'reaction' && resourceId ? `social:reaction:${resourceType}:${resourceId}` : null
  if (kind === 'reaction') {
    const recent = await db
      .selectFrom('notifications')
      .selectAll()
      .where('recipient_actor_id', '=', recipientActorId)
      .where('type', '=', 'like')
      .where('dedupe_key', '=', dedupeKey)
      .where('created_at', '>', new Date(now.getTime() - 5 * 60_000))
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    if (recent) {
      await db
        .updateTable('notifications')
        .set({
          body: `${recent.aggregate_count + 1} people reacted to your post`,
          aggregate_count: recent.aggregate_count + 1,
          last_aggregated_at: now,
          updated_at: now,
          version: recent.version + 1,
        })
        .where('id', '=', recent.id)
        .execute()
      return
    }
  }

  await db
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      recipient_actor_id: recipientActorId,
      actor_id: actorId,
      type: KIND_TO_LEGACY[kind],
      category,
      channels: jsonb(channels),
      dedupe_key: dedupeKey,
      aggregate_count: 1,
      aggregate_window_started_at: now,
      last_aggregated_at: now,
      resource_type: resourceType,
      resource_id: resourceId,
      body: BODIES[kind],
      read_at: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      version: 1,
    })
    .execute()
}

function categoryDisabled(value: unknown, category: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as Record<string, unknown>)[category] === false
}
