import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'

export async function handleModuleReleaseVerify(db: ModulaWorkerDb, _config: WorkerConfig, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.releaseId) return
  await db.updateTable('greenfield_module_release_integrity').set({verified_at: new Date()}).where('release_id', '=', p.releaseId).execute()
}

export async function handleModuleReleasePublish(_db: ModulaWorkerDb, _config: WorkerConfig, _payload: unknown): Promise<void> {
  // Publication is committed by the API transaction; the worker hook exists for audit/outbox symmetry.
}
