import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {verifyPassword} from '../lib/password.js'
import {CredentialRegistryService} from '../auth/credentials/service.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {resolveAppPreferences, validateAppPreferencePatch, type AppPreferences} from './preferences.js'

export const INSIGHT_WINDOWS = [7, 28, 90] as const
export type InsightWindow = (typeof INSIGHT_WINDOWS)[number]
type RelationRow = {profile_id: string; actor_id: string; handle: string; display_name: string; avatar_url: string | null; since: Date}

const STEP_UP_ATTEMPTS = 5
const STEP_UP_WINDOW_MS = 15 * 60_000

export class SettingsV2Service {
  private readonly attempts = new Map<string, number[]>()
  private readonly credentials: CredentialRegistryService

  constructor(private readonly db: ModulaDb, private readonly sessions?: GreenfieldSessionService) {
    this.credentials = new CredentialRegistryService(db as any)
  }

  // MARK: App preferences + digests

  async preferences(accountId: string) {
    const row = await this.db.selectFrom('greenfield_account_app_preferences').select(['preferences', 'version', 'updated_at']).where('account_id', '=', accountId).executeTakeFirst()
    return {
      preferences: resolveAppPreferences(row?.preferences),
      version: row?.version ?? 0,
      updatedAt: row?.updated_at?.toISOString() ?? null,
      digests: await this.digestStatus(accountId, resolveAppPreferences(row?.preferences)),
    }
  }

