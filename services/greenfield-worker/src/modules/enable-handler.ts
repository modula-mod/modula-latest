import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {registerModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'
import {projectStandard2Runtime} from './standard2-runtime-registration.js'

export async function handleModuleEnable(db: ModulaWorkerDb, config: WorkerConfig, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId || !p.moduleId || !p.accountId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.enable payload')
  const release = await db
    .selectFrom('greenfield_module_releases')
    .innerJoin('greenfield_extension_installations', 'greenfield_extension_installations.extension_version_id', 'greenfield_module_releases.extension_version_id')
    .selectAll('greenfield_module_releases')
    .where('greenfield_extension_installations.installation_id', '=', p.installationId)
    .executeTakeFirst()
  if (!release || release.release_state !== 'published') throw permanentModuleJob('VALIDATION_FAILED', 'Cannot enable unavailable module release')
  if (release.trust_level !== 'firstParty' && !config.moduleCommunityExecutionEnabled) {
    throw permanentModuleJob('VALIDATION_FAILED', 'Community executable module contributions are disabled')
  }
  await db.transaction().execute(async trx => {
    await registerModuleContributions(trx as any, release.release_id, release.extension_version_id, {enableExecutable: true})
    await projectStandard2Runtime(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      moduleId: p.moduleId,
      releaseId: release.release_id,
      status: 'registered',
      jobsPaused: false,
    })
    await trx.updateTable('greenfield_extension_installations').set({status: 'enabled', updated_at: new Date()}).where('installation_id', '=', p.installationId).execute()
  })
}
