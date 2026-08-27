import {createHash} from 'node:crypto'
import type {Selectable, Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {BackgroundJobStatus, Database, EventDataClassification} from '../database/types.js'
import {GreenfieldDomainEventRepository} from '../events/domain-events.js'
import {uuidv7} from '../lib/uuidv7.js'
import type {ResolvedServiceAssertion} from '../modules/backend/token-service.js'
import {moduleError} from '../modules/module-errors.js'
import type {GreenfieldModuleRuntimeContext} from '../modules/runtime-access.js'

const MAX_EVENT_BYTES = 128 * 1024
const MAX_JOB_INPUT_BYTES = 256 * 1024
const MAX_PAYLOAD_DEPTH = 12
const TERMINAL_STATES = new Set<BackgroundJobStatus>(['SUCCEEDED', 'FAILED', 'CANCELLED', 'DEAD_LETTER'])

export type BackendEventPublishInput = {
  eventId: string
  eventType: string
  schemaVersion: string
  producer: string
  accountId: string | null
  installationId: string | null
  occurredAt: string
  traceId: string
  classification: EventDataClassification
  payload: Record<string, unknown>
}

export type BackendJobEnqueueInput = {
  jobId: string
  ownerAccountId: string
  productId: string
  installationId: string
  action: string
  serviceId: string
  maximumAttempts: number
  timeoutMs: number
  idempotencyKey: string
  traceId: string
  input: unknown
}

export type BackendJobClaimInput = {
  actions?: string[]
  maxJobs?: number
  leaseDurationMs?: number
}

export class GreenfieldBackendEventJobService {
  constructor(private readonly db: ModulaDb) {}

  async publishEvent(
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
    input: BackendEventPublishInput,
  ): Promise<{accepted: true; eventId: string}> {
    assertEventScope(assertion, runtime, input)
    validatePayload(input.payload, MAX_EVENT_BYTES, 'event payload')
    const occurredAt = parseEventTime(input.occurredAt)
    const record = await this.db.transaction().execute(async trx => {
      const appended = await new GreenfieldDomainEventRepository(trx).append({
        eventId: input.eventId,
        eventType: input.eventType,
        eventVersion: input.schemaVersion,
        aggregateType: 'moduleEvent',
        aggregateId: input.eventId,
        accountId: assertion.accountId,
        actorId: assertion.actorId,
        producerKind: 'service',
        producerId: assertion.targetServiceId,
        productId: runtime.moduleId,
        installationId: runtime.installationId,
        releaseId: runtime.releaseId,
        traceId: input.traceId,
        requestId: assertion.requestId,
        correlationId: assertion.traceId,
        idempotencyKey: input.eventId,
        visibility: visibilityFor(input.classification),
        classification: input.classification,
        payload: input.payload,
        metadata: {serviceAssertionJti: assertion.jti, schemaVersion: input.schemaVersion},
        occurredAt,
      })
      if (
        appended.eventId !== input.eventId
        || appended.eventVersion !== input.schemaVersion
        || appended.accountId !== assertion.accountId
        || appended.producerId !== assertion.targetServiceId
        || appended.productId !== runtime.moduleId
        || appended.installationId !== runtime.installationId
        || appended.releaseId !== runtime.releaseId
        || appended.traceId !== input.traceId
        || fingerprint(appended.payload) !== fingerprint(input.payload)
      ) throw moduleError('CONFLICT', 'Event identity is already bound to different provenance or payload')
      return appended
    })
    return {accepted: true, eventId: record.eventId}
  }

  async enqueueJob(
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
    input: BackendJobEnqueueInput,
  ) {
    assertJobScope(assertion, runtime, input)
    validatePayload(input.input, MAX_JOB_INPUT_BYTES, 'job input')
    await this.requireDeclaredJob(runtime, input.action)
    const now = new Date()
    try {
      const row = await this.db
        .insertInto('background_jobs')
        .values({
          id: input.jobId,
          job_type: 'module.service.job',
          payload: input.input,
          status: 'QUEUED',
          priority: 100,
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          attempt_count: 0,
          maximum_attempts: input.maximumAttempts,
          last_error: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
          owner_type: 'account',
          owner_id: assertion.accountId,
          owner_account_id: assertion.accountId,
          product_id: runtime.moduleId,
          installation_id: runtime.installationId,
          release_id: runtime.releaseId,
          action: input.action,
          service_id: assertion.targetServiceId,
          dispatch_mode: 'SERVICE_PULL',
          timeout_ms: input.timeoutMs,
          idempotency_key: input.idempotencyKey,
          trace_id: input.traceId,
          started_at: null,
          finished_at: null,
          result_reference: null,
          error_class: null,
          error_code: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow()
      return jobView(row)
    } catch (error: unknown) {
      if (!isUniqueViolation(error)) throw error
      const existing = await this.scopedJob(assertion, runtime, input.jobId)
        ?? await this.db
          .selectFrom('background_jobs')
          .selectAll()
          .where('dispatch_mode', '=', 'SERVICE_PULL')
          .where('owner_account_id', '=', assertion.accountId)
          .where('product_id', '=', runtime.moduleId)
          .where('installation_id', '=', runtime.installationId)
          .where('action', '=', input.action)
          .where('idempotency_key', '=', input.idempotencyKey)
          .executeTakeFirst()
      if (
        !existing
        || existing.id !== input.jobId
        || existing.release_id !== runtime.releaseId
        || existing.service_id !== assertion.targetServiceId
        || existing.trace_id !== input.traceId
        || fingerprint(existing.payload) !== fingerprint(input.input)
      ) {
        throw moduleError('CONFLICT', 'Job identity or idempotency key is already bound to different input')
      }
      return jobView(existing)
    }
  }

  async claimJobs(
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
    input: BackendJobClaimInput,
  ): Promise<{jobs: ReturnType<typeof jobView>[]}> {
    const actions = input.actions === undefined ? undefined : boundedActions(input.actions)
    const maxJobs = boundedInteger(input.maxJobs ?? 1, 1, 10, 'maxJobs')
    const requestedLease = boundedInteger(input.leaseDurationMs ?? 60_000, 5_000, 900_000, 'leaseDurationMs')
    return this.db.transaction().execute(async trx => {
      await this.reapExpiredServiceJobs(trx, assertion, runtime)
      const registeredActions = (await trx
        .selectFrom('greenfield_module_job_registrations')
        .select('job_key')
        .where('installation_id', '=', runtime.installationId)
        .where('account_id', '=', runtime.accountId)
        .where('release_id', '=', runtime.releaseId)
        .where('module_id', '=', runtime.moduleId)
        .where('paused', '=', false)
        .where('status', '=', 'registered')
        .execute()).map(row => row.job_key)
      if (actions?.some(action => !registeredActions.includes(action))) throw moduleError('FORBIDDEN', 'Claim requested an undeclared, paused or unavailable job action')
      const eligibleActions = actions ?? registeredActions
      if (eligibleActions.length === 0) return {jobs: []}
      const query = trx
        .selectFrom('background_jobs')
        .selectAll()
        .where('dispatch_mode', '=', 'SERVICE_PULL')
        .where('owner_account_id', '=', assertion.accountId)
        .where('product_id', '=', runtime.moduleId)
        .where('installation_id', '=', runtime.installationId)
        .where('release_id', '=', runtime.releaseId)
        .where('service_id', '=', assertion.targetServiceId)
        .where('action', 'in', eligibleActions)
        .where('status', 'in', ['QUEUED', 'RETRYING'])
        .where('available_at', '<=', new Date())
      const available = await query.orderBy('priority').orderBy('created_at').limit(maxJobs).forUpdate().skipLocked().execute()
      const claimed = []
      for (const job of available) {
        const now = new Date()
        const leaseDurationMs = Math.min(900_000, Math.max(requestedLease, job.timeout_ms + 5_000))
        const row = await trx
          .updateTable('background_jobs')
          .set({
            status: 'LEASED',
            lease_owner: assertion.targetServiceId,
            lease_expires_at: new Date(now.getTime() + leaseDurationMs),
            attempt_count: job.attempt_count + 1,
            updated_at: now,
          })
          .where('id', '=', job.id)
          .returningAll()
          .executeTakeFirstOrThrow()
        claimed.push(jobView(row))
      }
      return {jobs: claimed}
    })
  }

  async startJob(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, jobId: string) {
    const existing = await this.requireScopedJob(assertion, runtime, jobId)
    requireLiveLease(existing, assertion.targetServiceId)
    if (existing.status === 'RUNNING') return jobView(existing)
    if (existing.status !== 'LEASED') throw moduleError('CONFLICT', `Job cannot start from ${existing.status}`)
    const now = new Date()
    const row = await this.db
      .updateTable('background_jobs')
      .set({
        status: 'RUNNING',
        started_at: now,
        lease_expires_at: new Date(now.getTime() + Math.min(existing.timeout_ms + 5_000, 900_000)),
        updated_at: now,
      })
      .where('id', '=', existing.id)
      .where('status', '=', 'LEASED')
      .returningAll()
      .executeTakeFirst()
    if (!row) throw moduleError('CONFLICT', 'Job lease changed before it could start')
    return jobView(row)
  }

  async succeedJob(
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
    jobId: string,
    resultReference: string | null,
  ) {
    const existing = await this.requireScopedJob(assertion, runtime, jobId)
    if (existing.status === 'SUCCEEDED') {
      if (existing.result_reference !== resultReference) throw moduleError('CONFLICT', 'Job already succeeded with a different result reference')
      return jobResultView(existing)
    }
    if (existing.status !== 'RUNNING') throw moduleError('CONFLICT', `Job cannot succeed from ${existing.status}`)
    requireLiveLease(existing, assertion.targetServiceId)
    validateResultReference(resultReference)
    const now = new Date()
    const row = await this.db
      .updateTable('background_jobs')
      .set({
        status: 'SUCCEEDED',
        result_reference: resultReference,
        finished_at: now,
        completed_at: now,
        last_error: null,
        error_class: null,
        error_code: null,
        lease_owner: null,
        lease_expires_at: null,
        updated_at: now,
      })
      .where('id', '=', existing.id)
      .where('status', '=', 'RUNNING')
      .returningAll()
      .executeTakeFirst()
    if (!row) throw moduleError('CONFLICT', 'Job state changed before completion')
    return jobResultView(row)
  }

  async failJob(
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
    jobId: string,
    errorClass: string,
    retryable: boolean,
  ) {
    const existing = await this.requireScopedJob(assertion, runtime, jobId)
    if (existing.status === 'RETRYING' || existing.status === 'FAILED' || existing.status === 'DEAD_LETTER') return jobView(existing)
    if (existing.status !== 'RUNNING' && existing.status !== 'LEASED') throw moduleError('CONFLICT', `Job cannot fail from ${existing.status}`)
    requireLiveLease(existing, assertion.targetServiceId)
    const safeErrorClass = boundedErrorClass(errorClass)
    const terminalState: Extract<BackgroundJobStatus, 'FAILED' | 'DEAD_LETTER'> | null = !retryable
      ? 'FAILED'
      : existing.attempt_count >= existing.maximum_attempts
        ? 'DEAD_LETTER'
        : null
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const row = await trx
        .updateTable('background_jobs')
        .set({
          status: terminalState ?? 'RETRYING',
          available_at: terminalState ? existing.available_at : new Date(now.getTime() + retryDelayMs(existing.attempt_count)),
          last_error: `Module backend reported ${safeErrorClass}`,
          error_class: safeErrorClass,
          error_code: safeErrorClass,
          finished_at: terminalState ? now : null,
          completed_at: terminalState ? now : null,
          lease_owner: null,
          lease_expires_at: null,
          updated_at: now,
        })
        .where('id', '=', existing.id)
        .where('status', 'in', ['RUNNING', 'LEASED'])
        .returningAll()
        .executeTakeFirst()
      if (!row) throw moduleError('CONFLICT', 'Job state changed before failure was recorded')
      if (terminalState) await insertRedactedFailure(trx, row, safeErrorClass, !retryable, now)
      return jobView(row)
    })
  }

  async cancelJob(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, jobId: string) {
    const existing = await this.requireScopedJob(assertion, runtime, jobId)
    if (existing.status === 'CANCELLED') return {cancelled: true}
    if (existing.status !== 'QUEUED' && existing.status !== 'RETRYING') throw moduleError('CONFLICT', `Job cannot be cancelled from ${existing.status}`)
    const now = new Date()
    const result = await this.db
      .updateTable('background_jobs')
      .set({status: 'CANCELLED', finished_at: now, completed_at: now, updated_at: now})
      .where('id', '=', existing.id)
      .where('status', 'in', ['QUEUED', 'RETRYING'])
      .executeTakeFirst()
    return {cancelled: Number(result.numUpdatedRows) === 1}
  }

  async jobResult(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, jobId: string) {
    const row = await this.requireScopedJob(assertion, runtime, jobId)
    if (!TERMINAL_STATES.has(row.status)) throw moduleError('CONFLICT', `Job result is not available while state is ${row.status}`)
    return jobResultView(row)
  }

  private async requireDeclaredJob(runtime: GreenfieldModuleRuntimeContext, action: string): Promise<void> {
    const registration = await this.db
      .selectFrom('greenfield_module_job_registrations')
      .select(['job_registration_id', 'paused', 'status'])
      .where('installation_id', '=', runtime.installationId)
      .where('account_id', '=', runtime.accountId)
      .where('release_id', '=', runtime.releaseId)
      .where('module_id', '=', runtime.moduleId)
      .where('job_key', '=', action)
      .executeTakeFirst()
    if (!registration) throw moduleError('FORBIDDEN', 'Job action is not declared by the installed release')
    if (registration.paused || registration.status !== 'registered') throw moduleError('CAPABILITY_DISABLED', 'Job action is paused or unavailable')
  }

  private async requireScopedJob(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, jobId: string) {
    const row = await this.scopedJob(assertion, runtime, jobId)
    if (!row) throw moduleError('NOT_FOUND', 'Job not found in this service scope')
    return row
  }

  private scopedJob(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, jobId: string) {
    return this.db
      .selectFrom('background_jobs')
      .selectAll()
      .where('id', '=', jobId)
      .where('dispatch_mode', '=', 'SERVICE_PULL')
      .where('owner_account_id', '=', assertion.accountId)
      .where('product_id', '=', runtime.moduleId)
      .where('installation_id', '=', runtime.installationId)
      .where('release_id', '=', runtime.releaseId)
      .where('service_id', '=', assertion.targetServiceId)
      .executeTakeFirst()
  }

  private async reapExpiredServiceJobs(
    trx: Transaction<Database>,
    assertion: ResolvedServiceAssertion,
    runtime: GreenfieldModuleRuntimeContext,
  ): Promise<void> {
    const now = new Date()
    const expired = await trx
      .selectFrom('background_jobs')
      .selectAll()
      .where('dispatch_mode', '=', 'SERVICE_PULL')
      .where('owner_account_id', '=', assertion.accountId)
      .where('product_id', '=', runtime.moduleId)
      .where('installation_id', '=', runtime.installationId)
      .where('release_id', '=', runtime.releaseId)
      .where('service_id', '=', assertion.targetServiceId)
      .where('status', 'in', ['LEASED', 'RUNNING'])
      .where('lease_expires_at', '<=', now)
      .limit(100)
      .forUpdate()
      .skipLocked()
      .execute()
    for (const job of expired) {
      const deadLetter = job.attempt_count >= job.maximum_attempts
      const row = await trx
        .updateTable('background_jobs')
        .set({
          status: deadLetter ? 'DEAD_LETTER' : 'RETRYING',
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          last_error: 'Module backend lease expired before completion',
          error_class: 'SERVICE_LEASE_EXPIRED',
          error_code: 'SERVICE_LEASE_EXPIRED',
          finished_at: deadLetter ? now : null,
          completed_at: deadLetter ? now : null,
          updated_at: now,
        })
        .where('id', '=', job.id)
        .returningAll()
        .executeTakeFirstOrThrow()
      if (deadLetter) await insertRedactedFailure(trx, row, 'SERVICE_LEASE_EXPIRED', false, now)
    }
  }
}

function assertEventScope(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, input: BackendEventPublishInput): void {
  if (input.accountId !== assertion.accountId || input.installationId !== runtime.installationId) throw moduleError('FORBIDDEN', 'Event scope does not match the service assertion')
  if (input.producer !== assertion.targetServiceId) throw moduleError('FORBIDDEN', 'Event producer cannot impersonate another product or service')
  if (!/^[a-z][a-z0-9.-]{2,220}\.v[1-9][0-9]*$/.test(input.eventType)) throw moduleError('VALIDATION_FAILED', 'eventType must be a bounded, explicitly versioned event name')
  if (!/^\d+\.\d+\.\d+$/.test(input.schemaVersion)) throw moduleError('VALIDATION_FAILED', 'schemaVersion must use semantic versioning')
  boundedIdentifier(input.eventId, 'eventId')
  boundedIdentifier(input.traceId, 'traceId')
}

function assertJobScope(assertion: ResolvedServiceAssertion, runtime: GreenfieldModuleRuntimeContext, input: BackendJobEnqueueInput): void {
  if (input.ownerAccountId !== assertion.accountId || input.productId !== runtime.moduleId || input.installationId !== runtime.installationId || input.serviceId !== assertion.targetServiceId) {
    throw moduleError('FORBIDDEN', 'Job scope does not match the service assertion')
  }
  boundedIdentifier(input.jobId, 'jobId')
  boundedIdentifier(input.action, 'action')
  boundedIdentifier(input.idempotencyKey, 'idempotencyKey', 180)
  boundedIdentifier(input.traceId, 'traceId')
  boundedInteger(input.maximumAttempts, 1, 20, 'maximumAttempts')
  boundedInteger(input.timeoutMs, 1_000, 900_000, 'timeoutMs')
}

function jobView(row: Selectable<Database['background_jobs']>) {
  return {
    jobId: row.id,
    ownerAccountId: row.owner_account_id!,
    productId: row.product_id!,
    installationId: row.installation_id!,
    action: row.action,
    serviceId: row.service_id,
    state: row.status,
    attempt: row.attempt_count,
    maximumAttempts: row.maximum_attempts,
    timeoutMs: row.timeout_ms,
    idempotencyKey: row.idempotency_key!,
    traceId: row.trace_id,
    input: row.payload,
    createdAt: row.created_at.toISOString(),
    startedAt: row.started_at?.toISOString() ?? null,
    finishedAt: row.finished_at?.toISOString() ?? null,
  }
}

function jobResultView(row: Selectable<Database['background_jobs']>) {
  if (!row.finished_at) throw moduleError('CONFLICT', 'Terminal job is missing its finish timestamp')
  return {
    jobId: row.id,
    state: row.status,
    resultReference: row.result_reference,
    result: null,
    errorClass: row.error_class,
    finishedAt: row.finished_at.toISOString(),
  }
}

async function insertRedactedFailure(
  trx: Transaction<Database>,
  job: Selectable<Database['background_jobs']>,
  errorClass: string,
  permanent: boolean,
  now: Date,
): Promise<void> {
  await trx
    .insertInto('job_failures')
    .values({
      id: `jf_${job.id}_${job.attempt_count}`,
      job_id: job.id,
      job_type: job.job_type,
      payload: {},
      payload_fingerprint: `sha256:${fingerprint(job.payload)}`,
      error_code: errorClass,
      error_class: errorClass,
      error_message: `Module backend job failed with ${errorClass}`,
      permanent,
      created_at: now,
    })
    .onConflict(conflict => conflict.column('id').doNothing())
    .execute()
}

function validatePayload(value: unknown, maximumBytes: number, label: string): void {
  let serialized: string
  try {
    serialized = JSON.stringify(value)
  } catch {
    throw moduleError('VALIDATION_FAILED', `${label} must be valid JSON`)
  }
  if (Buffer.byteLength(serialized, 'utf8') > maximumBytes) throw moduleError('VALIDATION_FAILED', `${label} exceeds its byte limit`)
  if (payloadDepth(value) > MAX_PAYLOAD_DEPTH) throw moduleError('VALIDATION_FAILED', `${label} exceeds its nesting limit`)
  if (containsRawSecret(value)) throw moduleError('VALIDATION_FAILED', `${label} contains a raw credential; use a secret:// handle`)
}

function containsRawSecret(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsRawSecret)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    if (/(?:password|credential|api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|private[_-]?key|authorization|^secret$|^token$)/i.test(key)) {
      return typeof nested !== 'string' || !nested.startsWith('secret://')
    }
    return containsRawSecret(nested)
  })
}

