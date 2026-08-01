import type {
  NotificationCategory,
  NotificationBundleStyle,
  NotificationChannel,
  NotificationFrequency,
  NotificationPreferencesDto,
  PatchNotificationPreferencesInput,
  QuietHoursPreferences,
} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {AuditRepository} from '../audit/repository.js'

const BUNDLE_STYLES = new Set<NotificationBundleStyle>([
  'individual',
  'focus',
  'digest',
])
const FREQUENCIES = new Set<NotificationFrequency>(['immediate', 'hourly', 'daily', 'weekly', 'manual'])
const CHANNELS = new Set<NotificationChannel>(['in-app', 'email', 'web-push'])
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

type NotificationPreferenceRow = Database['notification_preferences']

const DEFAULT_NOTIFICATION_PREFERENCES = {
  followEnabled: true,
  likeEnabled: true,
  reactionEnabled: true,
  repostEnabled: true,
  quoteEnabled: true,
  replyEnabled: true,
  commentEnabled: true,
  mentionEnabled: true,
  moduleEventEnabled: false,
  extensionEnabled: false,
  inAppEnabled: true,
  emailEnabled: false,
  webPushEnabled: false,
  frequency: 'immediate' as NotificationFrequency,
  digestMode: false,
  quietHours: {} as QuietHoursPreferences | Record<string, never>,
  channelPreferences: {} as Partial<Record<NotificationChannel, boolean>>,
  categoryPreferences: {} as Partial<Record<NotificationCategory, boolean>>,
  modulePreferences: {} as Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}>,
  connectorFailureEnabled: true,
  aiCompletionEnabled: true,
  automationFailureEnabled: true,
  dimonTransactionConfirmationEnabled: true,
  bundleStyle: 'focus' as NotificationBundleStyle,
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function normalizeBundleStyle(value: unknown): NotificationBundleStyle {
  return typeof value === 'string' && BUNDLE_STYLES.has(value as NotificationBundleStyle)
    ? value as NotificationBundleStyle
    : DEFAULT_NOTIFICATION_PREFERENCES.bundleStyle
}

function normalizeFrequency(value: unknown, fallback: NotificationFrequency): NotificationFrequency {
  return typeof value === 'string' && FREQUENCIES.has(value as NotificationFrequency)
    ? value as NotificationFrequency
    : fallback
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function normalizeQuietHours(value: unknown, fallback: unknown): QuietHoursPreferences | Record<string, never> {
  const input = objectOrEmpty(value)
  if (!Object.keys(input).length) return objectOrEmpty(fallback) as QuietHoursPreferences | Record<string, never>
  return {
    enabled: isBoolean(input.enabled) ? input.enabled : false,
    start: typeof input.start === 'string' ? input.start.slice(0, 16) : undefined,
    end: typeof input.end === 'string' ? input.end.slice(0, 16) : undefined,
    timezone: typeof input.timezone === 'string' ? input.timezone.slice(0, 64) : undefined,
  }
}

function normalizeBooleanRecord<T extends string>(
  value: unknown,
  fallback: unknown,
  allowed: ReadonlySet<T>,
): Partial<Record<T, boolean>> {
  if (value === undefined) return objectOrEmpty(fallback) as Partial<Record<T, boolean>>
  const output: Partial<Record<T, boolean>> = {}
  for (const [key, enabled] of Object.entries(objectOrEmpty(value))) {
    if (allowed.has(key as T) && isBoolean(enabled)) output[key as T] = enabled
  }
  return output
}

function normalizeModulePreferences(
  value: unknown,
  fallback: unknown,
): Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}> {
  if (value === undefined) {
    return objectOrEmpty(fallback) as Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}>
  }
  const output: Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}> = {}
  for (const [moduleId, raw] of Object.entries(objectOrEmpty(value))) {
    if (!/^[a-z0-9][a-z0-9._-]{1,127}$/i.test(moduleId)) continue
    const input = objectOrEmpty(raw)
    const entry: {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]} = {}
    if (isBoolean(input.enabled)) entry.enabled = input.enabled
    if (typeof input.frequency === 'string' && FREQUENCIES.has(input.frequency as NotificationFrequency)) {
      entry.frequency = input.frequency as NotificationFrequency
    }
    if (Array.isArray(input.channels)) {
      entry.channels = input.channels.filter((channel): channel is NotificationChannel =>
        typeof channel === 'string' && CHANNELS.has(channel as NotificationChannel),
      )
    }
    output[moduleId] = entry
  }
  return output
}

