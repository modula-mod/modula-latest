import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

export const PUSH_CATEGORIES = [
  'likes',
  'comments',
  'replies',
  'mentions',
  'follows',
  'messages',
  'stories',
  'molibooCare',
  'gubicInvites',
] as const
export type PushCategory = (typeof PUSH_CATEGORIES)[number]
export type PushDeliveryCategory =
  | 'likes' | 'comments' | 'replies' | 'mentions' | 'follows' | 'messages' | 'stories' | 'moliboo_care' | 'gubic_invites' | 'system'

const COLUMN: Record<PushCategory, keyof Database['push_notification_preferences']> = {
  likes: 'likes_enabled',
  comments: 'comments_enabled',
  replies: 'replies_enabled',
  mentions: 'mentions_enabled',
  follows: 'follows_enabled',
  messages: 'messages_enabled',
  stories: 'stories_enabled',
  molibooCare: 'moliboo_care_enabled',
  gubicInvites: 'gubic_invites_enabled',
}

export interface PushPreferencesDto {
  enabled: boolean
  categories: Record<PushCategory, boolean>
  quietHours: {enabled: boolean; start: string; end: string; timezone: string}
  version: number
  updatedAt: string
}

export interface PushDeviceDto {
  id: string
  platform: 'ios'
  environment: 'development' | 'production'
  bundleId: string
  appVersion: string | null
  registeredAt: string
  lastSeenAt: string
}

const TOKEN_RE = /^[0-9a-f]{64,200}$/
const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/

function validation(message: string): Error {
  return Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-GB', {timeZone: value})
    return true
  } catch {
    return false
  }
}

function optionalText(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

export function normalizeDeviceToken(value: unknown): string {
  const token = typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s<>]/g, '') : ''
  if (!TOKEN_RE.test(token)) throw validation('token must be a hex APNs device token')
  return token
}

export class PushDeviceService {
  constructor(private readonly db: ModulaDb, private readonly defaultBundleId: string) {}

  async register(
    auth: {accountId: string; actorId: string},
    input: Record<string, unknown>,
  ): Promise<PushDeviceDto> {
    const token = normalizeDeviceToken(input.token)
    const platform = input.platform ?? 'ios'
    if (platform !== 'ios') throw validation('platform must be ios')
    const environment = input.environment ?? 'production'
    if (environment !== 'development' && environment !== 'production') {
      throw validation('environment must be development or production')
    }
    const bundleId = optionalText(input.bundleId, 200) ?? this.defaultBundleId
    if (bundleId !== this.defaultBundleId) throw validation('bundleId is not accepted by this server')
    const timezone = optionalText(input.timezone, 64)
    if (timezone && !isValidTimeZone(timezone)) throw validation('timezone is not a valid IANA zone')
    const now = new Date()
    const row = await this.db
      .insertInto('push_device_tokens')
      .values({
        id: randomUUID(),
        account_id: auth.accountId,
        actor_id: auth.actorId,
        token,
        platform: 'ios',
        environment,
        bundle_id: bundleId,
        app_version: optionalText(input.appVersion, 40),
        device_name: optionalText(input.deviceName, 120),
        locale: optionalText(input.locale, 35),
        timezone,
        created_at: now,
        updated_at: now,
        last_seen_at: now,
        disabled_at: null,
        disabled_reason: null,
      })
      // A token belongs to exactly one device install; if another account signs in
      // on the same phone the token is re-assigned to the latest account.
      .onConflict(oc => oc.column('token').doUpdateSet({
        account_id: auth.accountId,
        actor_id: auth.actorId,
        environment,
        bundle_id: bundleId,
        app_version: optionalText(input.appVersion, 40),
        device_name: optionalText(input.deviceName, 120),
        locale: optionalText(input.locale, 35),
        timezone,
        updated_at: now,
        last_seen_at: now,
        disabled_at: null,
        disabled_reason: null,
      }))
      .returningAll()
      .executeTakeFirstOrThrow()
    if (timezone) {
      // Seed quiet-hours timezone from the device the first time.
      await this.db
        .insertInto('push_notification_preferences')
        .values({actor_id: auth.actorId, timezone} as any)
        .onConflict(oc => oc.column('actor_id').doNothing())
        .execute()
    }
    return toDevice(row)
  }

  async unregister(actorId: string, rawToken: unknown): Promise<boolean> {
    const token = normalizeDeviceToken(rawToken)
    const result = await this.db
      .deleteFrom('push_device_tokens')
      .where('token', '=', token)
      .where('actor_id', '=', actorId)
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0) > 0
  }

  async list(actorId: string): Promise<PushDeviceDto[]> {
    const rows = await this.db
      .selectFrom('push_device_tokens')
      .selectAll()
      .where('actor_id', '=', actorId)
      .where('disabled_at', 'is', null)
      .orderBy('last_seen_at', 'desc')
      .execute()
    return rows.map(toDevice)
  }
}

function toDevice(row: Database['push_device_tokens']): PushDeviceDto {
  return {
    id: row.id,
    platform: row.platform,
    environment: row.environment,
    bundleId: row.bundle_id,
    appVersion: row.app_version,
    registeredAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  }
}

