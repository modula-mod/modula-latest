import {contributionCounts} from '@modula/greenfield-module-manifest'
import {
  assertInstallationTransition,
  type GreenfieldModuleInstallPreview,
  type GreenfieldModuleInstallationStatus,
} from '@modula/greenfield-module-registry-contracts'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {GreenfieldModuleCompatibilityService} from './compatibility-service.js'
import {GreenfieldModuleDependencyResolver} from './dependency-resolver.js'
import {GreenfieldModuleLicenseService} from './license-service.js'
import {INSTALLED_MODULE_STATES, type GreenfieldModuleInstallationRow, type GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModulePermissionService} from './permission-service.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

function assertTransitionOrConflict(from: GreenfieldModuleInstallationStatus, to: GreenfieldModuleInstallationStatus): void {
  try {
    assertInstallationTransition(from, to)
  } catch (error) {
    if ((error as any)?.code === 'INVALID_INSTALLATION_TRANSITION') {
      throw moduleError('CONFLICT', error instanceof Error ? error.message : `Invalid module installation transition ${from} -> ${to}`)
    }
    throw error
  }
}

export class GreenfieldModuleInstallationService {
  private readonly registry: GreenfieldModuleRegistryService
  private readonly dependencies: GreenfieldModuleDependencyResolver
  private readonly permissions: GreenfieldModulePermissionService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.registry = new GreenfieldModuleRegistryService(db)
    this.dependencies = new GreenfieldModuleDependencyResolver(db)
    this.permissions = new GreenfieldModulePermissionService(db)
  }

  async listInstalled(accountId: string): Promise<GreenfieldModuleInstallationRow[]> {
    const rows = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.account_id',
        'greenfield_extension_installations.status',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.extension_version_id',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_extension_installations.status', '!=', 'removed')
      .orderBy('greenfield_module_releases.module_id')
      .execute()
    return rows.map(row => ({
      installationId: row.installation_id,
      accountId: row.account_id,
      status: row.status as GreenfieldModuleInstallationStatus,
      moduleId: row.module_id,
      version: row.version,
      extensionVersionId: row.extension_version_id,
    }))
  }

  async getInstalled(accountId: string, moduleId: string): Promise<GreenfieldModuleInstallationRow | undefined> {
    return (await this.listInstalled(accountId)).find(row => row.moduleId === moduleId)
  }

  async installPreview(accountId: string, moduleId: string, version?: string): Promise<GreenfieldModuleInstallPreview> {
    const release = version ? await this.registry.getVersion(moduleId, version) : await this.registry.latestPublished(moduleId)
    const publisher = await this.db.selectFrom('greenfield_publishers').select(['status']).where('publisher_id', '=', release.publisherId).executeTakeFirst()
    const dependencyPlan = await this.dependencies.resolve({moduleId, dependencies: release.manifest.dependencies ?? [], accountId})
    const compatibility = new GreenfieldModuleCompatibilityService(this.config).evaluate(release, {
      platform: 'server',
      publisherStatus: publisher?.status,
      unavailableDependencies: !dependencyPlan.installable,
    })
    const permissions = this.permissions.review(release.manifest)
    const license = new GreenfieldModuleLicenseService().summarize(release.manifest)
    const counts = contributionCounts(release.manifest.contributions)
    return {
      moduleId,
      version: release.version,
      compatible: compatibility.compatible,
      incompatibilityReasons: compatibility.reasons,
      trust: {
        level: release.trustLevel,
        publisherStatus: publisher?.status ?? 'pending',
        releaseStatus: release.releaseState,
      },
      license: {
        status: license.status,
        spdx: release.manifest.license.spdx,
        evidenceSummary: license.evidenceSummary,
      },
      permissions,
      dependencies: dependencyPlan.dependencies,
      contributions: {
        routes: counts.routes,
        profileTabs: counts.profileTabs,
        boardSurfaces: counts.boardSurfaces,
        settings: counts.settings,
        schemas: counts.schemas,
        tools: counts.tools,
        functions: counts.functions,
        widgets: counts.widgets,
        plugins: counts.plugins,
        connectors: counts.connectors,
      },
      migrationsRequired: counts.schemas > 0,
      permissionIncrease: false,
      dataDeletionRisk: false,
    }
  }

  async install(accountId: string, moduleId: string, input: {version?: string; idempotencyKey: string; approvedPermissions?: string[]}) {
    if (!this.config.moduleInstallationEnabled) throw moduleError('CAPABILITY_DISABLED', 'Greenfield module installation is disabled')
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    await this.permissions.enforceModuleInstallCapability(accountId)
    const existingPlan = await this.db
      .selectFrom('greenfield_module_install_plans')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (existingPlan) {
      return {planId: existingPlan.plan_id, installationId: existingPlan.installation_id, status: existingPlan.status, idempotent: true}
    }

    const release = input.version ? await this.registry.getVersion(moduleId, input.version) : await this.registry.latestPublished(moduleId)
    const preview = await this.installPreview(accountId, moduleId, release.version)
    if (!preview.compatible) throw moduleError('VALIDATION_FAILED', `Module is incompatible: ${preview.incompatibilityReasons.join(', ')}`)
    const grantedPermissions = input.approvedPermissions?.length ? input.approvedPermissions : preview.permissions.map(permission => permission.permission)
    const deniedPermissions = preview.permissions.map(permission => permission.permission).filter(permission => !grantedPermissions.includes(permission))

    const now = new Date()
    const installationId = uuidv7()
    const planId = uuidv7()
    let actualInstallationId = installationId
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_extension_installations')
        .values({
          installation_id: installationId,
          extension_version_id: release.extensionVersionId,
          account_id: accountId,
          status: 'installing',
          config: {},
          created_at: now,
          updated_at: now,
        })
        .onConflict(oc => oc.columns(['extension_version_id', 'account_id']).doUpdateSet({status: 'installing', updated_at: now}))
        .execute()
      const installed = await trx
        .selectFrom('greenfield_extension_installations')
        .select('installation_id')
        .where('extension_version_id', '=', release.extensionVersionId)
        .where('account_id', '=', accountId)
        .executeTakeFirstOrThrow()
      actualInstallationId = installed.installation_id
      await trx
        .insertInto('greenfield_module_permission_reviews')
        .values({
          review_id: uuidv7(),
          installation_id: installed.installation_id,
          release_id: release.releaseId,
          account_id: accountId,
          granted_permissions: jsonb(grantedPermissions),
          denied_permissions: jsonb(deniedPermissions),
          high_risk_increase: preview.permissions.some(permission => permission.risk === 'high' || permission.risk === 'restricted'),
          idempotency_key: input.idempotencyKey,
          reviewed_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_module_install_plans')
        .values({
          plan_id: planId,
          account_id: accountId,
          release_id: release.releaseId,
          installation_id: installed.installation_id,
          requested_version: release.version,
          resolved_dependencies: jsonb(preview.dependencies),
          permission_decision: jsonb({grantedPermissions, deniedPermissions}),
          status: 'queued',
          idempotency_key: input.idempotencyKey,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await this.recordLifecycle(trx, accountId, moduleId, 'module.install.requested', 'permissionReview', 'installing', {planId, releaseId: release.releaseId})
      await new AuditRepository(trx).append('module.install.requested', {moduleId, version: release.version, grantedPermissions}, {type: 'module', id: moduleId})
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'module.install' as any,
        aggregateType: 'module',
        aggregateId: moduleId,
        payload: {planId, installationId: installed.installation_id, releaseId: release.releaseId, moduleId, accountId},
      })
    })
    return {planId, installationId: actualInstallationId, status: 'installing'}
  }

  async enable(accountId: string, moduleId: string, idempotencyKey: string) {
    return this.enqueueTransition(accountId, moduleId, 'enabling', 'module.enable.requested', 'module.enable', idempotencyKey)
  }

  async disable(accountId: string, moduleId: string, idempotencyKey: string) {
    return this.enqueueTransition(accountId, moduleId, 'disabling', 'module.disable.requested', 'module.disable', idempotencyKey)
  }

  async enqueueTransition(
    accountId: string,
    moduleId: string,
    nextStatus: GreenfieldModuleInstallationStatus,
    eventName: string,
    jobType: string,
    idempotencyKey: string,
    payload: Record<string, unknown> = {},
  ) {
    if (!idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const installed = await this.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    assertTransitionOrConflict(installed.status, nextStatus)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_extension_installations').set({status: nextStatus, updated_at: now}).where('installation_id', '=', installed.installationId).execute()
      await this.recordLifecycle(trx, accountId, moduleId, eventName, installed.status, nextStatus, {idempotencyKey, ...payload})
      await new AuditRepository(trx).append(eventName, {moduleId, from: installed.status, to: nextStatus}, {type: 'moduleInstallation', id: installed.installationId})
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: jobType as any,
        aggregateType: 'module',
        aggregateId: moduleId,
        payload: {installationId: installed.installationId, moduleId, accountId, previousStatus: installed.status, idempotencyKey, ...payload},
      })
    })
    return {installationId: installed.installationId, moduleId, status: nextStatus}
  }

  async setWorkerStatus(installationId: string, status: GreenfieldModuleInstallationStatus) {
    const row = await this.db.selectFrom('greenfield_extension_installations').selectAll().where('installation_id', '=', installationId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Installation not found')
    assertTransitionOrConflict(row.status as GreenfieldModuleInstallationStatus, status)
    await this.db.updateTable('greenfield_extension_installations').set({status, updated_at: new Date()}).where('installation_id', '=', installationId).execute()
  }

  private async recordLifecycle(
    trx: any,
    accountId: string,
    moduleId: string,
    event: string,
    fromStatus: string | null,
    toStatus: string | null,
    detail: Record<string, unknown>,
  ) {
    await trx
      .insertInto('greenfield_extension_lifecycle_events')
      .values({
        event_id: uuidv7(),
        account_id: accountId,
        extension_id: moduleId,
        event,
        from_status: fromStatus,
        to_status: toStatus,
        detail,
        created_at: new Date(),
      })
      .execute()
  }
}
