import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'
import {classifyApnsResponse, type ApnsEnvironment, type PushSender} from './apns.js'
import {quietHoursEnd} from './quiet-hours.js'

export const PUSH_MAX_ATTEMPTS = 6
const LEASE_MS = 60_000

type Row = {
  id: string
  recipient_actor_id: string
  category: string
  actor_id: string | null
  title: string | null
  body: string
  deep_link: string | null
  thread_id: string | null
  data: unknown
  attempts: number
}

const PREFERENCE_COLUMN: Record<string, string> = {
  likes: 'likes_enabled',
  comments: 'comments_enabled',
  replies: 'replies_enabled',
  mentions: 'mentions_enabled',
  follows: 'follows_enabled',
  messages: 'messages_enabled',
  stories: 'stories_enabled',
  moliboo_care: 'moliboo_care_enabled',
  gubic_invites: 'gubic_invites_enabled',
}

/** Exponential backoff: 30s, 1m, 2m, 4m, 8m … capped at 1h. */
export function pushBackoffMs(attempts: number): number {
  return Math.min(60 * 60_000, 30_000 * 2 ** Math.max(0, attempts - 1))
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

/** Notification category identifiers must match the native app's UNNotificationCategory ids. */
export function apnsCategoryFor(row: Pick<Row, 'category' | 'thread_id'>): string | undefined {
  switch (row.category) {
    case 'comments':
    case 'replies':
    case 'mentions':
      return 'MODULA_COMMENT' // Reply, Like
    case 'likes':
      return undefined
    case 'messages':
      return 'MODULA_MESSAGE' // Reply
    case 'follows':
      return row.thread_id?.startsWith('follow-request:') && row.thread_id.endsWith(':requested')
        ? 'MODULA_FOLLOW_REQUEST' // Accept
        : undefined
    case 'gubic_invites':
      return 'MODULA_GUBIC_INVITE' // Accept
    default:
      return undefined
  }
}

/**
 * Deep links use the native app's canonical RouteParser grammar (modula://…):
 * post/:id[/comments], profile/:handle, activity/requests, messages/:id,
 * stories, notifications/:id, activity.
 */
export function deepLinkFor(
  row: Pick<Row, 'category' | 'deep_link' | 'thread_id' | 'actor_id' | 'data'>,
  context: {actorHandle?: string | null} = {},
): string {
  if (row.deep_link) return row.deep_link
  const data = record(row.data)
  const resourceType = typeof data.resourceType === 'string' ? data.resourceType : null
  const resourceId = typeof data.resourceId === 'string' ? data.resourceId : null
  const notificationId = typeof data.notificationId === 'string' ? data.notificationId : null
  if (row.category === 'follows') {
    if (row.thread_id?.startsWith('follow-request:') && row.thread_id.endsWith(':requested')) return 'modula://activity/requests'
    return context.actorHandle ? `modula://profile/${encodeURIComponent(context.actorHandle)}` : 'modula://activity'
  }
  if (row.category === 'stories') return resourceId ? `modula://stories/${encodeURIComponent(resourceId)}` : 'modula://stories'
  if (resourceType === 'post' && resourceId) {
    const section = row.category === 'comments' || row.category === 'replies' ? '/comments' : ''
    return `modula://post/${encodeURIComponent(resourceId)}${section}`
  }
  if (notificationId) return `modula://notifications/${encodeURIComponent(notificationId)}`
  return 'modula://activity'
}

export function buildApnsPayload(row: Row, options: {title: string | null; badge: number; actorHandle?: string | null}): Record<string, unknown> {
  const data = record(row.data)
  const followRequestId = row.thread_id?.startsWith('follow-request:') ? row.thread_id.split(':')[1] : undefined
  const alert: Record<string, string> = {body: row.body}
  if (options.title) alert.title = options.title
  const aps: Record<string, unknown> = {
    alert,
    badge: options.badge,
    sound: 'default',
    'mutable-content': 1,
  }
  const category = apnsCategoryFor(row)
  if (category) aps.category = category
  if (row.thread_id) aps['thread-id'] = row.thread_id.slice(0, 64)
  return {
    aps,
    modula: {
      deliveryId: row.id,
      category: row.category,
      deepLink: deepLinkFor(row, {actorHandle: options.actorHandle}),
      actorId: row.actor_id ?? undefined,
      notificationId: typeof data.notificationId === 'string' ? data.notificationId : undefined,
      resourceType: typeof data.resourceType === 'string' ? data.resourceType : undefined,
      resourceId: typeof data.resourceId === 'string' ? data.resourceId : undefined,
      conversationId: typeof data.conversationId === 'string' ? data.conversationId : undefined,
      followRequestId,
    },
  }
}

async function claim(db: ModulaWorkerDb, batchSize: number, now: Date): Promise<Row[]> {
  const result = await sql<Row>`
    UPDATE push_deliveries d
    SET status = 'sending', attempts = d.attempts + 1,
        lease_expires_at = ${new Date(now.getTime() + LEASE_MS)}, updated_at = ${now}
    WHERE d.id IN (
      SELECT id FROM push_deliveries
      WHERE (status = 'queued' AND next_attempt_at <= ${now})
         OR (status = 'sending' AND lease_expires_at < ${now})
      ORDER BY next_attempt_at
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING d.id, d.recipient_actor_id, d.category, d.actor_id, d.title, d.body, d.deep_link, d.thread_id, d.data, d.attempts
  `.execute(db)
  return result.rows
}

async function finish(db: ModulaWorkerDb, id: string, set: Record<string, unknown>): Promise<void> {
  await db.updateTable('push_deliveries')
    .set({...set, lease_expires_at: null, updated_at: new Date()} as any)
    .where('id', '=', id)
    .execute()
}

export interface PushPassResult {
  claimed: number
  sent: number
  suppressed: number
  deferred: number
  retried: number
  failed: number
  prunedTokens: number
}

/**
 * One dispatch pass over the push queue: preference + quiet-hours gating,
 * APNs send per active device, invalid-token pruning and retry with backoff.
 * `sender` null means APNs is not configured: rows stay queued untouched.
 */
export async function runPushPass(
  db: ModulaWorkerDb,
  sender: PushSender | null,
  options: {batchSize?: number; defaultEnvironment?: ApnsEnvironment; now?: () => Date; onAuthError?: () => void} = {},
): Promise<PushPassResult> {
  const result: PushPassResult = {claimed: 0, sent: 0, suppressed: 0, deferred: 0, retried: 0, failed: 0, prunedTokens: 0}
  if (!sender) return result
  const now = options.now ?? (() => new Date())
  const rows = await claim(db, options.batchSize ?? 50, now())
  result.claimed = rows.length

  for (const row of rows) {
    try {
      const prefs = await db.selectFrom('push_notification_preferences').selectAll()
        .where('actor_id', '=', row.recipient_actor_id).executeTakeFirst()
      const column = PREFERENCE_COLUMN[row.category]
      if (prefs && (!prefs.push_enabled || (column && (prefs as any)[column] === false))) {
        await finish(db, row.id, {status: 'suppressed', last_error: 'disabled by preferences'})
        result.suppressed++
        continue
      }
      const resumeAt = prefs
        ? quietHoursEnd(now(), {enabled: prefs.quiet_hours_enabled, start: prefs.quiet_hours_start, end: prefs.quiet_hours_end, timezone: prefs.timezone})
        : null
      if (resumeAt) {
        // Deferral does not consume a retry attempt.
        await finish(db, row.id, {status: 'queued', next_attempt_at: resumeAt, attempts: row.attempts - 1})
        result.deferred++
        continue
      }

      const tokens = await db.selectFrom('push_device_tokens')
        .select(['id', 'token', 'environment'])
        .where('actor_id', '=', row.recipient_actor_id)
        .where('disabled_at', 'is', null)
        .execute()
      if (tokens.length === 0) {
        await finish(db, row.id, {status: 'suppressed', last_error: 'no active device'})
        result.suppressed++
        continue
      }

      const [badge, actor] = await Promise.all([
        db.selectFrom('notifications').select(({fn}) => fn.countAll<number>().as('count'))
          .where('recipient_actor_id', '=', row.recipient_actor_id)
          .where('read_at', 'is', null).where('deleted_at', 'is', null)
          .executeTakeFirst(),
        !row.actor_id
          ? Promise.resolve(undefined)
          : db.selectFrom('profiles').select(['handle', 'display_name'])
              .where('actor_id', '=', row.actor_id).executeTakeFirst(),
      ])
      const title = row.title ?? ((actor as any)?.display_name || (actor?.handle ? `@${actor.handle}` : null))
      const payload = buildApnsPayload(row, {title, badge: Number(badge?.count ?? 0), actorHandle: actor?.handle ?? null})

      let delivered = 0
      let retryable = 0
      const errors: string[] = []
      for (const device of tokens) {
        const response = await sender.send({
          token: device.token,
          environment: (device.environment as ApnsEnvironment) ?? options.defaultEnvironment ?? 'production',
          payload,
          collapseId: row.id,
        })
        const outcome = classifyApnsResponse(response)
        if (outcome === 'sent') {
          delivered++
        } else if (outcome === 'invalid-token') {
          await db.updateTable('push_device_tokens')
            .set({disabled_at: new Date(), disabled_reason: response.reason ?? `HTTP ${response.status}`, updated_at: new Date()})
            .where('id', '=', device.id).execute()
          result.prunedTokens++
        } else {
          if (outcome === 'auth-error') options.onAuthError?.()
          if (outcome === 'retry' || outcome === 'auth-error') retryable++
          errors.push(`${response.status}:${response.reason ?? ''}`)
        }
      }

      if (delivered > 0 && retryable === 0) {
        await finish(db, row.id, {status: 'sent', sent_count: delivered, last_error: errors.join(', ') || null})
        result.sent++
      } else if (retryable > 0 && row.attempts < PUSH_MAX_ATTEMPTS) {
        // Retries resend to every device; apns-collapse-id = delivery id
        // collapses duplicates on devices that already received it.
        await finish(db, row.id, {
          status: 'queued', sent_count: delivered, last_error: errors.join(', ').slice(0, 500),
          next_attempt_at: new Date(now().getTime() + pushBackoffMs(row.attempts)),
        })
        result.retried++
      } else {
        await finish(db, row.id, {
          status: delivered > 0 ? 'sent' : retryable > 0 ? 'dead_letter' : 'failed',
          sent_count: delivered,
          last_error: (errors.join(', ') || 'all device tokens invalid').slice(0, 500),
        })
        if (delivered > 0) result.sent++
        else result.failed++
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await finish(db, row.id, row.attempts < PUSH_MAX_ATTEMPTS
        ? {status: 'queued', last_error: message.slice(0, 500), next_attempt_at: new Date(now().getTime() + pushBackoffMs(row.attempts))}
        : {status: 'dead_letter', last_error: message.slice(0, 500)})
      result.retried++
    }
  }
  return result
}
