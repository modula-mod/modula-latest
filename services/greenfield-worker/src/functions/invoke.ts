import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'

/**
 * Background function job runner. Deterministic preview helpers only — no fake AI.
 */
export async function handleFunctionInvoke(db: ModulaWorkerDb, rawPayload: unknown): Promise<void> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'function.invoke payload must be an object')
  }
  const p = rawPayload as {
    jobId?: string
    functionId?: string
    input?: Record<string, unknown>
    timeoutMs?: number
  }
  if (!p.jobId || !p.functionId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'jobId and functionId required')
  }

  const cancelled = await sql<{status: string}>`
    SELECT status FROM greenfield_function_jobs WHERE job_id = ${p.jobId}
  `.execute(db)
  const status = cancelled.rows[0]?.status
  if (status === 'cancelled') return

  await sql`
    UPDATE greenfield_function_jobs
    SET status = 'running', started_at = NOW()
    WHERE job_id = ${p.jobId} AND status = 'queued'
  `.execute(db)

  const timeoutMs = Math.min(Math.max(p.timeoutMs ?? 10_000, 100), 30_000)
  try {
    const output = await Promise.race([
      Promise.resolve(runFunction(p.functionId, p.input ?? {})),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error('Function timed out'), {code: 'FUNCTION_TIMEOUT'})), timeoutMs)
      }),
    ])
    await sql`
      UPDATE greenfield_function_jobs
      SET status = 'completed', output = ${JSON.stringify(output)}::jsonb, completed_at = NOW(), error_message = NULL
      WHERE job_id = ${p.jobId}
    `.execute(db)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Function failed'
    await sql`
      UPDATE greenfield_function_jobs
      SET status = 'failed', error_message = ${message}, completed_at = NOW()
      WHERE job_id = ${p.jobId}
    `.execute(db)
  }
}

function runFunction(functionId: string, input: Record<string, unknown>) {
  switch (functionId) {
    case 'modula.function.linkPreview': {
      const url = typeof input.url === 'string' ? input.url : ''
      return {
        label: 'Preview',
        domain: url ? safeDomain(url) : null,
        title: url ? `Preview of ${safeDomain(url)}` : 'Link preview',
        description: 'Deterministic preview — not live fetch.',
      }
    }
    case 'modula.function.generatePostSummaryPreview': {
      const text = typeof input.text === 'string' ? input.text : ''
      const summary = text.trim().slice(0, 140)
      return {label: 'Preview', summary: summary || 'Empty post'}
    }
    case 'modula.function.extractMentions': {
      const text = typeof input.text === 'string' ? input.text : ''
      const handles = [...text.matchAll(/(^|[^\w])@([a-z0-9][a-z0-9.-]{1,62})\b/gi)]
        .map(m => m[2]?.toLowerCase())
        .filter(Boolean)
      return {label: 'Preview', handles: [...new Set(handles)]}
    }
    case 'modula.function.validateMediaMetadata':
      return {label: 'Preview', valid: true, metadata: input.metadata ?? {}}
    default:
      throw Object.assign(new Error('Untrusted code cannot execute'), {code: 'FORBIDDEN'})
  }
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'invalid'
  }
}
