import {randomUUID} from 'node:crypto'
import type {ModulaWorkerDb} from '../database.js'
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

  const prefs = await db
    .selectFrom('notification_preferences')
    .selectAll()
    .where('actor_id', '=', recipientActorId)
    .executeTakeFirst()
  if (prefs) {
    const enabled =
      kind === 'reaction' || kind === 'repost' || kind === 'quote'
        ? kind === 'reaction'
          ? prefs.like_enabled
          : prefs.repost_enabled
        : kind === 'follow'
          ? prefs.follow_enabled
          : kind === 'mention'
            ? prefs.mention_enabled
            : kind === 'extension'
              ? prefs.module_event_enabled
              : prefs.reply_enabled
    if (!enabled) return
  }

  const now = new Date()
  if (kind === 'reaction') {
    const recent = await db
      .selectFrom('notifications')
      .selectAll()
      .where('recipient_actor_id', '=', recipientActorId)
      .where('type', '=', 'like')
      .where('resource_id', '=', resourceId)
      .where('created_at', '>', new Date(now.getTime() - 5 * 60_000))
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    if (recent) {
      await db
        .updateTable('notifications')
        .set({
          body: 'And others reacted to your post.',
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
