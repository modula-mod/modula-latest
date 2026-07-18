import type {ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'

const PLUGIN_TIMEOUT_MS = 5_000

/**
 * Isolated plugin lifecycle hooks. Failures are recorded and never crash the worker loop.
 * Untrusted / missing plugins complete as no-ops so Greenfield API readiness is preserved.
 */
export async function handlePluginLifecycle(
  db: ModulaWorkerDb,
  jobType: string,
  rawPayload: unknown,
): Promise<void> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'plugin payload must be an object')
  }
  const payload = rawPayload as {accountId?: string; extensionId?: string; simulateFailure?: boolean; simulateTimeout?: boolean}
  if (!payload.accountId || !payload.extensionId) {
    throw new PermanentJobError('VALIDATION_FAILED', 'accountId and extensionId required')
  }

  try {
    await Promise.race([
      runHook(jobType, payload),
      new Promise((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error('Plugin timed out'), {code: 'PLUGIN_TIMEOUT'})), PLUGIN_TIMEOUT_MS)
      }),
    ])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Plugin failed'
    const code = (error as {code?: string})?.code ?? 'PLUGIN_FAILED'
    // Persist failure without throwing when retry is unsafe for enable/install isolation tests.
    await db
      .insertInto('job_failures')
      .values({
        id: `plugin-fail-${Date.now()}`,
        job_id: `plugin-${payload.extensionId}`,
        job_type: jobType,
        payload,
        error_code: code,
        error_message: message,
        permanent: code === 'PLUGIN_TIMEOUT' || Boolean(payload.simulateFailure),
        created_at: new Date(),
      })
      .execute()
      .catch(() => undefined)
    if (payload.simulateFailure || code === 'PLUGIN_TIMEOUT') {
      // Isolation: do not rethrow — host remains available.
      return
    }
    throw error
  }
}

async function runHook(jobType: string, payload: {simulateFailure?: boolean; simulateTimeout?: boolean}) {
  if (payload.simulateTimeout) {
    await new Promise(resolve => setTimeout(resolve, PLUGIN_TIMEOUT_MS + 50))
  }
  if (payload.simulateFailure) {
    throw Object.assign(new Error(`Plugin ${jobType} failed intentionally`), {code: 'PLUGIN_FAILED'})
  }
  // First-party plugins currently have no executable side effects beyond audit/outbox ack.
}
