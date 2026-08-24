import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'

type ExtensionJobPayload = {
  executionId?: string
  accountId?: string
  extensionProductId?: string
  requestId?: string
}

/**
 * Projects extension jobs through the existing leased worker queue. Remote
 * execution remains Greenfield-gateway-only; this worker never receives note
 * content, provider credentials, or a raw user bearer.
 */
export async function handleExtensionJob(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const input = (payload ?? {}) as ExtensionJobPayload
  if (!input.executionId || !input.accountId || !input.extensionProductId) {
    throw Object.assign(new Error('Invalid extension.job.execute payload'), {code: 'VALIDATION_FAILED'})
  }
  const extensionDb = db as any
  const execution = await extensionDb
    .selectFrom('greenfield_extension_job_executions')
    .selectAll()
    .where('execution_id', '=', input.executionId)
    .where('account_id', '=', input.accountId)
    .executeTakeFirst()
  if (!execution || ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(execution.status)) return

  const now = new Date()
  await extensionDb
    .updateTable('greenfield_extension_job_executions')
    .set({status: 'RUNNING', attempt_count: execution.attempt_count + 1, started_at: execution.started_at ?? now, updated_at: now})
    .where('execution_id', '=', input.executionId)
    .where('account_id', '=', input.accountId)
    .execute()

  const service = await db
    .selectFrom('greenfield_module_service_registrations')
    .select(['service_registration_id'])
    .where('account_id', '=', input.accountId)
    .where('installation_id', '=', execution.owner_installation_id)
    .where('status', '=', 'enabled')
    .where('health_state', 'in', ['healthy', 'degraded'])
    .executeTakeFirst()
  const attemptCount = execution.attempt_count + 1
  const failureCode = service ? 'ASYNC_SERVICE_DISPATCH_UNAVAILABLE' : 'PROVIDER_NOT_CONFIGURED'
  if (service && attemptCount < execution.maximum_attempts) {
    const retryAt = new Date(Date.now() + Math.min(30_000, 1_000 * 2 ** Math.max(0, attemptCount - 1)))
    await extensionDb
      .updateTable('greenfield_extension_job_executions')
      .set({status: 'RETRYING', failure_code: failureCode, available_at: retryAt, updated_at: new Date()})
      .where('execution_id', '=', input.executionId)
      .where('account_id', '=', input.accountId)
      .execute()
    throw Object.assign(new Error('Extension service dispatch is temporarily unavailable'), {code: failureCode})
  }
  const completedAt = new Date()
  await extensionDb
    .updateTable('greenfield_extension_job_executions')
    .set({status: 'FAILED', failure_code: failureCode, completed_at: completedAt, updated_at: completedAt})
    .where('execution_id', '=', input.executionId)
    .where('account_id', '=', input.accountId)
    .execute()
  await appendAudit(db, {
    accountId: input.accountId,
    requestId: input.requestId ?? execution.request_id,
    executionId: input.executionId,
    extensionProductId: input.extensionProductId,
    failureCode,
  })
}

async function appendAudit(db: ModulaWorkerDb, input: {accountId: string; requestId: string; executionId: string; extensionProductId: string; failureCode: string}) {
  const id = `audit-${randomUUID()}`
  await db.insertInto('audit_events').values({
    id,
    audit_id: id,
    event_type: 'extension.job.completed',
    account_id: input.accountId,
    actor_id: null,
    action: 'extension.job.completed',
    resource_type: 'extensionJob',
    resource_id: input.executionId,
    result: 'failed',
    request_id: input.requestId,
    correlation_id: input.requestId,
    ip_classification: 'unknown',
    user_agent_classification: 'unknown',
    metadata_schema_version: 1,
    metadata: sql`${JSON.stringify({extensionProductId: input.extensionProductId, failureCode: input.failureCode})}::jsonb` as any,
    created_at: new Date(),
  }).execute()
}