function mapPreferences(row: NotificationPreferenceRow): NotificationPreferencesDto {
  return {
    followEnabled: row.follow_enabled,
    likeEnabled: row.like_enabled,
    reactionEnabled: row.reaction_enabled,
    repostEnabled: row.repost_enabled,
    quoteEnabled: row.quote_enabled,
    replyEnabled: row.reply_enabled,
    commentEnabled: row.comment_enabled,
    mentionEnabled: row.mention_enabled,
    moduleEventEnabled: row.module_event_enabled,
    extensionEnabled: row.extension_enabled,
    inAppEnabled: row.in_app_enabled,
    emailEnabled: row.email_enabled,
    webPushEnabled: row.web_push_enabled,
    frequency: row.frequency,
    digestMode: row.digest_mode,
    quietHours: objectOrEmpty(row.quiet_hours) as QuietHoursPreferences,
    channelPreferences: objectOrEmpty(row.channel_preferences) as Partial<Record<NotificationChannel, boolean>>,
    categoryPreferences: objectOrEmpty(row.category_preferences) as Partial<Record<NotificationCategory, boolean>>,
    modulePreferences: objectOrEmpty(row.module_preferences) as Record<string, {enabled?: boolean; frequency?: NotificationFrequency; channels?: NotificationChannel[]}>,
    connectorFailureEnabled: row.connector_failure_enabled,
    aiCompletionEnabled: row.ai_completion_enabled,
    automationFailureEnabled: row.automation_failure_enabled,
    dimonTransactionConfirmationEnabled: row.dimon_transaction_confirmation_enabled,
    bundleStyle: row.bundle_style,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  }
}

export class NotificationPreferencesService {
  constructor(private readonly db: ModulaDb) {}

  async get(accountId: string): Promise<NotificationPreferencesDto> {
    return mapPreferences(await this.ensureRow(accountId))
  }

  async patch(
    accountId: string,
    patch: PatchNotificationPreferencesInput & {expectedVersion?: unknown},
  ): Promise<NotificationPreferencesDto> {
    const current = await this.ensureRow(accountId)
    if (
      typeof patch.expectedVersion === 'number' &&
      patch.expectedVersion !== current.version
    ) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    const next = {
      follow_enabled: isBoolean(patch.followEnabled)
        ? patch.followEnabled
        : current.follow_enabled,
      like_enabled: isBoolean(patch.likeEnabled) ? patch.likeEnabled : current.like_enabled,
      reaction_enabled: isBoolean(patch.reactionEnabled)
        ? patch.reactionEnabled
        : current.reaction_enabled,
      repost_enabled: isBoolean(patch.repostEnabled)
        ? patch.repostEnabled
        : current.repost_enabled,
      quote_enabled: isBoolean(patch.quoteEnabled) ? patch.quoteEnabled : current.quote_enabled,
      reply_enabled: isBoolean(patch.replyEnabled) ? patch.replyEnabled : current.reply_enabled,
      comment_enabled: isBoolean(patch.commentEnabled)
        ? patch.commentEnabled
        : current.comment_enabled,
      mention_enabled: isBoolean(patch.mentionEnabled)
        ? patch.mentionEnabled
        : current.mention_enabled,
      module_event_enabled: isBoolean(patch.moduleEventEnabled)
        ? patch.moduleEventEnabled
        : current.module_event_enabled,
      extension_enabled: isBoolean(patch.extensionEnabled)
        ? patch.extensionEnabled
        : current.extension_enabled,
      in_app_enabled: isBoolean(patch.inAppEnabled) ? patch.inAppEnabled : current.in_app_enabled,
      email_enabled: isBoolean(patch.emailEnabled) ? patch.emailEnabled : current.email_enabled,
      web_push_enabled: isBoolean(patch.webPushEnabled) ? patch.webPushEnabled : current.web_push_enabled,
      frequency: patch.frequency === undefined ? current.frequency : normalizeFrequency(patch.frequency, current.frequency),
      digest_mode: isBoolean(patch.digestMode) ? patch.digestMode : current.digest_mode,
      quiet_hours: normalizeQuietHours(patch.quietHours, current.quiet_hours),
      channel_preferences: normalizeBooleanRecord(patch.channelPreferences, current.channel_preferences, CHANNELS),
      category_preferences: normalizeBooleanRecord(patch.categoryPreferences, current.category_preferences, CATEGORIES),
      module_preferences: normalizeModulePreferences(patch.modulePreferences, current.module_preferences),
      connector_failure_enabled: isBoolean(patch.connectorFailureEnabled)
        ? patch.connectorFailureEnabled
        : current.connector_failure_enabled,
      ai_completion_enabled: isBoolean(patch.aiCompletionEnabled)
        ? patch.aiCompletionEnabled
        : current.ai_completion_enabled,
      automation_failure_enabled: isBoolean(patch.automationFailureEnabled)
        ? patch.automationFailureEnabled
        : current.automation_failure_enabled,
      dimon_transaction_confirmation_enabled: isBoolean(patch.dimonTransactionConfirmationEnabled)
        ? patch.dimonTransactionConfirmationEnabled
        : current.dimon_transaction_confirmation_enabled,
      bundle_style: patch.bundleStyle === undefined
        ? current.bundle_style
        : normalizeBundleStyle(patch.bundleStyle),
    }
    const now = new Date()
    const updated = await this.db
      .updateTable('notification_preferences')
      .set({
        ...next,
        version: current.version + 1,
        updated_at: now,
      })
      .where('id', '=', current.id)
      .where('version', '=', current.version)
      .executeTakeFirst()
    if (!Number(updated.numUpdatedRows ?? 0)) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    await new AuditRepository(this.db).append(
      'notification.preferences.updated',
      {
        followEnabled: next.follow_enabled,
        likeEnabled: next.like_enabled,
        reactionEnabled: next.reaction_enabled,
        repostEnabled: next.repost_enabled,
        quoteEnabled: next.quote_enabled,
        replyEnabled: next.reply_enabled,
        commentEnabled: next.comment_enabled,
        mentionEnabled: next.mention_enabled,
        moduleEventEnabled: next.module_event_enabled,
        extensionEnabled: next.extension_enabled,
        inAppEnabled: next.in_app_enabled,
        emailEnabled: next.email_enabled,
        webPushEnabled: next.web_push_enabled,
        frequency: next.frequency,
        digestMode: next.digest_mode,
        quietHours: next.quiet_hours,
        channelPreferences: next.channel_preferences,
        categoryPreferences: next.category_preferences,
        modulePreferences: next.module_preferences,
        connectorFailureEnabled: next.connector_failure_enabled,
        aiCompletionEnabled: next.ai_completion_enabled,
        automationFailureEnabled: next.automation_failure_enabled,
        dimonTransactionConfirmationEnabled: next.dimon_transaction_confirmation_enabled,
        bundleStyle: next.bundle_style,
      },
      {type: 'notification_preferences', id: current.actor_id, actorId: current.actor_id},
    )
    return this.get(accountId)
  }

