import type {ModulaWorkerDb} from '../database.js'
import {registerModuleContributions, unregisterModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'
import {projectStandard2Runtime} from './standard2-runtime-registration.js'

export async function handleModuleUpdate(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId || !p.targetReleaseId || !p.previousStatus) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.update payload')
  const release = await db.selectFrom('greenfield_module_releases').selectAll().where('release_id', '=', p.targetReleaseId).executeTakeFirst()
  if (!release || release.release_state !== 'published') throw permanentModuleJob('VALIDATION_FAILED', 'Target release unavailable')
  await db.transaction().execute(async trx => {
    const old = await trx.selectFrom('greenfield_extension_installations').select('extension_version_id').where('installation_id', '=', p.installationId).executeTakeFirst()
    if (old) {
      const oldRelease = await trx.selectFrom('greenfield_module_releases').select('release_id').where('extension_version_id', '=', old.extension_version_id).executeTakeFirst()
      if (oldRelease) await unregisterModuleContributions(trx as any, oldRelease.release_id)
    }
    await registerModuleContributions(trx as any, release.release_id, release.extension_version_id, {enableExecutable: p.previousStatus === 'enabled'})
    await projectStandard2Runtime(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      moduleId: release.module_id,
      releaseId: release.release_id,
      status: p.previousStatus === 'enabled' ? 'registered' : 'disabled',
      jobsPaused: p.previousStatus !== 'enabled',
    })
    await trx
      .updateTable('greenfield_extension_installations')
      .set({extension_version_id: release.extension_version_id, status: p.previousStatus === 'enabled' ? 'enabled' : 'disabled', updated_at: new Date()})
      .where('installation_id', '=', p.installationId)
      .execute()
  })
}