function requireLiveLease(job: Selectable<Database['background_jobs']>, serviceId: string): void {
  if (job.lease_owner !== serviceId || !job.lease_expires_at || job.lease_expires_at.getTime() <= Date.now()) {
    throw moduleError('CONFLICT', 'Job lease is absent, expired or owned by another service')
  }
}

function payloadDepth(value: unknown, depth = 0): number {
  if (!value || typeof value !== 'object') return depth
  const nested = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>)
  return nested.length === 0 ? depth : Math.max(...nested.map(item => payloadDepth(item, depth + 1)))
}

function parseEventTime(value: string): Date {
  const occurredAt = new Date(value)
  const now = Date.now()
  if (Number.isNaN(occurredAt.getTime()) || occurredAt.getTime() > now + 5 * 60_000 || occurredAt.getTime() < now - 7 * 24 * 60 * 60_000) {
    throw moduleError('VALIDATION_FAILED', 'occurredAt must be a recent ISO timestamp')
  }
  return occurredAt
}

function visibilityFor(classification: EventDataClassification): 'account' | 'internal' | 'restricted' {
  if (classification === 'internal') return 'internal'
  if (classification === 'sensitive' || classification === 'restricted') return 'restricted'
  return 'account'
}

function boundedActions(values: string[]): string[] {
  if (!Array.isArray(values) || values.length < 1 || values.length > 20) throw moduleError('VALIDATION_FAILED', 'actions must contain 1 to 20 values')
  return Array.from(new Set(values.map(value => boundedIdentifier(value, 'action'))))
}

function boundedIdentifier(value: unknown, label: string, maximum = 240): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value) || value.length < 1 || value.length > maximum) {
    throw moduleError('VALIDATION_FAILED', `${label} must be a bounded identifier`)
  }
  return value
}

function boundedInteger(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw moduleError('VALIDATION_FAILED', `${label} must be an integer from ${minimum} to ${maximum}`)
  return value
}

function boundedErrorClass(value: string): string {
  return boundedIdentifier(value, 'errorClass', 120)
}

function validateResultReference(value: string | null): void {
  if (value === null) return
  if (!/^(?:greenfield|storage|object|service|artifact):\/\/[A-Za-z0-9._:/-]+$/.test(value) || value.length > 500) {
    throw moduleError('VALIDATION_FAILED', 'resultReference must use an approved opaque reference scheme')
  }
}

function retryDelayMs(attempt: number): number {
  return Math.min(15 * 60_000, 1_000 * 2 ** Math.min(Math.max(attempt - 1, 0), 9))
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value ?? null), 'utf8').digest('hex')
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as {code?: unknown}).code === '23505')
}
