import {randomUUID} from 'node:crypto'
import {sql, type Selectable, type Transaction} from 'kysely'
import {
  PUBLISHER_RELEASE_JOB_IN_FLIGHT_STATES,
  type PublisherConsoleErrorCode,
  type PublisherReleaseJob,
  type PublisherReleaseJobLogEntry,
  type PublisherReleaseJobLogLevel,
  type PublisherReleaseJobState,
} from '@modula/greenfield-module-registry-contracts'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'

export const RELEASE_JOB_DISPATCH_MODE = 'PUBLISHER_RELEASE_RUNNER' as const
export const RELEASE_JOB_SERVICE_ID = 'service.publisher-release-runner'
export const RELEASE_JOB_VALIDATE = 'publisher.release-job.validate'
export const RELEASE_JOB_PUBLISH = 'publisher.release-job.publish'
export type ReleaseJobWorkType = typeof RELEASE_JOB_VALIDATE | typeof RELEASE_JOB_PUBLISH

export const IN_FLIGHT_STATES: readonly PublisherReleaseJobState[] = PUBLISHER_RELEASE_JOB_IN_FLIGHT_STATES

export class PublisherConsoleError extends Error {
  constructor(readonly code: PublisherConsoleErrorCode, message: string, readonly details: Record<string, unknown> = {}) {
    super(message)
    this.name = 'PublisherConsoleError'
  }
}

export function consoleError(code: PublisherConsoleErrorCode, message: string, details: Record<string, unknown> = {}): never {
  throw new PublisherConsoleError(code, message, details)
}

export type ReleaseJobRow = Selectable<Database['greenfield_publisher_release_jobs']>

type Executor = ModulaDb | Transaction<Database>

export function isUniqueViolation(error: unknown, index?: string): boolean {
  const e = error as {code?: string; constraint?: string}
  return e?.code === '23505' && (!index || e.constraint === index)
}

export async function appendLog(db: Executor, jobId: string, level: PublisherReleaseJobLogLevel, step: string | null, message: string): Promise<void> {
  await db.insertInto('greenfield_publisher_release_job_logs').values({
    job_id: jobId,
    level,
    step,
    message: message.replace(/[\r\n\t]+/g, ' ').slice(0, 2000) || '(empty)',
  } as never).execute()
}

/** Enqueues runner work on the existing background_jobs queue. Never executes it. */
export async function enqueueReleaseJobWork(db: Executor, input: {jobId: string; workType: ReleaseJobWorkType; accountId: string; moduleId: string}): Promise<string> {
  const now = new Date()
  const id = `job-${randomUUID()}`
  await db.insertInto('background_jobs').values({
    id,
    job_type: input.workType,
    payload: {releaseJobId: input.jobId},
    status: 'QUEUED',
    priority: 50,
    available_at: now,
    lease_owner: null,
    lease_expires_at: null,
    attempt_count: 0,
    maximum_attempts: 3,
    last_error: null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    owner_type: 'account',
    owner_id: input.accountId,
    owner_account_id: input.accountId,
    product_id: input.moduleId,
    action: input.workType,
    service_id: RELEASE_JOB_SERVICE_ID,
    dispatch_mode: RELEASE_JOB_DISPATCH_MODE,
    timeout_ms: 600_000,
    trace_id: input.jobId,
  } as never).execute()
  return id
}

/**
 * Optimistic, state-guarded transition. Returns the updated row, or undefined
 * when the job is no longer in one of `from` (e.g. it was cancelled meanwhile).
 */