  async updatePreferences(accountId: string, body: unknown) {
    const patch = validateAppPreferencePatch(body)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const current = await trx.selectFrom('greenfield_account_app_preferences').select(['preferences']).where('account_id', '=', accountId).forUpdate().executeTakeFirst()
      const merged = {...resolveAppPreferences(current?.preferences), ...patch}
      if (current) {
        await trx.updateTable('greenfield_account_app_preferences')
          .set({preferences: JSON.stringify(merged) as any, version: sql`version + 1` as any, updated_at: now})
          .where('account_id', '=', accountId).execute()
      } else {
        await trx.insertInto('greenfield_account_app_preferences')
          .values({account_id: accountId, preferences: JSON.stringify(merged) as any, version: 1, updated_at: now}).execute()
      }
    })
    return this.preferences(accountId)
  }

  private async digestStatus(accountId: string, preferences: AppPreferences) {
    const email = await this.db.selectFrom('greenfield_auth_identities').select(['identifier', 'verified_at'])
      .where('account_id', '=', accountId).where('kind', '=', 'email').orderBy('created_at', 'asc').executeTakeFirst()
    const recent = await this.db.selectFrom('greenfield_digest_deliveries').select(['digest_kind', 'period_key', 'outcome', 'created_at'])
      .where('account_id', '=', accountId).orderBy('created_at', 'desc').limit(6).execute()
    return {
      deliveryEmail: email ? maskEmail(email.identifier) : null,
      emailVerified: Boolean(email?.verified_at),
      weeklyEnabled: preferences['digests.weekly'] === true,
      morningEnabled: preferences['digests.morning'] === true,
      timeZone: preferences['digests.timeZone'],
      schedule: {morning: 'Daily, between 07:00 and 11:00 in your time zone', weekly: 'Mondays, between 08:00 and 14:00 in your time zone'},
      recent: recent.map(row => ({kind: row.digest_kind, period: row.period_key, outcome: row.outcome, at: row.created_at.toISOString()})),
    }
  }

  // MARK: Mutes and blocks

  async mutes(accountId: string) {
    const rows = await sql<RelationRow>`
      SELECT p.id AS profile_id, p.actor_id, p.handle, p.display_name, p.avatar_url, r.created_at AS since
      FROM mutes r
      JOIN actors me ON me.id = r.muter_actor_id AND me.account_id = ${accountId}
      JOIN profiles p ON p.actor_id = r.muted_actor_id AND p.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 500`.execute(this.db)
    return {items: this.mapRelations(rows.rows)}
  }

  async blocks(accountId: string) {
    const rows = await sql<RelationRow>`
      SELECT p.id AS profile_id, p.actor_id, p.handle, p.display_name, p.avatar_url, r.created_at AS since
      FROM blocks r
      JOIN actors me ON me.id = r.blocker_actor_id AND me.account_id = ${accountId}
      JOIN profiles p ON p.actor_id = r.blocked_actor_id AND p.deleted_at IS NULL
      WHERE r.deleted_at IS NULL
      ORDER BY r.created_at DESC
      LIMIT 500`.execute(this.db)
    return {items: this.mapRelations(rows.rows)}
  }

  private mapRelations(rows: RelationRow[]) {
    return rows.map(row => ({
      profileId: row.profile_id,
      actorId: row.actor_id,
      handle: row.handle,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      since: new Date(row.since).toISOString(),
    }))
  }

  // MARK: Creator insights

  async insights(accountId: string, daysInput: unknown) {
    const days = Number(daysInput ?? 28) as InsightWindow
    if (!INSIGHT_WINDOWS.includes(days)) invalid('days must be 7, 28 or 90', 'days')
    const series = await sql<{day: string; likes: string; reactions: string; comments: string; shares: string; saves: string; followers: string; posts: string; story_views: string}>`
      WITH me AS (SELECT id FROM actors WHERE account_id = ${accountId}),
      my_posts AS (SELECT id FROM posts WHERE author_actor_id IN (SELECT id FROM me) AND deleted_at IS NULL),
      days AS (SELECT generate_series((now() AT TIME ZONE 'UTC')::date - (${days}::int - 1), (now() AT TIME ZONE 'UTC')::date, interval '1 day')::date AS day)
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        (SELECT count(*) FROM post_likes l WHERE l.post_id IN (SELECT id FROM my_posts) AND l.deleted_at IS NULL AND l.actor_id NOT IN (SELECT id FROM me) AND (l.created_at AT TIME ZONE 'UTC')::date = d.day) AS likes,
        (SELECT count(*) FROM greenfield_reactions r WHERE r.post_id IN (SELECT id FROM my_posts) AND r.actor_id NOT IN (SELECT id FROM me) AND (r.created_at AT TIME ZONE 'UTC')::date = d.day) AS reactions,
        (SELECT count(*) FROM greenfield_comments c WHERE c.post_id IN (SELECT id FROM my_posts) AND c.deleted_at IS NULL AND c.author_actor_id NOT IN (SELECT id FROM me) AND (c.created_at AT TIME ZONE 'UTC')::date = d.day) AS comments,
        (SELECT count(*) FROM greenfield_post_shares s WHERE s.post_id IN (SELECT id FROM my_posts) AND s.actor_id NOT IN (SELECT id FROM me) AND (s.created_at AT TIME ZONE 'UTC')::date = d.day) AS shares,
        (SELECT count(*) FROM post_saves v WHERE v.post_id IN (SELECT id FROM my_posts) AND v.deleted_at IS NULL AND v.actor_id NOT IN (SELECT id FROM me) AND (v.created_at AT TIME ZONE 'UTC')::date = d.day) AS saves,
        (SELECT count(*) FROM follows f WHERE f.followed_actor_id IN (SELECT id FROM me) AND f.deleted_at IS NULL AND (f.created_at AT TIME ZONE 'UTC')::date = d.day) AS followers,
        (SELECT count(*) FROM posts p WHERE p.author_actor_id IN (SELECT id FROM me) AND p.deleted_at IS NULL AND (p.created_at AT TIME ZONE 'UTC')::date = d.day) AS posts,
        (SELECT count(*) FROM greenfield_story_views sv JOIN greenfield_story_items si ON si.item_id = sv.item_id JOIN greenfield_story_groups sg ON sg.group_id = si.group_id
           WHERE sg.owner_actor_id IN (SELECT id FROM me) AND sv.viewer_actor_id NOT IN (SELECT id FROM me) AND (sv.viewed_at AT TIME ZONE 'UTC')::date = d.day) AS story_views
      FROM days d ORDER BY d.day`.execute(this.db)

    const top = await sql<{id: string; text: string | null; kind: string; created_at: Date; like_count: number; reaction_count: number; reply_count: number; repost_count: number; shares: string; saves: string}>`
      SELECT p.id, p.text, p.kind, p.created_at, p.like_count, p.reaction_count, p.reply_count, p.repost_count,
        (SELECT count(*) FROM greenfield_post_shares s WHERE s.post_id = p.id) AS shares,
        (SELECT count(*) FROM post_saves v WHERE v.post_id = p.id AND v.deleted_at IS NULL) AS saves
      FROM posts p
      WHERE p.author_actor_id IN (SELECT id FROM actors WHERE account_id = ${accountId}) AND p.deleted_at IS NULL
        AND p.created_at >= now() - make_interval(days => ${days}::int)
      ORDER BY (p.like_count + p.reaction_count + p.reply_count * 2 + p.repost_count * 2) DESC, p.created_at DESC
      LIMIT 5`.execute(this.db)

    const followerTotal = await sql<{count: string}>`
      SELECT count(*) FROM follows WHERE followed_actor_id IN (SELECT id FROM actors WHERE account_id = ${accountId}) AND deleted_at IS NULL`.execute(this.db)

    const points = series.rows.map(row => ({
      date: row.day,
      likes: Number(row.likes),
      reactions: Number(row.reactions),
      comments: Number(row.comments),
      shares: Number(row.shares),
      saves: Number(row.saves),
      newFollowers: Number(row.followers),
      posts: Number(row.posts),
      storyViews: Number(row.story_views),
    }))
    const sum = (key: keyof (typeof points)[number]) => points.reduce((total, point) => total + Number(point[key]), 0)
    return {
      days,
      generatedAt: new Date().toISOString(),
      totals: {
        likes: sum('likes'),
        reactions: sum('reactions'),
        comments: sum('comments'),
        shares: sum('shares'),
        saves: sum('saves'),
        newFollowers: sum('newFollowers'),
        posts: sum('posts'),
        storyViews: sum('storyViews'),
        followers: Number(followerTotal.rows[0]?.count ?? 0),
      },
      series: points,
      topPosts: top.rows.map(row => ({
        postId: row.id,
        kind: row.kind,
        excerpt: (row.text ?? '').slice(0, 140),
        createdAt: new Date(row.created_at).toISOString(),
        likes: Number(row.like_count),
        reactions: Number(row.reaction_count),
        replies: Number(row.reply_count),
        reposts: Number(row.repost_count),
        shares: Number(row.shares),
        saves: Number(row.saves),
      })),
      // Modula doesn't record impressions or profile visits, so they are reported as untracked, never estimated.
      notTracked: ['impressions', 'profileViews', 'reach'],
    }
  }

  // MARK: Payouts ledger + invoices

  async payouts(accountId: string) {
    const entries = await this.db.selectFrom('greenfield_creator_ledger_entries')
      .select(['entry_id', 'entry_kind', 'amount_minor', 'currency', 'description', 'occurred_at'])
      .where('account_id', '=', accountId).orderBy('occurred_at', 'desc').limit(200).execute()
    const balances = new Map<string, number>()
    for (const entry of entries) balances.set(entry.currency, (balances.get(entry.currency) ?? 0) + Number(entry.amount_minor))
    return {
      provider: null,
      payoutsEnabled: false,
      reason: 'No payment provider is connected to Modula yet, so nothing can be earned or paid out.',
      balances: [...balances.entries()].map(([currency, amountMinor]) => ({currency, amountMinor})),
      entries: entries.map(entry => ({
        entryId: entry.entry_id,
        kind: entry.entry_kind,
        amountMinor: Number(entry.amount_minor),
        currency: entry.currency,
        description: entry.description,
        occurredAt: entry.occurred_at.toISOString(),
      })),
    }
  }

  async invoices(accountId: string) {
    const rows = await this.db.selectFrom('greenfield_commerce_invoices')
      .select(['invoice_id', 'invoice_number', 'state', 'description', 'total_minor', 'currency', 'issued_at', 'paid_at'])
      .where('account_id', '=', accountId).orderBy('issued_at', 'desc').limit(200).execute()
    return {
      provider: null,
      items: rows.map(row => ({
        invoiceId: row.invoice_id,
        number: row.invoice_number,
        state: row.state,
        description: row.description,
        totalMinor: Number(row.total_minor),
        currency: row.currency,
        issuedAt: row.issued_at.toISOString(),
        paidAt: row.paid_at?.toISOString() ?? null,
      })),
    }
  }

  // MARK: Password step-up + deletion status

  async passwordStepUp(auth: {accountId: string; sessionId: string}, body: unknown) {
    // @atlas-reads greenfield_authentication_methods
    // @atlas-writes greenfield_authentication_methods greenfield_sessions
    if (!body || typeof body !== 'object' || Array.isArray(body)) invalid('Enter your password', 'password')
    const input = body as Record<string, unknown>
    const unknownField = Object.keys(input).find(key => key !== 'password')
    if (unknownField) invalid(`Unknown field ${unknownField.slice(0, 60)}`, unknownField.slice(0, 60))
    const password = typeof input.password === 'string' ? input.password : ''
    if (!password || password.length > 1024) invalid('Enter your password', 'password')
    const now = Date.now()
    const recent = (this.attempts.get(auth.accountId) ?? []).filter(at => now - at < STEP_UP_WINDOW_MS)
    if (recent.length >= STEP_UP_ATTEMPTS) throw Object.assign(new Error('Too many attempts. Try again in a few minutes.'), {code: 'RATE_LIMITED'})
    const credential = await this.db.selectFrom('greenfield_password_credentials').select('password_hash').where('account_id', '=', auth.accountId).executeTakeFirst()
    if (!credential) throw Object.assign(new Error('This account has no password. Confirm with your authenticator or passkey instead.'), {code: 'CONFLICT'})
    if (!(await verifyPassword(password, credential.password_hash))) {
      recent.push(now)
      this.attempts.set(auth.accountId, recent)
      invalid('That password is not correct', 'password')
    }
    this.attempts.delete(auth.accountId)
    const method = await this.credentials.findActivePasswordMethod(auth.accountId)
    if (!method) throw Object.assign(new Error('Password sign-in is not active on this account'), {code: 'CONFLICT'})
    if (!this.sessions) throw new Error('sessions unavailable')
    await this.sessions.markRecentlyAuthenticated(auth.sessionId, auth.accountId, {authenticationMethodId: method.methodId, authenticationStrength: method.strength})
    await this.credentials.markMethodUsed(method.methodId)
    return {stepUp: true, authenticationStrength: method.strength, validForSeconds: 600}
  }

  async currentDeletion(accountId: string) {
    const row = await this.db.selectFrom('greenfield_account_data_requests')
      .select(['data_request_id', 'state', 'not_before', 'created_at'])
      .where('account_id', '=', accountId).where('request_type', '=', 'DELETE')
      .where('state', 'in', ['WAITING_RETENTION', 'DELETING'])
      .orderBy('created_at', 'desc').executeTakeFirst()
    return {
      request: row ? {
        requestId: row.data_request_id,
        state: row.state,
        requestedAt: row.created_at.toISOString(),
        scheduledFor: row.not_before?.toISOString() ?? null,
        cancellable: true,
      } : null,
      gracePeriodDays: 7,
    }
  }
}

export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@')
  if (!domain) return '***'
  return `${local.slice(0, 2)}***@${domain}`
}

function invalid(message: string, field: string): never {
  throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED', field})
}
