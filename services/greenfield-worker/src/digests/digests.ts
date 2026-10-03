import {createHash, randomUUID} from 'node:crypto'
import {sql, type Kysely} from 'kysely'
import type {Database} from '../database.js'

export const DIGEST_PASS_INTERVAL_MS = 5 * 60_000
export type DigestKind = 'weekly' | 'morning'

type LocalClock = {date: string; hour: number; weekday: number; isoWeek: string}

/** Wall-clock parts in a member's time zone. Falls back to UTC for an unknown zone. */
export function localClock(now: Date, timeZone: string): LocalClock {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23', weekday: 'short'}).formatToParts(now)
  } catch {
    return localClock(now, 'UTC')
  }
  const part = (type: string) => parts.find(item => item.type === type)?.value ?? ''
  const date = `${part('year')}-${part('month')}-${part('day')}`
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1
  return {date, hour: Number(part('hour')), weekday, isoWeek: isoWeekKey(date)}
}

export function isoWeekKey(localDate: string): string {
  const [year, month, day] = localDate.split('-').map(Number)
  const date = new Date(Date.UTC(year!, month! - 1, day!))
  const dayNumber = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Which digest period (if any) is due for a member right now. */
export function duePeriod(kind: DigestKind, clock: LocalClock): string | null {
  if (kind === 'morning') return clock.hour >= 7 && clock.hour < 11 ? clock.date : null
  return clock.weekday === 1 && clock.hour >= 8 && clock.hour < 14 ? clock.isoWeek : null
}

export type DigestSummary = {likes: number; reactions: number; comments: number; newFollowers: number; mentions: number; unreadNotifications: number}

export function isQuiet(summary: DigestSummary): boolean {
  return summary.likes + summary.reactions + summary.comments + summary.newFollowers + summary.mentions + summary.unreadNotifications === 0
}

export function renderDigest(kind: DigestKind, input: {displayName: string; summary: DigestSummary; webUrl: string; periodLabel: string}) {
  const s = input.summary
  const lines = [
    [s.newFollowers, 'new follower', 'new followers'],
    [s.likes + s.reactions, 'like or reaction on your posts', 'likes and reactions on your posts'],
    [s.comments, 'comment on your posts', 'comments on your posts'],
    [s.mentions, 'mention', 'mentions'],
    [s.unreadNotifications, 'unread notification', 'unread notifications'],
  ].filter(([count]) => Number(count) > 0).map(([count, one, many]) => `${count} ${Number(count) === 1 ? one : many}`)
  const title = kind === 'weekly' ? 'Your week on Modula' : 'Your morning on Modula'
  const subject = kind === 'weekly' ? `Your week on Modula · ${input.periodLabel}` : 'Your morning summary from Modula'
  const greeting = `Hi ${input.displayName},`
  const intro = kind === 'weekly' ? 'Here is what happened around you last week.' : 'Here is what happened since yesterday morning.'
  const settingsUrl = `${input.webUrl.replace(/\/$/, '')}/settings`
  const textBody = [greeting, '', intro, '', ...lines.map(line => `• ${line}`), '', `Open Modula: ${input.webUrl}`, '', `You get this because you turned on ${kind === 'weekly' ? 'the weekly digest' : 'the morning summary'}. Turn it off in Settings → Notifications → Digests (${settingsUrl}).`].join('\n')
  const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]!)
  const htmlBody = `<!doctype html><html><body style="margin:0;background:#0b0b10;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#f4f4f7">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:520px;background:#15151d;border-radius:20px;padding:28px">
<tr><td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#9a9ab0">Modula</td></tr>
<tr><td style="font-size:24px;font-weight:700;padding:8px 0 16px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;color:#d6d6e0">${escape(greeting)}<br>${escape(intro)}</td></tr>
<tr><td style="padding:16px 0"><ul style="margin:0;padding-left:20px;font-size:15px;line-height:1.8">${lines.map(line => `<li>${escape(line)}</li>`).join('')}</ul></td></tr>
<tr><td><a href="${escape(input.webUrl)}" style="display:inline-block;background:#f4f4f7;color:#0b0b10;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:999px">Open Modula</a></td></tr>
<tr><td style="font-size:12px;color:#7a7a90;padding-top:24px">You get this because you turned on ${kind === 'weekly' ? 'the weekly digest' : 'the morning summary'}. Turn it off in Settings → Notifications → Digests.</td></tr>
</table></td></tr></table></body></html>`
  return {subject, textBody, htmlBody}
}

type Candidate = {account_id: string; preferences: Record<string, unknown>; email: string | null; display_name: string | null; handle: string; quiet_hours: unknown}

