import type {ModulaWorkerDb} from '../database.js'
import {unregisterModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'

export async function handleModuleUninstall(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.uninstall payload')
  const installed = await db.selectFrom('greenfield_extension_installations').selectAll().where('installation_id', '=', p.installationId).executeTakeFirst()
  if (!installed) throw permanentModuleJob('VALIDATION_FAILED', 'Installation not found')
  const release = await db.selectFrom('greenfield_module_releases').select('release_id').where('extension_version_id', '=', installed.extension_version_id).executeTakeFirst()
  await db.transaction().execute(async trx => {
    if (release) await unregisterModuleContributions(trx as any, release.release_id)
    await trx.updateTable('greenfield_extension_installations').set({status: 'removed', updated_at: new Date()}).where('installation_id', '=', p.installationId).execute()
  })
}
