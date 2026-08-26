import type {ModulaWorkerDb} from '../database.js'
import {unregisterModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'
import {removeStandard2Runtime, setStandard2RuntimeStatus} from './standard2-runtime-registration.js'
import {moduleIdFamily, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {projectExtensionLifecycle} from './extension-fabric-projection.js'

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
  const ledgerResources = await db
    .selectFrom('greenfield_data_resources')
    .leftJoin('greenfield_data_retention_policies', 'greenfield_data_retention_policies.resource_id', 'greenfield_data_resources.resource_id')
    .select([
      'greenfield_data_resources.resource_id',
      'greenfield_data_retention_policies.legal_hold',
    ])
    .where('greenfield_data_resources.installation_id', '=', p.installationId)
    .execute()
  const bindingModes = new Map<string, string[]>()
  for (const resource of ledgerResources) {
    const bindings = await db
      .selectFrom('greenfield_data_storage_bindings')
      .select(['storage_mode'])
      .where('resource_id', '=', resource.resource_id)
      .where('state', '!=', 'RETIRED')
      .execute()
    bindingModes.set(resource.resource_id, bindings.map(binding => binding.storage_mode))
  }
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
    await projectExtensionLifecycle(trx as any, {
      installationId: p.installationId,
      accountId: installed.account_id,
      productId: moduleId,
      state: 'NOT_INSTALLED',
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
    for (const resource of ledgerResources) {
      const modes = bindingModes.get(resource.resource_id) ?? []
      const greenfieldOnly = modes.length > 0 && modes.every(mode => mode === 'greenfield-records')
      const lifecycleState = choice === 'exportThenDelete'
        ? 'EXPORT_PENDING'
        : choice === 'deleteData' && resource.legal_hold
          ? 'RETAINED'
          : choice === 'deleteData' && greenfieldOnly
            ? 'DELETED'
            : choice === 'deleteData'
              ? 'DELETE_PENDING'
              : 'RETAINED'
      await trx
        .updateTable('greenfield_data_resources')
        .set({
          lifecycle_state: lifecycleState,
          deleted_at: lifecycleState === 'DELETED' ? new Date() : null,
          updated_at: new Date(),
        })
        .where('resource_id', '=', resource.resource_id)
        .execute()
      await trx
        .updateTable('greenfield_data_storage_bindings')
        .set({state: 'RETIRED', retired_at: new Date(), updated_at: new Date()})
        .where('resource_id', '=', resource.resource_id)
        .execute()
      if (lifecycleState === 'DELETED') {
        await trx
          .updateTable('greenfield_data_resource_owners')
          .set({released_at: new Date()})
          .where('resource_id', '=', resource.resource_id)
          .where('released_at', 'is', null)
          .execute()
      }
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