/** True while the member's quiet hours (Settings → Notifications → Quiet Hours) are on. */
export function inQuietHours(quietHours: unknown, now: Date): boolean {
  if (!quietHours || typeof quietHours !== 'object') return false
  const value = quietHours as {enabled?: unknown; start?: unknown; end?: unknown; timezone?: unknown}
  if (value.enabled !== true || typeof value.start !== 'string' || typeof value.end !== 'string') return false
  const toMinutes = (clock: string) => {
    const match = /^(\d{1,2}):(\d{2})$/.exec(clock)
    if (!match) return null
    const hours = Number(match[1]), minutes = Number(match[2])
    return hours < 24 && minutes < 60 ? hours * 60 + minutes : null
  }
  const start = toMinutes(value.start), end = toMinutes(value.end)
  if (start === null || end === null || start === end) return false
  let zone = typeof value.timezone === 'string' ? value.timezone : 'UTC'
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', {timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(now)
  } catch {
    zone = 'UTC'
    parts = new Intl.DateTimeFormat('en-GB', {timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'}).formatToParts(now)
  }
  const minute = Number(parts.find(p => p.type === 'hour')?.value ?? 0) * 60 + Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return start < end ? minute >= start && minute < end : minute >= start || minute < end
}

/**
 * One digest pass: for every member who turned a digest on, compose at most one
 * mail per period. The delivery row is claimed first (ON CONFLICT DO NOTHING) so
 * concurrent workers never send twice. Quiet periods are recorded, not mailed.
 */
export async function runDigestPass(db: Kysely<Database>, options: {now?: Date; webUrl?: string; limit?: number} = {}) {
  const now = options.now ?? new Date()
  const webUrl = options.webUrl ?? process.env.MODULA_PUBLIC_WEB_URL ?? 'https://modula.digital'
  const candidates = await sql<Candidate>`
    SELECT p.account_id, p.preferences, a.primary_handle AS handle,
      (SELECT i.identifier FROM greenfield_auth_identities i WHERE i.account_id = p.account_id AND i.kind = 'email' AND i.verified_at IS NOT NULL ORDER BY i.created_at LIMIT 1) AS email,
      (SELECT pr.display_name FROM profiles pr JOIN actors ac ON ac.id = pr.actor_id WHERE ac.account_id = p.account_id AND pr.deleted_at IS NULL LIMIT 1) AS display_name,
      (SELECT np.quiet_hours FROM notification_preferences np JOIN actors ac ON ac.id = np.actor_id WHERE ac.account_id = p.account_id LIMIT 1) AS quiet_hours
    FROM greenfield_account_app_preferences p
    JOIN greenfield_accounts a ON a.account_id = p.account_id AND a.status = 'active'
    WHERE (p.preferences->>'digests.weekly') = 'true' OR (p.preferences->>'digests.morning') = 'true'
    LIMIT ${options.limit ?? 500}`.execute(db)
  const result = {considered: candidates.rows.length, queued: 0, quiet: 0, noEmail: 0, held: 0}
  for (const candidate of candidates.rows) {
    // Held, not skipped: the period is claimed on a later pass once quiet hours end.
    if (inQuietHours(candidate.quiet_hours, now)) {
      result.held += 1
      continue
    }
    const zone = typeof candidate.preferences['digests.timeZone'] === 'string' ? candidate.preferences['digests.timeZone'] as string : 'UTC'
    const clock = localClock(now, zone)
    for (const kind of ['morning', 'weekly'] as const) {
      if (candidate.preferences[`digests.${kind}`] !== true) continue
      const period = duePeriod(kind, clock)
      if (!period) continue
      const outcome = await deliver(db, candidate, kind, period, now, webUrl)
      if (outcome === 'queued') result.queued += 1
      else if (outcome === 'quiet') result.quiet += 1
      else if (outcome === 'no-email') result.noEmail += 1
    }
  }
  return result
}

async function deliver(db: Kysely<Database>, candidate: Candidate, kind: DigestKind, period: string, now: Date, webUrl: string) {
  return db.transaction().execute(async trx => {
    const claimed = await sql<{account_id: string}>`
      INSERT INTO greenfield_digest_deliveries (account_id, digest_kind, period_key, outcome, created_at)
      VALUES (${candidate.account_id}, ${kind}, ${period}, 'quiet', ${now})
      ON CONFLICT DO NOTHING RETURNING account_id`.execute(trx)
    if (claimed.rows.length === 0) return 'already'
    if (!candidate.email) {
      await sql`UPDATE greenfield_digest_deliveries SET outcome = 'no-email' WHERE account_id = ${candidate.account_id} AND digest_kind = ${kind} AND period_key = ${period}`.execute(trx)
      return 'no-email'
    }
    const since = new Date(now.getTime() - (kind === 'weekly' ? 7 : 1) * 86_400_000)
    const summary = await collectSummary(trx, candidate.account_id, since)
    if (isQuiet(summary)) {
      await sql`UPDATE greenfield_digest_deliveries SET summary = ${JSON.stringify(summary)}::jsonb WHERE account_id = ${candidate.account_id} AND digest_kind = ${kind} AND period_key = ${period}`.execute(trx)
      return 'quiet'
    }
    const rendered = renderDigest(kind, {displayName: candidate.display_name || candidate.handle, summary, webUrl, periodLabel: period})
    const email = candidate.email.trim().toLowerCase()
    const [local = '', domain = 'unknown'] = email.split('@')
    const mailJobId = `mail-${randomUUID()}`
    const templateId = kind === 'weekly' ? 'digest-weekly' : 'digest-morning'
    const correlationId = `digest-${kind}-${period}`
    await sql`
      INSERT INTO greenfield_mail_jobs (mail_job_id, template_id, recipient_account_id, recipient_address, recipient_hash, recipient_domain, recipient_safe, locale, variables, subject, text_body, html_body, status, attempt_count, maximum_attempts, correlation_id, available_at, queued_at, created_at, updated_at)
      VALUES (${mailJobId}, ${templateId}, ${candidate.account_id}, ${email}, ${createHash('sha256').update(email).digest('hex')}, ${domain}, ${`${local.slice(0, 2)}${local.length > 2 ? '***' : '*'}@${domain}`}, 'en', ${JSON.stringify({kind, period, ...summary})}::jsonb, ${rendered.subject}, ${rendered.textBody}, ${rendered.htmlBody}, 'queued', 0, 4, ${correlationId}, ${now}, ${now}, ${now}, ${now})`.execute(trx)
    await sql`
      INSERT INTO background_jobs (id, job_type, payload, status, action, trace_id, priority, available_at, attempt_count, maximum_attempts, created_at, updated_at)
      VALUES (${`job-${mailJobId}`}, 'mail.deliver', ${JSON.stringify({mailJobId, templateId, correlationId})}::jsonb, 'QUEUED', 'mail.deliver', ${correlationId}, 20, ${now}, 0, 4, ${now}, ${now})`.execute(trx)
    await sql`UPDATE greenfield_digest_deliveries SET outcome = 'queued', mail_job_id = ${mailJobId}, summary = ${JSON.stringify(summary)}::jsonb WHERE account_id = ${candidate.account_id} AND digest_kind = ${kind} AND period_key = ${period}`.execute(trx)
    return 'queued'
  })
}

async function collectSummary(db: Kysely<Database>, accountId: string, since: Date): Promise<DigestSummary> {
  const row = await sql<{likes: string; reactions: string; comments: string; followers: string; mentions: string; unread: string}>`
    WITH me AS (SELECT id FROM actors WHERE account_id = ${accountId}),
    mine AS (SELECT id FROM posts WHERE author_actor_id IN (SELECT id FROM me) AND deleted_at IS NULL)
    SELECT
      (SELECT count(*) FROM post_likes WHERE post_id IN (SELECT id FROM mine) AND deleted_at IS NULL AND actor_id NOT IN (SELECT id FROM me) AND created_at >= ${since}) AS likes,
      (SELECT count(*) FROM greenfield_reactions WHERE post_id IN (SELECT id FROM mine) AND actor_id NOT IN (SELECT id FROM me) AND created_at >= ${since}) AS reactions,
      (SELECT count(*) FROM greenfield_comments WHERE post_id IN (SELECT id FROM mine) AND deleted_at IS NULL AND author_actor_id NOT IN (SELECT id FROM me) AND created_at >= ${since}) AS comments,
      (SELECT count(*) FROM follows WHERE followed_actor_id IN (SELECT id FROM me) AND deleted_at IS NULL AND created_at >= ${since}) AS followers,
      (SELECT count(*) FROM notifications WHERE recipient_actor_id IN (SELECT id FROM me) AND type = 'mention' AND deleted_at IS NULL AND created_at >= ${since}) AS mentions,
      (SELECT count(*) FROM notifications WHERE recipient_actor_id IN (SELECT id FROM me) AND read_at IS NULL AND deleted_at IS NULL AND created_at >= ${since}) AS unread`.execute(db)
  const value = row.rows[0]
  return {
    likes: Number(value?.likes ?? 0),
    reactions: Number(value?.reactions ?? 0),
    comments: Number(value?.comments ?? 0),
    newFollowers: Number(value?.followers ?? 0),
    mentions: Number(value?.mentions ?? 0),
    unreadNotifications: Number(value?.unread ?? 0),
  }
}
