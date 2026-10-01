import {contributionCounts} from '@modula/greenfield-module-manifest'
import {NOT_INSTALLED_STATUSES, isInstalledStatus} from './installation-status.js'
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
import {allRuntimePermissionKeys, GreenfieldModuleRuntime2Service} from './runtime2-service.js'
import {GreenfieldModuleIdentityMigrationService} from './identity-migration-service.js'
import {GreenfieldExtensionFabricService} from './extension-fabric-service.js'
import {GreenfieldInstallDescriptorService, type IssuedInstallDescriptor} from './install-descriptor-service.js'
import {GreenfieldRegistryTrustService, type RegistryTrustOptions} from './registry-trust-service.js'
import {
  moduleIdentityAliasesFor,
  moduleIdFamily,
  resolveCanonicalModuleId,
} from '@modula/greenfield-contracts'

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
  private readonly runtime2: GreenfieldModuleRuntime2Service
  private readonly extensionFabric: GreenfieldExtensionFabricService
  private readonly descriptors: GreenfieldInstallDescriptorService
  private readonly trust: GreenfieldRegistryTrustService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.registry = new GreenfieldModuleRegistryService(db, {publicApiUrl: config.publicApiUrl})
    this.descriptors = new GreenfieldInstallDescriptorService(db, config.publicApiUrl)
    this.trust = new GreenfieldRegistryTrustService(db)
    this.dependencies = new GreenfieldModuleDependencyResolver(db)
    this.permissions = new GreenfieldModulePermissionService(db)
    this.runtime2 = new GreenfieldModuleRuntime2Service(db)
    this.extensionFabric = new GreenfieldExtensionFabricService(db)
  }

  async listInstalled(accountId: string): Promise<GreenfieldModuleInstallationRow[]> {
    await new GreenfieldModuleIdentityMigrationService(this.db).normalizeAccount(accountId)
    const rows = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.account_id',
        'greenfield_extension_installations.status',
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.module_id',
        'greenfield_module_releases.version',
        'greenfield_module_releases.extension_version_id',
        'greenfield_module_releases.product_kind',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .orderBy('greenfield_module_releases.module_id')
      .execute()
    const installations = await Promise.all(rows.map(async row => {
      const [review, projection] = await Promise.all([
        this.db
          .selectFrom('greenfield_module_permission_reviews')
          .select(['granted_permissions'])
          .where('account_id', '=', accountId)
          .where('installation_id', '=', row.installation_id)
          .where('release_id', '=', row.release_id)
          .orderBy('reviewed_at', 'desc')
          .executeTakeFirst(),
        this.db
          .selectFrom('greenfield_extension_runtime_projection')
          .select('state')
          .where('account_id', '=', accountId)
          .where('installation_id', '=', row.installation_id)
          .executeTakeFirst(),
      ])
      return {
      installationId: row.installation_id,
      accountId: row.account_id,
      status: row.status as GreenfieldModuleInstallationStatus,
      moduleId: resolveCanonicalModuleId(row.module_id),
      version: row.version,
      extensionVersionId: row.extension_version_id,
      grantedPermissions: arrayOfStrings(review?.granted_permissions),
      productKind: row.product_kind,
      lifecycleState: projection?.state,
      }
    }))
    return collapseAliasedInstallations(installations)
  }

  async getInstalled(accountId: string, moduleId: string): Promise<GreenfieldModuleInstallationRow | undefined> {
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const family = new Set(moduleIdFamily(canonicalId))
    return (await this.listInstalled(accountId)).find(row => family.has(row.moduleId) || resolveCanonicalModuleId(row.moduleId) === canonicalId)
  }

  async installPreview(accountId: string, moduleId: string, version?: string, platform: 'ios' | 'android' | 'web' | 'desktop' | 'server' = 'web'): Promise<GreenfieldModuleInstallPreview> {
    const release = version ? await this.registry.getVersion(moduleId, version) : await this.registry.latestPublished(moduleId)
    const publisher = await this.db.selectFrom('greenfield_publishers').select(['status']).where('publisher_id', '=', release.publisherId).executeTakeFirst()
    const dependencyPlan = await this.dependencies.resolve({moduleId, manifest: release.manifest, accountId})
    const extensionReview = await this.extensionFabric.targetReview(accountId, release)
    const compatibility = new GreenfieldModuleCompatibilityService(this.config).evaluate(release, {
      platform,
      publisherStatus: publisher?.status,
      unavailableDependencies: !dependencyPlan.installable || extensionReview.errors.length > 0,
    })
    const permissions = this.permissions.review(release.manifest)
    const license = new GreenfieldModuleLicenseService().summarize(release.manifest)
    const counts = contributionCounts(release.manifest.contributions)
    return {
      moduleId,
      version: release.version,
      productKind: extensionReview.productKind,
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
      dependencyWarnings: dependencyPlan.warnings,
      extensionTargets: extensionReview.targets,
      extensionContributions: extensionReview.contributions,
      provides: dependencyPlan.provides,
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
        jobs: counts.jobs,
        events: counts.events,
      },
      migrationsRequired: counts.schemas > 0,
      permissionIncrease: false,
      dataDeletionRisk: false,
    }
  }

  async install(accountId: string, moduleId: string, input: {version?: string; idempotencyKey: string; approvedPermissions?: string[]; platform?: 'ios' | 'android' | 'web' | 'desktop' | 'server'; hostVersion?: string | null}) {
    if (!this.config.moduleInstallationEnabled) throw moduleError('CAPABILITY_DISABLED', 'Greenfield module installation is disabled')
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    await this.permissions.enforceModuleInstallCapability(accountId)
    const canonicalId = resolveCanonicalModuleId(moduleId)
    const existingFamily = (await this.listInstalled(accountId)).find(row => resolveCanonicalModuleId(row.moduleId) === canonicalId)
    if (existingFamily && isInstalledStatus(existingFamily.status)) {
      if (input.version && existingFamily.version !== input.version) {
        throw moduleError('CONFLICT', `${canonicalId}@${existingFamily.version} is already installed; use update to move to ${input.version}`)
      }
      return {
        planId: existingFamily.installationId,
        installationId: existingFamily.installationId,
        status: existingFamily.status,
        idempotent: true,
        descriptor: await this.getInstallDescriptor(accountId, canonicalId, {hostVersion: input.hostVersion ?? null}),
      }
    }
    const existingPlan = await this.db
      .selectFrom('greenfield_module_install_plans')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (existingPlan) {
      return {
        planId: existingPlan.plan_id,
        installationId: existingPlan.installation_id,
        status: existingPlan.status,
        idempotent: true,
        descriptor: (existingPlan.install_descriptor ?? null) as IssuedInstallDescriptor | null,
      }
    }

    const release = input.version ? await this.registry.getVersion(canonicalId, input.version) : await this.registry.latestPublished(canonicalId)
    const preview = await this.installPreview(accountId, canonicalId, release.version, input.platform ?? 'web')
    const dependencyPlan = await this.dependencies.resolve({moduleId: canonicalId, manifest: release.manifest, accountId})
    if (!preview.compatible) throw moduleError('VALIDATION_FAILED', `Module is incompatible: ${preview.incompatibilityReasons.join(', ')}`)
    const declaredPermissions = Array.from(new Set([
      ...preview.permissions.map(permission => permission.permission),
      ...allRuntimePermissionKeys(release.manifest),
    ])).sort()
    const grantedPermissions = input.approvedPermissions?.length
      ? input.approvedPermissions.filter(permission => declaredPermissions.includes(permission)).sort()
      : declaredPermissions
    const deniedPermissions = declaredPermissions.filter(permission => !grantedPermissions.includes(permission))
    // Platform support is already enforced by the compatibility preview above;
    // the trust block adds the explicit host-version check when one is sent.
    const trustBlock = await this.trust.forRelease(release, {hostVersion: input.hostVersion ?? null})
    if (['invalid', 'unknownKey', 'revokedKey'].includes(trustBlock.signature.state)) {
      throw moduleError('VALIDATION_FAILED', `Release signature is ${trustBlock.signature.state}; the release cannot be installed`)
    }
    if (trustBlock.compatibility.evaluated && trustBlock.compatibility.compatible === false) {
      throw moduleError('VALIDATION_FAILED', `Module is incompatible with this host: ${trustBlock.compatibility.reasons.map(reason => reason.code).join(', ')}`)
    }

    const now = new Date()
    const installationId = uuidv7()
    const planId = uuidv7()
    let descriptor: IssuedInstallDescriptor | null = null
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
      descriptor = await this.descriptors.build(release, {
        installationId: installed.installation_id,
        grantedPermissions,
        deniedPermissions,
        trustBlock,
      })
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
          install_descriptor: jsonb(descriptor),
          install_descriptor_sha256: descriptor.descriptorSha256,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await this.runtime2.persistInstallPlanState(trx, {
        planId,
        installationId: installed.installation_id,
        accountId,
        release,
        dependencyPlan,
        grantedPermissions,
        deniedPermissions,
      })
      await this.extensionFabric.persistInstallPlanState(trx, {
        installationId: installed.installation_id,
        accountId,
        release,
        grantedPermissions,
      })
      await this.recordLifecycle(trx, accountId, moduleId, 'module.install.requested', 'permissionReview', 'installing', {planId, releaseId: release.releaseId})
      await new AuditRepository(trx).append('module.install.requested', {moduleId, version: release.version, grantedPermissions}, {type: 'module', id: moduleId})
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'module.install' as any,
        aggregateType: 'module',
        aggregateId: moduleId,
        payload: {planId, installationId: installed.installation_id, releaseId: release.releaseId, moduleId, accountId},
      })
    })
    return {planId, installationId: actualInstallationId, status: 'installing', descriptor}
  }

  /**
   * The immutable install descriptor for the account's installed release. The
   * descriptor issued with the install plan is returned when it matches the
   * installed release; otherwise it is rebuilt from registry state.
   */
  async getInstallDescriptor(accountId: string, moduleId: string, trustOptions: RegistryTrustOptions = {}): Promise<IssuedInstallDescriptor> {
    const installed = await this.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const release = await this.registry.getVersion(installed.moduleId, installed.version)
    if (!trustOptions.hostVersion && !trustOptions.platform) {
      const plan = await this.db.selectFrom('greenfield_module_install_plans')
        .select(['install_descriptor'])
        .where('account_id', '=', accountId)
        .where('installation_id', '=', installed.installationId)
        .where('release_id', '=', release.releaseId)
        .where('install_descriptor', 'is not', null)
        .orderBy('created_at', 'desc')
        .executeTakeFirst()
      if (plan?.install_descriptor) return plan.install_descriptor as IssuedInstallDescriptor
    }
    const declared = Array.from(new Set([
      ...release.manifest.permissions.map(permission => permission.permission),
      ...allRuntimePermissionKeys(release.manifest),
    ])).sort()
    const granted = (installed.grantedPermissions ?? []).filter(permission => declared.includes(permission)).sort()
    return this.descriptors.build(release, {
      installationId: installed.installationId,
      grantedPermissions: granted,
      deniedPermissions: declared.filter(permission => !granted.includes(permission)),
      trustOptions,
    })
  }

  async enable(accountId: string, moduleId: string, idempotencyKey: string) {
    await this.runtime2.assertActivationAllowed(accountId, moduleId)
    return this.enqueueTransition(accountId, moduleId, 'enabling', 'module.enable.requested', 'module.enable', idempotencyKey)
  }

  async disable(accountId: string, moduleId: string, idempotencyKey: string) {
    return this.enqueueTransition(accountId, moduleId, 'disabling', 'module.disable.requested', 'module.disable', idempotencyKey)
  }

  async reviewPermissions(accountId: string, moduleId: string, input: {approvedPermissions?: string[]; idempotencyKey: string}) {
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const installed = await this.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const release = await this.registry.getVersion(moduleId, installed.version)
    const declared = Array.from(new Set([
      ...release.manifest.permissions.map(permission => permission.permission),
      ...allRuntimePermissionKeys(release.manifest),
    ])).sort()
    const grantedPermissions = Array.from(new Set(input.approvedPermissions ?? []))
      .filter(permission => declared.includes(permission))
      .sort()
    const deniedPermissions = declared.filter(permission => !grantedPermissions.includes(permission)).sort()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_module_permission_reviews')
        .values({
          review_id: uuidv7(),
          installation_id: installed.installationId,
          release_id: release.releaseId,
          account_id: accountId,
          granted_permissions: jsonb(grantedPermissions),
          denied_permissions: jsonb(deniedPermissions),
          high_risk_increase: false,
          idempotency_key: input.idempotencyKey,
          reviewed_at: now,
        })
        .execute()
      await this.runtime2.persistPermissionReviewState(trx, {
        installationId: installed.installationId,
        accountId,
        release,
        grantedPermissions,
        deniedPermissions,
      })
      await this.recordLifecycle(trx, accountId, moduleId, 'module.permissions.reviewed', installed.status, installed.status, {
        grantedCount: grantedPermissions.length,
        deniedCount: deniedPermissions.length,
      })
      await new AuditRepository(trx).append('module.permissions.reviewed', {moduleId, grantedPermissions, deniedPermissions}, {type: 'moduleInstallation', id: installed.installationId})
    })
    return {installationId: installed.installationId, moduleId, grantedPermissions, deniedPermissions}
  }

  async enqueueTransition(
    accountId: string,
    moduleId: string,
    nextStatus: GreenfieldModuleInstallationStatus,
    eventName: string,
    jobType: string,
    idempotencyKey: string,
    payload: Record<string, unknown> = {},
    prepare?: (trx: any, installed: GreenfieldModuleInstallationRow) => Promise<void>,
  ) {
    if (!idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const installed = await this.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    assertTransitionOrConflict(installed.status, nextStatus)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      if (prepare) await prepare(trx, installed)
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
    await this.extensionFabric.transition(accountId, installed.installationId, runtimeStateForInstallationStatus(nextStatus))
    return {installationId: installed.installationId, moduleId, status: nextStatus}
  }

  async setWorkerStatus(installationId: string, status: GreenfieldModuleInstallationStatus) {
    const row = await this.db.selectFrom('greenfield_extension_installations').selectAll().where('installation_id', '=', installationId).executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Installation not found')
    assertTransitionOrConflict(row.status as GreenfieldModuleInstallationStatus, status)
    await this.db.updateTable('greenfield_extension_installations').set({status, updated_at: new Date()}).where('installation_id', '=', installationId).execute()
    await this.extensionFabric.transition(row.account_id, installationId, runtimeStateForInstallationStatus(status))
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

function runtimeStateForInstallationStatus(status: GreenfieldModuleInstallationStatus) {
  switch (status) {
    case 'resolving': return 'RESOLVING' as const
    case 'installing': return 'INSTALLING' as const
    case 'installedDisabled': return 'INSTALLED' as const
    case 'enabling': return 'ENABLING' as const
    case 'enabled': return 'ENABLED' as const
    case 'disabling': return 'DISABLING' as const
    case 'disabled': return 'DISABLED' as const
    case 'uninstalling': return 'UNINSTALLING' as const
    case 'updating': return 'UPDATING' as const
    case 'updateAvailable': return 'UPDATE_AVAILABLE' as const
    case 'incompatible': return 'INCOMPATIBLE' as const
    case 'quarantined': return 'QUARANTINED' as const
    case 'failed': return 'FAILED' as const
    case 'notInstalled':
    case 'removed': return 'NOT_INSTALLED' as const
    case 'permissionReview': return 'RESOLVING' as const
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

/**
 * A product that has identity aliases can have historical installation rows
 * under several ids. Present one logical installation per canonical product
 * (the enabled one if any). Products without aliases are returned unchanged.
 */
function collapseAliasedInstallations(installations: GreenfieldModuleInstallationRow[]): GreenfieldModuleInstallationRow[] {
  const result: GreenfieldModuleInstallationRow[] = []
  const aliased = new Map<string, GreenfieldModuleInstallationRow[]>()
  for (const row of installations) {
    const canonicalId = resolveCanonicalModuleId(row.moduleId)
    if (!moduleIdentityAliasesFor(canonicalId).length) { result.push(row); continue }
    aliased.set(canonicalId, [...(aliased.get(canonicalId) ?? []), row])
  }
  for (const [canonicalId, rows] of aliased) {
    const preferred = rows.find(row => row.status === 'enabled') ?? rows[0]!
    result.push({...preferred, moduleId: canonicalId})
  }
  return result
}