export class PushPreferencesService {
  constructor(private readonly db: ModulaDb) {}

  private async ensure(actorId: string): Promise<Database['push_notification_preferences']> {
    await this.db
      .insertInto('push_notification_preferences')
      .values({actor_id: actorId} as any)
      .onConflict(oc => oc.column('actor_id').doNothing())
      .execute()
    return this.db
      .selectFrom('push_notification_preferences')
      .selectAll()
      .where('actor_id', '=', actorId)
      .executeTakeFirstOrThrow()
  }

  async get(actorId: string): Promise<PushPreferencesDto> {
    return toPreferences(await this.ensure(actorId))
  }

  async patch(actorId: string, input: Record<string, unknown>): Promise<PushPreferencesDto> {
    const current = await this.ensure(actorId)
    if (input.expectedVersion !== undefined && input.expectedVersion !== current.version) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    const set: Record<string, unknown> = {}
    if (input.enabled !== undefined) {
      if (typeof input.enabled !== 'boolean') throw validation('enabled must be boolean')
      set.push_enabled = input.enabled
    }
    if (input.categories !== undefined) {
      if (!input.categories || typeof input.categories !== 'object' || Array.isArray(input.categories)) {
        throw validation('categories must be an object')
      }
      for (const [key, value] of Object.entries(input.categories as Record<string, unknown>)) {
        if (!(PUSH_CATEGORIES as readonly string[]).includes(key)) throw validation(`Unknown category ${key}`)
        if (typeof value !== 'boolean') throw validation(`categories.${key} must be boolean`)
        set[COLUMN[key as PushCategory]] = value
      }
    }
    if (input.quietHours !== undefined) {
      const q = input.quietHours as Record<string, unknown>
      if (!q || typeof q !== 'object' || Array.isArray(q)) throw validation('quietHours must be an object')
      if (q.enabled !== undefined) {
        if (typeof q.enabled !== 'boolean') throw validation('quietHours.enabled must be boolean')
        set.quiet_hours_enabled = q.enabled
      }
      for (const [key, column] of [['start', 'quiet_hours_start'], ['end', 'quiet_hours_end']] as const) {
        if (q[key] === undefined) continue
        if (typeof q[key] !== 'string' || !TIME_RE.test(q[key] as string)) throw validation(`quietHours.${key} must be HH:MM`)
        set[column] = q[key]
      }
      if (q.timezone !== undefined) {
        if (typeof q.timezone !== 'string' || !isValidTimeZone(q.timezone)) throw validation('quietHours.timezone is invalid')
        set.timezone = q.timezone
      }
    }
    if (Object.keys(set).length === 0) return toPreferences(current)
    const updated = await this.db
      .updateTable('push_notification_preferences')
      .set({...set, version: current.version + 1, updated_at: new Date()} as any)
      .where('actor_id', '=', actorId)
      .where('version', '=', current.version)
      .returningAll()
      .executeTakeFirst()
    if (!updated) throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    return toPreferences(updated)
  }
}

function toPreferences(row: Database['push_notification_preferences']): PushPreferencesDto {
  const categories = {} as Record<PushCategory, boolean>
  for (const key of PUSH_CATEGORIES) categories[key] = Boolean(row[COLUMN[key]])
  return {
    enabled: row.push_enabled,
    categories,
    quietHours: {
      enabled: row.quiet_hours_enabled,
      start: row.quiet_hours_start,
      end: row.quiet_hours_end,
      timezone: row.timezone,
    },
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  }
}

export interface EnqueuePushInput {
  recipientActorId: string
  category: PushDeliveryCategory
  actorId?: string | null
  title?: string | null
  body: string
  deepLink?: string | null
  threadId?: string | null
  data?: Record<string, unknown>
}

/**
 * Enqueue a push for events that do not create an in-app notification row
 * (messages, stories, Moliboo care, GUBIC invites). In-app notification rows
 * are enqueued by the notifications_push_enqueue trigger (migration 080).
 * Recipients without a registered device are skipped.
 */
export async function enqueuePush(db: ModulaDb, input: EnqueuePushInput): Promise<boolean> {
  if (input.actorId && input.actorId === input.recipientActorId) return false
  const result = await sql<{id: string}>`
    INSERT INTO push_deliveries (id, recipient_actor_id, category, actor_id, title, body, deep_link, thread_id, data)
    SELECT ${randomUUID()}, ${input.recipientActorId}, ${input.category}, ${input.actorId ?? null},
           ${input.title?.slice(0, 120) ?? null}, ${input.body.slice(0, 1000)}, ${input.deepLink ?? null},
           ${input.threadId ?? null}, ${JSON.stringify(input.data ?? {})}::jsonb
    WHERE EXISTS (
      SELECT 1 FROM push_device_tokens
      WHERE actor_id = ${input.recipientActorId} AND disabled_at IS NULL
    )
    RETURNING id
  `.execute(db)
  return result.rows.length > 0
}
