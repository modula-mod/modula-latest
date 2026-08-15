import type {ModulaWorkerDb} from '../database.js'
import {unregisterModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'
import {removeStandard2Runtime, setStandard2RuntimeStatus} from './standard2-runtime-registration.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'

export async function handleModuleUninstall(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.uninstall payload')
  const installed = await db.selectFrom('greenfield_extension_installations').selectAll().where('installation_id', '=', p.installationId).executeTakeFirst()
  if (!installed) throw permanentModuleJob('VALIDATION_FAILED', 'Installation not found')
  const release = await db.selectFrom('greenfield_module_releases').select('release_id').where('extension_version_id', '=', installed.extension_version_id).executeTakeFirst()
  const choice = p.dataRetentionChoice === 'deleteData' || p.dataRetentionChoice === 'exportThenDelete' ? p.dataRetentionChoice : 'keepData'
  const moduleId = resolveCanonicalModuleId(p.moduleId ?? installed.extension_version_id.split('@')[0])
  const family = [...moduleIdFamily(moduleId)]
  const count = await db
    .selectFrom('greenfield_module_records')
    .select(({fn}) => fn.countAll<number>().as('count'))
    .where('account_id', '=', installed.account_id)
    .where('module_id', 'in', family)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  await db.transaction().execute(async trx => {
    if (release) await unregisterModuleContributions(trx as any, release.release_id)
    await setStandard2RuntimeStatus(trx as any, {
      installationId: p.installationId,
      accountId: installed.account_id,
      moduleId,
      releaseId: release?.release_id ?? null,
      action: 'uninstall',
      status: 'removed',
      jobsPaused: true,
    })
    if (choice === 'deleteData') {
      await trx
        .updateTable('greenfield_module_records')
        .set({deleted_at: new Date(), updated_at: new Date()})
        .where('account_id', '=', installed.account_id)
        .where('module_id', 'in', family)
        .where('deleted_at', 'is', null)
        .execute()
    } else {
      await trx
        .updateTable('greenfield_module_records')
        .set({retained_after_uninstall: true, updated_at: new Date()})
        .where('account_id', '=', installed.account_id)
        .where('module_id', 'in', family)
        .where('deleted_at', 'is', null)
        .execute()
    }
    await removeStandard2Runtime(trx as any, p.installationId)
    await trx
      .insertInto('greenfield_module_data_retention')
      .values({
        retention_id: `module-retention:${p.installationId}:${Date.now()}`,
        account_id: installed.account_id,
        module_id: moduleId,
        installation_id: p.installationId,
        choice,
        record_count: Number(count?.count ?? 0),
        export_id: null,
        completed_at: new Date(),
        created_at: new Date(),
      })
      .execute()
    await trx.updateTable('greenfield_extension_installations').set({status: 'removed', updated_at: new Date()}).where('installation_id', '=', p.installationId).execute()
  })
}
