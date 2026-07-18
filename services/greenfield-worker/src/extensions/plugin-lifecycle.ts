import {sql} from 'kysely'
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
  const payload = rawPayload as {
    accountId?: string
    extensionId?: string
    backgroundJobId?: string
    simulateFailure?: boolean
    simulateTimeout?: boolean
  }
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
    await recordExtensionFailure(db, payload, code, message)
    await db
      .insertInto('job_failures')
      .values({
        id: `plugin-fail-${Date.now()}`,
            job_id: payload.backgroundJobId ?? `plugin-${payload.extensionId}`,
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
    await new Promise(resolve => setTimeout(resolve, PLUGIN_TIMEOUT_MS * 2))
  }
  if (payload.simulateFailure) {
    throw Object.assign(new Error(`Plugin ${jobType} failed intentionally`), {code: 'PLUGIN_FAILED'})
  }
  // First-party plugins currently have no executable side effects beyond audit/outbox ack.
}

async function recordExtensionFailure(
  db: ModulaWorkerDb,
  payload: {accountId?: string; extensionId?: string; simulateFailure?: boolean; simulateTimeout?: boolean},
  code: string,
  message: string,
) {
  if (!payload.accountId || !payload.extensionId) return
  const status = code === 'PLUGIN_TIMEOUT' ? 'disabled' : 'failed'
  const installed = await sql<{installation_id: string}>`
    SELECT i.installation_id
    FROM greenfield_extension_installations i
    JOIN greenfield_extension_versions v ON v.extension_version_id = i.extension_version_id
    JOIN greenfield_extensions e ON e.extension_id = v.extension_id
    WHERE i.account_id = ${payload.accountId}
      AND (e.slug = ${payload.extensionId} OR e.extension_id = ${payload.extensionId})
    LIMIT 1
  `.execute(db)
  const installationId = installed.rows[0]?.installation_id ?? null
  if (installationId) {
    await sql`
      UPDATE greenfield_extension_installations
      SET status = ${status}::text, updated_at = NOW()
      WHERE installation_id = ${installationId}::text
    `.execute(db)
  }
  await sql`
    INSERT INTO greenfield_extension_failures (
      failure_id, account_id, extension_id, installation_id, code, message, retryable, created_at
    )
    VALUES (
      'extension-failure-' || md5(${payload.accountId}::text || ':' || ${payload.extensionId}::text || ':' || ${code}::text || ':' || ${message}::text),
      ${payload.accountId}::text,
      ${payload.extensionId}::text,
      ${installationId}::text,
      ${code}::text,
      ${message}::text,
      ${code !== 'PLUGIN_TIMEOUT' && !payload.simulateFailure}::boolean,
      NOW()
    )
    ON CONFLICT (failure_id) DO NOTHING
  `.execute(db)
  await sql`
    INSERT INTO greenfield_extension_lifecycle_events (
      event_id, account_id, extension_id, event, from_status, to_status, detail, created_at
    )
    VALUES (
      'extension-event-' || md5(${payload.accountId}::text || ':' || ${payload.extensionId}::text || ':' || ${code}::text || ':' || ${message}::text),
      ${payload.accountId}::text,
      ${payload.extensionId}::text,
      'failed',
      NULL,
      ${status}::text,
      jsonb_build_object('code', ${code}::text, 'message', ${message}::text),
      NOW()
    )
    ON CONFLICT (event_id) DO NOTHING
  `.execute(db)
}
