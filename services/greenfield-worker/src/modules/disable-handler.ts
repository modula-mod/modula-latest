import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'
import {setStandard2RuntimeStatus} from './standard2-runtime-registration.js'
import {projectExtensionLifecycle} from './extension-fabric-projection.js'

export async function handleModuleDisable(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId || !p.accountId || !p.moduleId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.disable payload')
  const release = await db
    .selectFrom('greenfield_module_releases')
    .innerJoin('greenfield_extension_installations', 'greenfield_extension_installations.extension_version_id', 'greenfield_module_releases.extension_version_id')
    .select('greenfield_module_releases.release_id')
    .where('greenfield_extension_installations.installation_id', '=', p.installationId)
    .executeTakeFirst()
  await db.transaction().execute(async trx => {
    await setStandard2RuntimeStatus(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      moduleId: p.moduleId,
      releaseId: release?.release_id ?? null,
      action: 'disable',
      status: 'disabled',
      jobsPaused: true,
    })
    await projectExtensionLifecycle(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      productId: p.moduleId,
      state: 'DISABLED',
    })
    await trx.updateTable('greenfield_extension_installations').set({status: 'disabled', updated_at: new Date()}).where('installation_id', '=', p.installationId).execute()
  })
}
