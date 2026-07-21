import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'

export async function handleModuleDisable(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.disable payload')
  await db.updateTable('greenfield_extension_installations').set({status: 'disabled', updated_at: new Date()}).where('installation_id', '=', p.installationId).execute()
}
