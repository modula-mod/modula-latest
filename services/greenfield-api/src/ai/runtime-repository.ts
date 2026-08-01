import {createHash, randomBytes} from 'node:crypto'
import type {GreenfieldAIUsageUnits} from '@modula/greenfield-contracts'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {
  AIExecutionStatus,
  AIProviderCredentialScopeType,
  AIProviderCredentialStatus,
  AIProviderHealthComponent,
  AIProviderHealthState,
  AIQuotaUnit,
  AIUsageLimitKind,
  AIUsageLimitScope,
  Database,
  GreenfieldAIStreamStatus,
} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from '../modules/module-errors.js'
import type {AIProviderCredentialPlaintext} from '../security/encryption/ai-provider-credentials.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type AIProviderCredentialRecord = Database['ai_provider_credentials']
export type AIExecutionRecord = Database['ai_executions']
export type AIStreamEventRecord = Database['ai_stream_events']

export type StoreAIProviderCredentialInput = {
  credentialId?: string
  providerId: string
  scopeType: AIProviderCredentialScopeType
  scopeId?: string | null
  encryptedPayload: Buffer
  encryptionKeyVersion: string
  nonce: Buffer
  authenticationTag: Buffer
  status?: AIProviderCredentialStatus
}

export type CreateAIExecutionInput = {
  executionId?: string
  requestId: string
  accountId: string
  actorId?: string | null
  moduleId: string
  installationId?: string | null
  providerId?: string | null
  modelId?: string | null
  promptId?: string | null
  promptVersion?: string | null
  streaming: boolean
  structuredOutput: boolean
  requestMetadata?: Record<string, unknown>
}

export type UpdateAIExecutionInput = {
  executionId: string
  status: AIExecutionStatus
  providerId?: string | null
  modelId?: string | null
  failureCode?: string | null
  responseMetadata?: Record<string, unknown>
}

export type CreateAIStreamInput = {
  streamId?: string
  executionId: string
  accountId: string
  actorId?: string | null
  moduleId: string
  installationId?: string | null
  lifetimeMs: number
}

export type AppendAIStreamEventInput = {
  streamId: string
  eventType: Database['ai_stream_events']['event_type']
  eventPayload?: Record<string, unknown>
  lifetimeMs: number
}

export type SetAIUsageLimitInput = {
  limitId?: string
  scopeType: AIUsageLimitScope
  scopeId?: string | null
  providerId?: string | null
  modelId?: string | null
  limitKind: AIUsageLimitKind
  unit: AIQuotaUnit
  windowSeconds: number
  limitValue: number
  enabled?: boolean
  metadata?: Record<string, unknown>
}

export class AIProviderRuntimeRepository {
  constructor(private readonly db: Db) {}