export async function transitionJob(
  db: Executor,
  jobId: string,
  from: readonly string[],
  to: PublisherReleaseJobState,
  patch: Partial<Record<keyof ReleaseJobRow, unknown>> = {},
  expectedRevision?: number,
): Promise<ReleaseJobRow | undefined> {
  const now = new Date()
  const values: Record<string, unknown> = {...patch, state: to, updated_at: now, revision: sql`revision + 1`}
  for (const key of ['preview', 'signature', 'validation', 'permission_delta', 'error'] as const) {
    if (key in values && values[key] !== null && values[key] !== undefined && typeof values[key] === 'object' && !('toOperationNode' in (values[key] as object))) {
      values[key] = sql`${JSON.stringify(values[key])}::jsonb`
    }
  }
  if (to === 'cancelled' && !('cancelled_at' in values)) values.cancelled_at = now
  if (to !== 'cancelled') values.cancelled_at = null
  let query = db.updateTable('greenfield_publisher_release_jobs').set(values as never).where('job_id', '=', jobId).where('state', 'in', [...from])
  if (expectedRevision !== undefined) query = query.where('revision', '=', expectedRevision)
  return query.returningAll().executeTakeFirst() as Promise<ReleaseJobRow | undefined>
}

export async function loadJob(db: Executor, jobId: string): Promise<ReleaseJobRow | undefined> {
  return db.selectFrom('greenfield_publisher_release_jobs').selectAll().where('job_id', '=', jobId).executeTakeFirst() as Promise<ReleaseJobRow | undefined>
}

export async function loadLogs(db: Executor, jobId: string, options: {after?: number; limit?: number; tail?: boolean} = {}): Promise<PublisherReleaseJobLogEntry[]> {
  const limit = Math.max(1, Math.min(500, options.limit ?? 200))
  let query = db.selectFrom('greenfield_publisher_release_job_logs').selectAll().where('job_id', '=', jobId)
  if (options.after !== undefined) query = query.where('log_id', '>', options.after)
  const rows = options.tail
    ? (await query.orderBy('log_id', 'desc').limit(limit).execute()).reverse()
    : await query.orderBy('log_id', 'asc').limit(limit).execute()
  return rows.map(row => ({
    sequence: Number(row.log_id),
    at: new Date(row.created_at as unknown as Date).toISOString(),
    level: row.level,
    step: row.step,
    message: row.message,
  }))
}

export function toJobDto(row: ReleaseJobRow, logSummary: PublisherReleaseJobLogEntry[]): PublisherReleaseJob {
  const state = row.state as PublisherReleaseJobState
  const preview = (row.preview && Object.keys(row.preview as object).length ? row.preview : {
    identity: {moduleId: row.module_id, name: null, publisherId: row.publisher_id},
    version: row.version,
    channel: row.channel,
    permissions: [],
    digests: {package: row.artifact_sha256, manifest: null, productManifest: null, frontend: null},
    commit: row.source_commit,
    releaseTag: row.release_tag,
  }) as PublisherReleaseJob['preview']
  const signature = (row.signature ?? {state: 'pending'}) as PublisherReleaseJob['signature']
  const validation = (row.validation ?? {passed: false, checks: []}) as PublisherReleaseJob['validation']
  const cancelledFrom = row.cancelled_from_state as PublisherReleaseJobState | null
  return {
    jobId: row.job_id,
    moduleId: row.module_id,
    publisherId: row.publisher_id,
    state,
    sourceRepository: row.source_repository,
    releaseTag: row.release_tag,
    sourceCommit: row.source_commit,
    version: row.version,
    channel: row.channel,
    artifactSha256: row.artifact_sha256,
    releaseId: row.release_id,
    preview,
    signature,
    validation,
    permissionDelta: (row.permission_delta ?? null) as PublisherReleaseJob['permissionDelta'],
    permissionChangeAcknowledged: Boolean(row.permission_change_acknowledged),
    error: (row.error ?? null) as PublisherReleaseJob['error'],
    cancelledFromState: state === 'cancelled' ? cancelledFrom : null,
    logSummary,
    actions: {
      canValidate: ['created', 'signature_missing', 'signature_invalid', 'validation_failed', 'failed'].includes(state),
      canPublish: state === 'ready_for_review' && validation.passed === true && signature.state === 'verified',
      canCancel: !['published', 'cancelled', 'conflicted'].includes(state) && !(state === 'publishing' && row.publish_started_at),
      canResume: state === 'cancelled' && ['created', 'fetching', 'validating', 'signature_verified', 'ready_for_review', 'publishing'].includes(cancelledFrom ?? ''),
    },
    createdByAccountId: row.created_by_account_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    revision: Number(row.revision),
  }
}
