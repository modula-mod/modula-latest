import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../database/client.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {AuditRepository} from '../domains/audit/repository.js'

const FIRST_PARTY_FUNCTIONS = new Set([
  'modula.function.linkPreview',
  'modula.function.extractMentions',
  'modula.function.generatePostSummaryPreview',
  'modula.function.validateMediaMetadata',
])

/**
 * Queued function execution. Synchronous first-party helpers may complete inline
 * with deterministic preview behaviour; background work goes through outbox jobs.
 */
export class FunctionJobService {
  constructor(private readonly db: ModulaDb) {}

  async invoke(accountId: string, functionId: string, input: Record<string, unknown> = {}) {
    const fn = await this.db
      .selectFrom('greenfield_functions')
      .selectAll()
      .where('function_id', '=', functionId)
      .executeTakeFirst()
    if (!fn) throw Object.assign(new Error('Function not found'), {code: 'NOT_FOUND'})
    if (!FIRST_PARTY_FUNCTIONS.has(functionId)) {
      throw Object.assign(new Error('Untrusted code cannot execute'), {code: 'FORBIDDEN'})
    }

    const now = new Date()
    const jobId = randomUUID()
    const expiresAt = new Date(now.getTime() + Math.max(fn.timeout_ms, 1_000) + 60_000)

    // Deterministic sync preview helpers complete immediately.
    if (functionId === 'modula.function.extractMentions' || functionId === 'modula.function.validateMediaMetadata') {
      const output = this.runDeterministic(functionId, input)
      await this.db
        .insertInto('greenfield_function_jobs')
        .values({
          job_id: jobId,
          account_id: accountId,
          function_id: functionId,
          status: 'completed',
          input,
          output,
          error_message: null,
          created_at: now,
          started_at: now,
          completed_at: now,
          expires_at: expiresAt,
        })
        .execute()
      return {jobId, status: 'completed' as const, output}
    }

    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_function_jobs')
        .values({
          job_id: jobId,
          account_id: accountId,
          function_id: functionId,
          status: 'queued',
          input,
          output: null,
          error_message: null,
          created_at: now,
          started_at: null,
          completed_at: null,
          expires_at: expiresAt,
        })
        .execute()
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'function.invoke',
        aggregateType: 'function_job',
        aggregateId: jobId,
        payload: {jobId, accountId, functionId, input, timeoutMs: fn.timeout_ms},
      })
      await new AuditRepository(trx).append('function.invoke', {functionId}, {
        type: 'function_job',
        id: jobId,
        actorId: null,
      })
    })
    return {jobId, status: 'queued' as const, output: null}
  }

  async getJob(accountId: string, jobId: string) {
    const job = await this.db
      .selectFrom('greenfield_function_jobs')
      .selectAll()
      .where('job_id', '=', jobId)
      .where('account_id', '=', accountId)
      .executeTakeFirst()
    if (!job) throw Object.assign(new Error('Function job not found'), {code: 'NOT_FOUND'})
    return job
  }

  async cancel(accountId: string, jobId: string) {
    const job = await this.getJob(accountId, jobId)
    if (job.status !== 'queued' && job.status !== 'running') {
      throw Object.assign(new Error('Job cannot be cancelled'), {code: 'CONFLICT'})
    }
    await this.db
      .updateTable('greenfield_function_jobs')
      .set({status: 'cancelled', completed_at: new Date()})
      .where('job_id', '=', jobId)
      .where('account_id', '=', accountId)
      .execute()
    return {cancelled: true, jobId}
  }

  private runDeterministic(functionId: string, input: Record<string, unknown>) {
    if (functionId === 'modula.function.extractMentions') {
      const text = typeof input.text === 'string' ? input.text : ''
      const handles = [...text.matchAll(/(^|[^\w])@([a-z0-9][a-z0-9.-]{1,62})\b/gi)].map(m => m[2]?.toLowerCase()).filter(Boolean)
      return {handles: [...new Set(handles)], label: 'Preview'}
    }
    return {
      valid: true,
      label: 'Preview',
      metadata: input.metadata ?? {},
    }
  }
}