  async storeCredential(input: StoreAIProviderCredentialInput): Promise<AIProviderCredentialRecord> {
    const credentialId = input.credentialId ?? `ai-credential-${uuidv7()}`
    const now = new Date()
    await this.db
      .updateTable('ai_provider_credentials')
      .set({status: 'rotated', rotated_at: now, updated_at: now})
      .where('provider_id', '=', input.providerId)
      .where('scope_type', '=', input.scopeType)
      .where(input.scopeId === null || input.scopeId === undefined ? 'scope_id' : 'scope_id', input.scopeId === null || input.scopeId === undefined ? 'is' : '=', input.scopeId ?? null)
      .where('status', 'in', ['active', 'unverified', 'verification_failed'])
      .execute()
    return this.db
      .insertInto('ai_provider_credentials')
      .values({
        credential_id: credentialId,
        provider_id: input.providerId,
        scope_type: input.scopeType,
        scope_id: input.scopeId ?? null,
        encrypted_payload: input.encryptedPayload,
        encryption_key_version: input.encryptionKeyVersion,
        nonce: input.nonce,
        authentication_tag: input.authenticationTag,
        status: input.status ?? 'unverified',
        created_at: now,
        updated_at: now,
        rotated_at: null,
        last_verified_at: null,
        last_verification_code: null,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async activeCredential(providerId: string, scopeType: AIProviderCredentialScopeType, scopeId?: string | null): Promise<AIProviderCredentialRecord | null> {
    const row = await this.db
      .selectFrom('ai_provider_credentials')
      .selectAll()
      .where('provider_id', '=', providerId)
      .where('scope_type', '=', scopeType)
      .where(scopeId === null || scopeId === undefined ? 'scope_id' : 'scope_id', scopeId === null || scopeId === undefined ? 'is' : '=', scopeId ?? null)
      .where('status', 'in', ['active', 'unverified', 'verification_failed'])
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    return row ?? null
  }

  async markCredentialVerification(credentialId: string, status: AIProviderCredentialStatus, code: string): Promise<void> {
    await this.db
      .updateTable('ai_provider_credentials')
      .set({
        status,
        last_verified_at: new Date(),
        last_verification_code: code,
        updated_at: new Date(),
      })
      .where('credential_id', '=', credentialId)
      .execute()
  }

  async createExecution(input: CreateAIExecutionInput): Promise<AIExecutionRecord> {
    const now = new Date()
    const executionId = input.executionId ?? `ai-execution-${uuidv7()}`
    return this.db
      .insertInto('ai_executions')
      .values({
        execution_id: executionId,
        request_id: input.requestId,
        account_id: input.accountId,
        actor_id: input.actorId ?? null,
        module_id: input.moduleId,
        installation_id: input.installationId ?? null,
        provider_id: input.providerId ?? null,
        model_id: input.modelId ?? null,
        prompt_id: input.promptId ?? null,
        prompt_version: input.promptVersion ?? null,
        status: 'accepted',
        streaming: input.streaming,
        structured_output: input.structuredOutput,
        started_at: null,
        completed_at: null,
        cancelled_at: null,
        failed_at: null,
        failure_code: null,
        request_metadata: jsonb(input.requestMetadata ?? {}),
        response_metadata: jsonb({}),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  async updateExecution(input: UpdateAIExecutionInput): Promise<void> {
    const now = new Date()
    await this.db
      .updateTable('ai_executions')
      .set({
        status: input.status,
        provider_id: input.providerId,
        model_id: input.modelId,
        failure_code: input.failureCode ?? null,
        response_metadata: input.responseMetadata ? jsonb(input.responseMetadata) : undefined,
        started_at: input.status === 'running' ? now : undefined,
        completed_at: input.status === 'completed' ? now : undefined,
        failed_at: input.status === 'failed' ? now : undefined,
        cancelled_at: input.status === 'cancelled' ? now : undefined,
        updated_at: now,
      })
      .where('execution_id', '=', input.executionId)
      .execute()
  }

  async requireExecutionForAccount(executionId: string, accountId: string): Promise<AIExecutionRecord> {
    const row = await this.db
      .selectFrom('ai_executions')
      .selectAll()
      .where('execution_id', '=', executionId)
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'AI execution not found')
    return row
  }

  async listExecutions(limit = 100): Promise<AIExecutionRecord[]> {
    return this.db.selectFrom('ai_executions').selectAll().orderBy('created_at', 'desc').limit(limit).execute()
  }

  async createAttempt(input: {
    executionId: string
    providerId: string
    modelId: string
    attemptNumber: number
    requestMetadata?: Record<string, unknown>
  }): Promise<string> {
    const attemptId = `ai-attempt-${uuidv7()}`
    await this.db
      .insertInto('ai_execution_attempts')
      .values({
        attempt_id: attemptId,
        execution_id: input.executionId,
        provider_id: input.providerId,
        model_id: input.modelId,
        attempt_number: input.attemptNumber,
        status: 'running',
        started_at: new Date(),
        completed_at: null,
        latency_ms: null,
        failure_code: null,
        retryable: false,
        request_metadata: jsonb(input.requestMetadata ?? {}),
        response_metadata: jsonb({}),
      })
      .execute()
    return attemptId
  }

  async updateAttempt(input: {
    attemptId: string
    status: Database['ai_execution_attempts']['status']
    latencyMs?: number | null
    failureCode?: string | null
    retryable?: boolean
    responseMetadata?: Record<string, unknown>
  }): Promise<void> {
    await this.db
      .updateTable('ai_execution_attempts')
      .set({
        status: input.status,
        latency_ms: input.latencyMs ?? null,
        failure_code: input.failureCode ?? null,
        retryable: input.retryable ?? false,
        response_metadata: input.responseMetadata ? jsonb(input.responseMetadata) : undefined,
        completed_at: new Date(),
      })
      .where('attempt_id', '=', input.attemptId)
      .execute()
  }

  async createStreamSession(input: CreateAIStreamInput): Promise<{streamId: string; reconnectToken: string}> {
    const streamId = input.streamId ?? `ai-stream-${uuidv7()}`
    const reconnectToken = randomBytes(24).toString('base64url')
    const now = new Date()
    await this.db
      .insertInto('ai_stream_sessions')
      .values({
        stream_id: streamId,
        execution_id: input.executionId,
        account_id: input.accountId,
        actor_id: input.actorId ?? null,
        module_id: input.moduleId,
        installation_id: input.installationId ?? null,
        cursor: '0',
        reconnect_token_hash: sha256(reconnectToken),
        status: 'open',
        last_event_sequence: 0,
        expires_at: new Date(now.getTime() + input.lifetimeMs),
        cancellation_requested_at: null,
        created_at: now,
        updated_at: now,
        completed_at: null,
      })
      .execute()
    return {streamId, reconnectToken}
  }

  async appendStreamEvent(input: AppendAIStreamEventInput): Promise<AIStreamEventRecord> {
    const stream = await this.db
      .selectFrom('ai_stream_sessions')
      .select(['last_event_sequence', 'expires_at'])
      .where('stream_id', '=', input.streamId)
      .executeTakeFirstOrThrow()
    const sequence = stream.last_event_sequence + 1
    const event = await this.db
      .insertInto('ai_stream_events')
      .values({
        event_id: `ai-stream-event-${uuidv7()}`,
        stream_id: input.streamId,
        sequence,
        event_type: input.eventType,
        event_payload: jsonb(input.eventPayload ?? {}),
        created_at: new Date(),
        expires_at: new Date(Date.now() + input.lifetimeMs),
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    await this.db
      .updateTable('ai_stream_sessions')
      .set({last_event_sequence: sequence, cursor: String(sequence), updated_at: new Date()})
      .where('stream_id', '=', input.streamId)
      .execute()
    return event
  }

  async listStreamEvents(executionId: string, accountId: string, afterSequence = 0): Promise<AIStreamEventRecord[]> {
    const stream = await this.db
      .selectFrom('ai_stream_sessions')
      .select('stream_id')
      .where('execution_id', '=', executionId)
      .where('account_id', '=', accountId)
      .where('expires_at', '>', new Date())
      .executeTakeFirst()
    if (!stream) throw moduleError('NOT_FOUND', 'AI stream not found')
    return this.db
      .selectFrom('ai_stream_events')
      .selectAll()
      .where('stream_id', '=', stream.stream_id)
      .where('sequence', '>', afterSequence)
      .orderBy('sequence', 'asc')
      .execute()
  }

  async updateStreamSession(streamId: string, status: GreenfieldAIStreamStatus, cancellationRequested = false): Promise<void> {
    const terminal = status === 'completed' || status === 'cancelled' || status === 'failed'
    await this.db
      .updateTable('ai_stream_sessions')
      .set({
        status,
        cancellation_requested_at: cancellationRequested ? new Date() : undefined,
        completed_at: terminal ? new Date() : undefined,
        updated_at: new Date(),
      })
      .where('stream_id', '=', streamId)
      .execute()
  }

  async cancelExecution(executionId: string, accountId: string): Promise<{streamId?: string}> {
    const execution = await this.requireExecutionForAccount(executionId, accountId)
    if (execution.status === 'cancelled') {
      const existing = await this.db.selectFrom('ai_stream_sessions').select('stream_id').where('execution_id', '=', executionId).executeTakeFirst()
      return {streamId: existing?.stream_id}
    }
    await this.updateExecution({executionId, status: 'cancelled', failureCode: 'AI_EXECUTION_CANCELLED'})
    const stream = await this.db.selectFrom('ai_stream_sessions').select('stream_id').where('execution_id', '=', executionId).executeTakeFirst()
    if (stream) await this.updateStreamSession(stream.stream_id, 'cancelled', true)
    return {streamId: stream?.stream_id}
  }

  async recordHealth(input: {
    providerId: string
    modelId?: string | null
    component: AIProviderHealthComponent
    state: AIProviderHealthState
    latencyMs?: number | null
    failureCode?: string | null
    configuredModelCount?: number
    successfulExecutionCount?: number
    failedExecutionCount?: number
    activeStreamCount?: number
    diagnostics?: Record<string, unknown>
  }): Promise<void> {
    await this.db
      .insertInto('ai_provider_health')
      .values({
        health_id: `ai-health-${uuidv7()}`,
        provider_id: input.providerId,
        model_id: input.modelId ?? null,
        component: input.component,
        state: input.state,
        checked_at: new Date(),
        latency_ms: input.latencyMs ?? null,
        failure_code: input.failureCode ?? null,
        failure_rate: 0,
        rate_limit_state: jsonb({}),
        configured_model_count: input.configuredModelCount ?? 0,
        successful_execution_count: input.successfulExecutionCount ?? 0,
        failed_execution_count: input.failedExecutionCount ?? 0,
        active_stream_count: input.activeStreamCount ?? 0,
        diagnostics: jsonb(input.diagnostics ?? {}),
      })
      .execute()
  }

  async latestProviderHealth(providerId: string, modelId?: string | null): Promise<Database['ai_provider_health'] | null> {
    let query = this.db
      .selectFrom('ai_provider_health')
      .selectAll()
      .where('provider_id', '=', providerId)
    query = modelId === undefined
      ? query
      : query.where(modelId === null ? 'model_id' : 'model_id', modelId === null ? 'is' : '=', modelId)
    const row = await query.orderBy('checked_at', 'desc').executeTakeFirst()
    return row ?? null
  }

  async circuitAllows(providerId: string, modelId: string | null, openDurationMs: number): Promise<boolean> {
    const state = await this.runtimeState(providerId, modelId)
    if (!state || state.circuit_state === 'closed' || state.circuit_state === 'half-open') return true
    const openedAt = state.circuit_opened_at?.getTime() ?? 0
    if (Date.now() - openedAt >= openDurationMs) {
      await this.upsertRuntimeState(providerId, modelId, {circuitState: 'half-open', halfOpenProbeCount: 0})
      return true
    }
    return false
  }

  async recordCircuitSuccess(providerId: string, modelId: string | null): Promise<void> {
    const state = await this.runtimeState(providerId, modelId)
    await this.upsertRuntimeState(providerId, modelId, {
      circuitState: 'closed',
      failureCount: 0,
      successCount: (state?.success_count ?? 0) + 1,
      lastFailureCode: null,
      circuitOpenedAt: null,
      halfOpenProbeCount: 0,
    })
  }

  async recordCircuitFailure(providerId: string, modelId: string | null, failureCode: string, threshold: number): Promise<void> {
    const state = await this.runtimeState(providerId, modelId)
    const failures = (state?.failure_count ?? 0) + 1
    await this.upsertRuntimeState(providerId, modelId, {
      circuitState: failureCode === 'AI_PROVIDER_AUTH_FAILED' || failures >= threshold ? 'open' : 'closed',
      failureCount: failures,
      successCount: state?.success_count ?? 0,
      lastFailureCode: failureCode,
      circuitOpenedAt: failureCode === 'AI_PROVIDER_AUTH_FAILED' || failures >= threshold ? new Date() : state?.circuit_opened_at ?? null,
      halfOpenProbeCount: state?.half_open_probe_count ?? 0,
    })
  }

  async setUsageLimit(input: SetAIUsageLimitInput): Promise<string> {
    const limitId = input.limitId ?? `ai-limit-${uuidv7()}`
    const now = new Date()
    await this.db
      .insertInto('ai_usage_limits')
      .values({
        limit_id: limitId,
        scope_type: input.scopeType,
        scope_id: input.scopeId ?? null,
        provider_id: input.providerId ?? null,
        model_id: input.modelId ?? null,
        limit_kind: input.limitKind,
        unit: input.unit,
        window_seconds: input.windowSeconds,
        limit_value: input.limitValue,
        enabled: input.enabled ?? true,
        metadata: jsonb(input.metadata ?? {}),
        created_at: now,
        updated_at: now,
      })
      .onConflict(conflict => conflict.column('limit_id').doUpdateSet({
        scope_type: input.scopeType,
        scope_id: input.scopeId ?? null,
        provider_id: input.providerId ?? null,
        model_id: input.modelId ?? null,
        limit_kind: input.limitKind,
        unit: input.unit,
        window_seconds: input.windowSeconds,
        limit_value: input.limitValue,
        enabled: input.enabled ?? true,
        metadata: jsonb(input.metadata ?? {}),
        updated_at: now,
      }))
      .execute()
    return limitId
  }

  async activeLimits(input: {
    accountId: string
    moduleId: string
    installationId?: string | null
    providerId?: string | null
    modelId?: string | null
  }): Promise<Database['ai_usage_limits'][]> {
    const scopes: Array<[AIUsageLimitScope, string | null]> = [
      ['platform', null],
      ['account', input.accountId],
      ['module', input.moduleId],
    ]
    if (input.installationId) scopes.push(['installation', input.installationId])
    if (input.providerId) scopes.push(['provider', input.providerId])
    if (input.modelId) scopes.push(['model', input.modelId])
    const rows = await this.db.selectFrom('ai_usage_limits').selectAll().where('enabled', '=', true).execute()
    return rows.filter(limit => scopes.some(([scopeType, scopeId]) => limit.scope_type === scopeType && (limit.scope_id ?? null) === scopeId))
  }

  async consumedUnits(limit: Database['ai_usage_limits'], bucketStart: Date): Promise<number> {
    const row = await this.db
      .selectFrom('ai_quota_consumption')
      .select('consumed_units')
      .where('limit_id', '=', limit.limit_id)
      .where('bucket_start', '=', bucketStart)
      .executeTakeFirst()
    return row?.consumed_units ?? 0
  }

  async consumeQuota(input: {
    limit: Database['ai_usage_limits']
    units: number
    bucketStart: Date
    bucketEnd: Date
    providerId?: string | null
    modelId?: string | null
    currency?: string | null
  }): Promise<void> {
    const id = `ai-quota-${sha256([
      input.limit.limit_id,
      input.bucketStart.toISOString(),
      input.limit.unit,
      input.providerId ?? '',
      input.modelId ?? '',
    ].join('|')).slice(0, 48)}`
    await this.db
      .insertInto('ai_quota_consumption')
      .values({
        consumption_id: id,
        limit_id: input.limit.limit_id,
        scope_type: input.limit.scope_type,
        scope_id: input.limit.scope_id,
        provider_id: input.providerId ?? null,
        model_id: input.modelId ?? null,
        bucket_start: input.bucketStart,
        bucket_end: input.bucketEnd,
        unit: input.limit.unit,
        consumed_units: input.units,
        request_count: 1,
        currency: input.currency ?? null,
        updated_at: new Date(),
      })
      .onConflict(conflict => conflict.column('consumption_id').doUpdateSet({
        consumed_units: sql<number>`ai_quota_consumption.consumed_units + ${input.units}`,
        request_count: sql<number>`ai_quota_consumption.request_count + 1`,
        updated_at: new Date(),
      }))
      .execute()
  }

  async executionUsageSummary(): Promise<Array<{provider_id: string | null; model_id: string | null; status: string; count: number}>> {
    const rows = await sql<{provider_id: string | null; model_id: string | null; status: string; count: string}>`
      SELECT provider_id, model_id, status, COUNT(*)::text AS count
      FROM ai_executions
      GROUP BY provider_id, model_id, status
      ORDER BY provider_id NULLS LAST, model_id NULLS LAST, status
    `.execute(this.db)
    return rows.rows.map(row => ({...row, count: Number(row.count)}))
  }

  private async runtimeState(providerId: string, modelId: string | null): Promise<Database['ai_provider_runtime_state'] | null> {
    const row = await this.db
      .selectFrom('ai_provider_runtime_state')
      .selectAll()
      .where('state_id', '=', runtimeStateId(providerId, modelId))
      .executeTakeFirst()
    return row ?? null
  }

  private async upsertRuntimeState(providerId: string, modelId: string | null, patch: {
    circuitState: Database['ai_provider_runtime_state']['circuit_state']
    failureCount?: number
    successCount?: number
    lastFailureCode?: string | null
    circuitOpenedAt?: Date | null
    halfOpenProbeCount?: number
  }): Promise<void> {
    const now = new Date()
    await this.db
      .insertInto('ai_provider_runtime_state')
      .values({
        state_id: runtimeStateId(providerId, modelId),
        provider_id: providerId,
        model_id: modelId,
        circuit_state: patch.circuitState,
        failure_count: patch.failureCount ?? 0,
        success_count: patch.successCount ?? 0,
        rolling_window_started_at: now,
        circuit_opened_at: patch.circuitOpenedAt ?? null,
        half_open_probe_count: patch.halfOpenProbeCount ?? 0,
        last_failure_code: patch.lastFailureCode ?? null,
        config: jsonb({}),
        updated_at: now,
      })
      .onConflict(conflict => conflict.column('state_id').doUpdateSet({
        circuit_state: patch.circuitState,
        failure_count: patch.failureCount ?? 0,
        success_count: patch.successCount ?? 0,
        circuit_opened_at: patch.circuitOpenedAt ?? null,
        half_open_probe_count: patch.halfOpenProbeCount ?? 0,
        last_failure_code: patch.lastFailureCode ?? null,
        updated_at: now,
      }))
      .execute()
  }
}

export function normalizeUsageUnits(value: GreenfieldAIUsageUnits = {}): GreenfieldAIUsageUnits {
  return {
    inputTokens: nonNegativeNumber(value.inputTokens),
    outputTokens: nonNegativeNumber(value.outputTokens),
    cachedInputTokens: nonNegativeNumber(value.cachedInputTokens),
    imageUnits: nonNegativeNumber(value.imageUnits),
    audioSeconds: nonNegativeNumber(value.audioSeconds),
    providerCostMinorUnits: nonNegativeNumber(value.providerCostMinorUnits),
    currency: typeof value.currency === 'string' ? value.currency : undefined,
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function runtimeStateId(providerId: string, modelId: string | null): string {
  return `ai-runtime-${sha256(`${providerId}:${modelId ?? '*'}`).slice(0, 32)}`
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined
}
