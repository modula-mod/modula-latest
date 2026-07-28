import type {
  NotificationBundleStyle,
  NotificationPreferencesDto,
  PatchNotificationPreferencesInput,
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
