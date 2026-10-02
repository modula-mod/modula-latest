import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'

/**
 * Public service status. Every value is measured from this deployment at request
 * time (database round trip, worker heartbeat age, queue age); nothing is
 * configured or simulated. Results are cached briefly so the public endpoint
 * cannot be used to put load on the database.
 */
export type ComponentState = 'operational' | 'degraded' | 'outage' | 'unknown'

export type StatusComponent = {
  id: 'api' | 'database' | 'worker' | 'jobs' | 'mail'
  name: string
  state: ComponentState
  latencyMs: number | null
  lastSeenAt: string | null
  ageSeconds: number | null
  pending: number | null
}

export type PublicStatus = {
  status: Exclude<ComponentState, 'unknown'>
  checkedAt: string
  release: {commit: string | null; builtAt: string | null}
  components: StatusComponent[]
}

export const WORKER_OPERATIONAL_SECONDS = 90
export const WORKER_DEGRADED_SECONDS = 600
export const QUEUE_OPERATIONAL_SECONDS = 180
export const QUEUE_DEGRADED_SECONDS = 1_800

export function workerState(lastSeenAt: Date | null, now: Date): {state: ComponentState; ageSeconds: number | null} {
  if (!lastSeenAt) return {state: 'unknown', ageSeconds: null}
  const age = Math.max(0, Math.round((now.getTime() - lastSeenAt.getTime()) / 1000))
  if (age <= WORKER_OPERATIONAL_SECONDS) return {state: 'operational', ageSeconds: age}
  if (age <= WORKER_DEGRADED_SECONDS) return {state: 'degraded', ageSeconds: age}
  return {state: 'outage', ageSeconds: age}
}

export function queueState(pending: number, oldestAvailableAt: Date | null, now: Date): {state: ComponentState; ageSeconds: number | null} {
  if (pending <= 0 || !oldestAvailableAt) return {state: 'operational', ageSeconds: 0}
  const age = Math.max(0, Math.round((now.getTime() - oldestAvailableAt.getTime()) / 1000))
  if (age <= QUEUE_OPERATIONAL_SECONDS) return {state: 'operational', ageSeconds: age}
  if (age <= QUEUE_DEGRADED_SECONDS) return {state: 'degraded', ageSeconds: age}
  return {state: 'outage', ageSeconds: age}
}

/** Worst state wins. `unknown` never upgrades or downgrades the overall status on its own. */
export function overallState(components: Array<Pick<StatusComponent, 'id' | 'state'>>): PublicStatus['status'] {
  const states = components.map(component => component.state)
  const core = components.filter(component => component.id === 'api' || component.id === 'database')
  if (core.some(component => component.state === 'outage')) return 'outage'
  if (states.includes('outage') || states.includes('degraded')) return 'degraded'
  return 'operational'
}

const CACHE_MS = 10_000
let cached: {at: number; value: PublicStatus} | null = null

export function resetPublicStatusCache() {
  cached = null
}

export async function collectPublicStatus(
  db: ModulaDb,
  release: {commit: string | null; builtAt: string | null},
  now: () => Date = () => new Date(),
): Promise<PublicStatus> {
  const started = Date.now()
  if (cached && started - cached.at < CACHE_MS) return cached.value

  const checkedAt = now()
  const components: StatusComponent[] = [
    {id: 'api', name: 'API', state: 'operational', latencyMs: null, lastSeenAt: checkedAt.toISOString(), ageSeconds: 0, pending: null},
  ]

  let databaseOk = false
  try {
    const t0 = performance.now()
    await sql`select 1`.execute(db)
    const latencyMs = Math.round(performance.now() - t0)
    databaseOk = true
    components.push({id: 'database', name: 'Database', state: latencyMs > 1_000 ? 'degraded' : 'operational', latencyMs, lastSeenAt: checkedAt.toISOString(), ageSeconds: 0, pending: null})
  } catch {
    components.push({id: 'database', name: 'Database', state: 'outage', latencyMs: null, lastSeenAt: null, ageSeconds: null, pending: null})
  }

  if (databaseOk) {
    const [heartbeat, jobs, mail] = await Promise.all([
      db.selectFrom('greenfield_worker_heartbeats').select(sql<Date | null>`max(last_seen_at)`.as('lastSeenAt')).executeTakeFirst().catch(() => null),
      db
        .selectFrom('background_jobs')
        .select([sql<string>`count(*)`.as('pending'), sql<Date | null>`min(available_at)`.as('oldest')])
        .where('status', 'in', ['QUEUED', 'RETRYING'])
        .where('available_at', '<=', checkedAt)
        .executeTakeFirst()
        .catch(() => null),
      db
        .selectFrom('greenfield_mail_jobs')
        .select([sql<string>`count(*)`.as('pending'), sql<Date | null>`min(available_at)`.as('oldest')])
        .where('status', 'in', ['queued', 'retrying'])
        .where('available_at', '<=', checkedAt)
        .executeTakeFirst()
        .catch(() => null),
    ])
    const seen = heartbeat?.lastSeenAt ? new Date(heartbeat.lastSeenAt) : null
    const worker = heartbeat ? workerState(seen, checkedAt) : {state: 'unknown' as const, ageSeconds: null}
    components.push({id: 'worker', name: 'Background worker', state: worker.state, latencyMs: null, lastSeenAt: seen?.toISOString() ?? null, ageSeconds: worker.ageSeconds, pending: null})
    for (const [id, name, row] of [['jobs', 'Job queue', jobs], ['mail', 'Email delivery', mail]] as const) {
      if (!row) {
        components.push({id, name, state: 'unknown', latencyMs: null, lastSeenAt: null, ageSeconds: null, pending: null})
        continue
      }
      const pending = Number(row.pending ?? 0)
      const queue = queueState(pending, row.oldest ? new Date(row.oldest) : null, checkedAt)
      components.push({id, name, state: queue.state, latencyMs: null, lastSeenAt: null, ageSeconds: queue.ageSeconds, pending})
    }
  } else {
    for (const [id, name] of [['worker', 'Background worker'], ['jobs', 'Job queue'], ['mail', 'Email delivery']] as const) {
      components.push({id, name, state: 'unknown', latencyMs: null, lastSeenAt: null, ageSeconds: null, pending: null})
    }
  }

  components[0]!.latencyMs = Math.round(Date.now() - started)
  const value: PublicStatus = {status: overallState(components), checkedAt: checkedAt.toISOString(), release, components}
  cached = {at: started, value}
  return value
}
