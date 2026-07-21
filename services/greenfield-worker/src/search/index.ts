import type {ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'

/**
 * Search vectors are maintained by PostgreSQL triggers (migration 002).
 * This handler acknowledges search.index jobs without rewriting columns that
 * are not present on the typed worker schema.
 */
export async function handleSearchIndex(_db: ModulaWorkerDb, rawPayload: unknown): Promise<void> {
  if (!rawPayload || typeof rawPayload !== 'object') {
    throw new PermanentJobError('VALIDATION_FAILED', 'search.index payload must be an object')
  }
}
