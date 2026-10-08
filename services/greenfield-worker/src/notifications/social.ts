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
  const outboxEventId = typeof p.outboxEventId === 'string'
    ? p.outboxEventId
    : typeof p.outboxId === 'string'
      ? p.outboxId
      : null
  if (!recipientActorId || !resourceId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'recipientActorId and resourceId required')
  }
  if (actorId && actorId === recipientActorId) return
  if (actorId && await blockedEitherDirection(db, actorId, recipientActorId)) return

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
    // Reaction notification identity is permanent for a recipient/resource pair,
    // matching notifications_recipient_dedupe_uidx. Serialize the canonical
    // count read with the upsert so an older waiter cannot overwrite a newer
    // aggregate after losing the unique-index race.
    await db.transaction().execute(async trx => {
      const identity = `${recipientActorId}:${dedupeKey}`
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${identity}, 0))`.execute(trx)
      const deliveryId = outboxEventId ? `notification-reaction:${outboxEventId}` : null
      if (deliveryId) {
        const priorDelivery = await sql<{delivery_id: string}>`
          SELECT delivery_id
          FROM greenfield_notification_delivery
          WHERE delivery_id = ${deliveryId}
        `.execute(trx)
        if (priorDelivery.rows.length > 0) return
      }
      const reactionNow = new Date()
      const aggregate = resourceType === 'post'
        ? await trx
            .selectFrom('greenfield_reactions')
            .select(({fn}) => fn.countAll<number>().as('count'))
            .where('post_id', '=', resourceId)
            .where('actor_id', '<>', recipientActorId)
            .executeTakeFirst()
        : undefined
      const latestReaction = resourceType === 'post'
        ? await trx
            .selectFrom('greenfield_reactions')
            .select('actor_id')
            .where('post_id', '=', resourceId)
            .where('actor_id', '<>', recipientActorId)
            .orderBy('updated_at', 'desc')
            .orderBy('reaction_id', 'desc')
            .executeTakeFirst()
        : undefined
      const notificationActorId = latestReaction?.actor_id ?? actorId
      const aggregateCount = Math.max(1, Number(aggregate?.count ?? 1))
      const body = aggregateCount === 1
        ? BODIES.reaction
        : `${aggregateCount} people reacted to your post`

      const notification = await trx
        .insertInto('notifications')
        .values({
          id: randomUUID(),
          recipient_actor_id: recipientActorId,
          actor_id: notificationActorId,
          type: 'like',
          category,
          channels: jsonb(channels),
          dedupe_key: dedupeKey,
          aggregate_count: aggregateCount,
          aggregate_window_started_at: reactionNow,
          last_aggregated_at: reactionNow,
          resource_type: resourceType,
          resource_id: resourceId,
          body,
          read_at: null,
          created_at: reactionNow,
          updated_at: reactionNow,
          deleted_at: null,
          version: 1,
        })
        .onConflict(conflict => conflict
          .columns(['recipient_actor_id', 'dedupe_key'])
          .where('dedupe_key', 'is not', null)
          .where('deleted_at', 'is', null)
          .doUpdateSet({
            actor_id: notificationActorId,
            category,
            channels: jsonb(channels),
            aggregate_count: aggregateCount,
            aggregate_window_started_at: reactionNow,
            last_aggregated_at: reactionNow,
            resource_type: resourceType,
            resource_id: resourceId,
            body,
            read_at: null,
            created_at: reactionNow,
            updated_at: reactionNow,
            version: sql<number>`notifications.version + 1`,
          }))
        .returning('id')
        .executeTakeFirstOrThrow()

      if (deliveryId) {
        await sql`
          INSERT INTO greenfield_notification_delivery (
            delivery_id,
            notification_id,
            batch_id,
            channel,
            status,
            created_at
          ) VALUES (
            ${deliveryId},
            ${notification.id},
            NULL,
            'inApp',
            'delivered',
            ${reactionNow}
          )
        `.execute(trx)
      }
    })
    return
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

async function blockedEitherDirection(db: ModulaWorkerDb, actorA: string, actorB: string): Promise<boolean> {
  const row = await db
    .selectFrom('blocks')
    .select('id')
    .where('deleted_at', 'is', null)
    .where(({eb, or, and}) => or([
      and([eb('blocker_actor_id', '=', actorA), eb('blocked_actor_id', '=', actorB)]),
      and([eb('blocker_actor_id', '=', actorB), eb('blocked_actor_id', '=', actorA)]),
    ]))
    .executeTakeFirst()
  return Boolean(row)
}

function categoryDisabled(value: unknown, category: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return (value as Record<string, unknown>)[category] === false
}
