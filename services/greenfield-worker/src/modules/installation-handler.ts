import type {WorkerConfig} from '../config.js'
import type {ModulaWorkerDb} from '../database.js'
import {permanentModuleJob} from './module-job-errors.js'
import {registerModuleContributions} from './contribution-registration-handler.js'
import {registerModuleSchemas} from './schema-registration-handler.js'

type InstallPayload = {
  planId: string
  installationId: string
  releaseId: string
  moduleId: string
  accountId: string
}

export async function handleModuleInstall(db: ModulaWorkerDb, _config: WorkerConfig, payload: unknown): Promise<void> {
  const p = payload as Partial<InstallPayload>
  if (!p.planId || !p.installationId || !p.releaseId || !p.accountId || !p.moduleId) {
    throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.install payload')
  }
  const release = await db.selectFrom('greenfield_module_releases').selectAll().where('release_id', '=', p.releaseId).executeTakeFirst()
  if (!release || release.release_state !== 'published') throw permanentModuleJob('VALIDATION_FAILED', 'Module release is not published')
  const review = await db
    .selectFrom('greenfield_module_permission_reviews')
    .select('review_id')
    .where('installation_id', '=', p.installationId)
    .where('release_id', '=', p.releaseId)
    .executeTakeFirst()
  if (!review) throw permanentModuleJob('VALIDATION_FAILED', 'Module permission approval missing')

  const now = new Date()
  await db.transaction().execute(async trx => {
    await registerModuleSchemas(trx as any, p.releaseId!)
    await createDefaultSettings(trx as any, p.installationId!, p.moduleId!, p.accountId!, release as any)
    await registerModuleContributions(trx as any, p.releaseId!, release.extension_version_id, {enableExecutable: false})
    await trx.updateTable('greenfield_extension_installations').set({status: 'installedDisabled', updated_at: now}).where('installation_id', '=', p.installationId!).execute()
    await trx.updateTable('greenfield_module_install_plans').set({status: 'completed', updated_at: now}).where('plan_id', '=', p.planId!).execute()
    await trx
      .insertInto('greenfield_extension_lifecycle_events')
      .values({
        event_id: `module-event:${p.installationId}:installed:${now.getTime()}`,
        account_id: p.accountId!,
        extension_id: p.moduleId!,
        event: 'module.installed',
        from_status: 'installing',
        to_status: 'installedDisabled',
        detail: {releaseId: p.releaseId},
        created_at: now,
      })
      .execute()
  })
}

async function createDefaultSettings(db: ModulaWorkerDb, installationId: string, moduleId: string, accountId: string, release: any) {
  const version = await db.selectFrom('greenfield_extension_versions').select('manifest').where('extension_version_id', '=', release.extension_version_id).executeTakeFirst()
  const defaults = ((version?.manifest as any)?.extensions?.settingsDefaults ?? {}) as Record<string, unknown>
  await db
    .insertInto('greenfield_module_installation_settings')
    .values({
      settings_id: `module-settings:${installationId}`,
      installation_id: installationId,
      module_id: moduleId,
      scope: 'installation',
      schema_version: 1,
      values: defaults,
      secret_refs: {},
      version: 1,
      updated_by: accountId,
      updated_at: new Date(),
    })
    .onConflict(oc => oc.column('installation_id').doNothing())
    .execute()
}