  private async ensureRow(accountId: string): Promise<NotificationPreferenceRow> {
    const actor = await this.db
      .selectFrom('actors')
      .select('id')
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!actor) throw Object.assign(new Error('Account actor not found'), {code: 'NOT_FOUND'})
    const existing = await this.db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('actor_id', '=', actor.id)
      .executeTakeFirst()
    if (existing) return existing
    await this.db
      .insertInto('notification_preferences')
      .values({
        id: uuidv7(),
        actor_id: actor.id,
        follow_enabled: DEFAULT_NOTIFICATION_PREFERENCES.followEnabled,
        like_enabled: DEFAULT_NOTIFICATION_PREFERENCES.likeEnabled,
        reaction_enabled: DEFAULT_NOTIFICATION_PREFERENCES.reactionEnabled,
        repost_enabled: DEFAULT_NOTIFICATION_PREFERENCES.repostEnabled,
        quote_enabled: DEFAULT_NOTIFICATION_PREFERENCES.quoteEnabled,
        reply_enabled: DEFAULT_NOTIFICATION_PREFERENCES.replyEnabled,
        comment_enabled: DEFAULT_NOTIFICATION_PREFERENCES.commentEnabled,
        mention_enabled: DEFAULT_NOTIFICATION_PREFERENCES.mentionEnabled,
        module_event_enabled: DEFAULT_NOTIFICATION_PREFERENCES.moduleEventEnabled,
        extension_enabled: DEFAULT_NOTIFICATION_PREFERENCES.extensionEnabled,
        in_app_enabled: DEFAULT_NOTIFICATION_PREFERENCES.inAppEnabled,
        email_enabled: DEFAULT_NOTIFICATION_PREFERENCES.emailEnabled,
        web_push_enabled: DEFAULT_NOTIFICATION_PREFERENCES.webPushEnabled,
        frequency: DEFAULT_NOTIFICATION_PREFERENCES.frequency,
        digest_mode: DEFAULT_NOTIFICATION_PREFERENCES.digestMode,
        quiet_hours: DEFAULT_NOTIFICATION_PREFERENCES.quietHours,
        channel_preferences: DEFAULT_NOTIFICATION_PREFERENCES.channelPreferences,
        category_preferences: DEFAULT_NOTIFICATION_PREFERENCES.categoryPreferences,
        module_preferences: DEFAULT_NOTIFICATION_PREFERENCES.modulePreferences,
        connector_failure_enabled: DEFAULT_NOTIFICATION_PREFERENCES.connectorFailureEnabled,
        ai_completion_enabled: DEFAULT_NOTIFICATION_PREFERENCES.aiCompletionEnabled,
        automation_failure_enabled: DEFAULT_NOTIFICATION_PREFERENCES.automationFailureEnabled,
        dimon_transaction_confirmation_enabled: DEFAULT_NOTIFICATION_PREFERENCES.dimonTransactionConfirmationEnabled,
        bundle_style: DEFAULT_NOTIFICATION_PREFERENCES.bundleStyle,
        created_at: new Date(),
        updated_at: new Date(),
        version: 1,
      })
      .execute()
    return this.db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('actor_id', '=', actor.id)
      .executeTakeFirstOrThrow()
  }
}
