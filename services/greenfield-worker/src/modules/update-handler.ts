import type {ModulaWorkerDb} from '../database.js'
import type {WorkerConfig} from '../config.js'
import {registerModuleContributions, unregisterModuleContributions} from './contribution-registration-handler.js'
import {permanentModuleJob} from './module-job-errors.js'
import {projectStandard2Runtime} from './standard2-runtime-registration.js'
import {projectExtensionLifecycle} from './extension-fabric-projection.js'
import {assertTrustedModuleRelease} from './release-trust-guard.js'
import {assertPermissionReviewPresent} from './permission-review-guard.js'
import {migrateHistoricalInstallationData} from './legacy-installation-data-migration.js'

export async function handleModuleUpdate(db: ModulaWorkerDb, config: WorkerConfig, payload: unknown): Promise<void> {
  const p = payload as any
  if (!p.installationId || !p.targetReleaseId || !p.previousStatus || !p.accountId) throw permanentModuleJob('VALIDATION_FAILED', 'Invalid module.update payload')
  const release = await db.selectFrom('greenfield_module_releases').selectAll().where('release_id', '=', p.targetReleaseId).executeTakeFirst()
  // Superseded releases stay immutable and published, so a downgrade may target them;
  // revoked, quarantined and unpublished releases never bind to an installation.
  if (!release || !['published', 'superseded'].includes(release.release_state)) throw permanentModuleJob('VALIDATION_FAILED', 'Target release unavailable')
  await assertTrustedModuleRelease(db, config, release)
  const review = await db.selectFrom('greenfield_module_permission_reviews')
    .select('review_id')
    .where('installation_id', '=', p.installationId)
    .where('release_id', '=', release.release_id)
    .where('account_id', '=', p.accountId)
    .executeTakeFirst()
  assertPermissionReviewPresent(review)
  const restoredStatus = p.previousStatus === 'installedDisabled' ? 'installedDisabled'
    : p.previousStatus === 'enabled' ? 'enabled' : 'disabled'
  await db.transaction().execute(async trx => {
    const old = await trx.selectFrom('greenfield_extension_installations').select(['extension_version_id', 'account_id'])
      .where('installation_id', '=', p.installationId).forUpdate().executeTakeFirst()
    if (!old || old.account_id !== p.accountId) throw permanentModuleJob('VALIDATION_FAILED', 'Installation is unavailable to this account')
    if (old) {
      const oldRelease = await trx.selectFrom('greenfield_module_releases').select(['release_id', 'module_id', 'version'])
        .where('extension_version_id', '=', old.extension_version_id).executeTakeFirst()
      if (p.legacyTrustMigration && oldRelease?.release_id !== release.release_id) {
        if (!oldRelease || oldRelease.module_id !== release.module_id) throw permanentModuleJob('VALIDATION_FAILED', 'Historical update changed module identity')
        await migrateHistoricalInstallationData(trx, {
          installationId: p.installationId, accountId: p.accountId, moduleId: release.module_id,
          fromVersion: oldRelease.version, toVersion: release.version, targetReleaseId: release.release_id,
        })
      }
      if (oldRelease) await unregisterModuleContributions(trx as any, oldRelease.release_id)
    }
    // The data-ledger scope guard resolves the installation's authoritative
    // release through extension_version_id. Reconcile that control-plane link
    // before projecting release-scoped runtime resources so an upgrade cannot
    // momentarily bind an installation to two different releases.
    await trx
      .updateTable('greenfield_extension_installations')
      .set({extension_version_id: release.extension_version_id, status: restoredStatus, updated_at: new Date()})
      .where('installation_id', '=', p.installationId)
      .execute()
    await registerModuleContributions(trx as any, release.release_id, release.extension_version_id, {enableExecutable: p.previousStatus === 'enabled'})
    await projectStandard2Runtime(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      moduleId: release.module_id,
      releaseId: release.release_id,
      status: p.previousStatus === 'enabled' ? 'registered' : 'disabled',
      jobsPaused: p.previousStatus !== 'enabled',
    })
    await projectExtensionLifecycle(trx as any, {
      installationId: p.installationId,
      accountId: p.accountId,
      productId: release.module_id,
      state: p.previousStatus === 'enabled' ? 'ENABLED' : p.previousStatus === 'installedDisabled' ? 'INSTALLED' : 'DISABLED',
    })
    if (typeof p.planId === 'string' && p.planId) {
      await trx.updateTable('greenfield_module_install_plans').set({status: 'completed', updated_at: new Date()}).where('plan_id', '=', p.planId).execute()
    }
    for (const dependant of Array.isArray(p.incompatibleExtensions) ? p.incompatibleExtensions : []) {
      if (!dependant?.installationId || !dependant?.productId) continue
      await projectExtensionLifecycle(trx as any, {
        installationId: dependant.installationId,
        accountId: p.accountId,
        productId: dependant.productId,
        state: 'INCOMPATIBLE',
        errorCode: 'TARGET_VERSION_INCOMPATIBLE',
      })
      await trx.updateTable('greenfield_extension_installations')
        .set({status: 'incompatible', updated_at: new Date()})
        .where('installation_id', '=', dependant.installationId)
        .where('account_id', '=', p.accountId)
        .execute()
    }
  })
}
