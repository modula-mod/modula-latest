import type {WorkerDb} from '../database.js'

/** Search vectors are maintained by PostgreSQL triggers; handler acknowledges the job. */
export async function handleSearchIndex(_db: WorkerDb, _payload: Record<string, unknown>) {
  return
}
