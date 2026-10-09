import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {sql} from 'kysely'
import {uuidv7} from '../lib/uuidv7.js'
import {GreenfieldExtensionFabricService} from './extension-fabric-service.js'
import {GreenfieldModuleRuntime2Service} from './runtime2-service.js'
import type {IssuedInstallDescriptor} from './install-descriptor-service.js'
import {GreenfieldModuleVersionSwitchService, type VersionSwitchOptions} from './version-switch-service.js'
import {GreenfieldRegistryTrustService} from './registry-trust-service.js'
import {resolveCanonicalModuleId} from '@modula/greenfield-contracts'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

export type GreenfieldModuleUpdateInput = {
  version?: string
  idempotencyKey: string
  /** Consent to every newly declared permission at once (legacy flag, still honoured). */
  approvedPermissionIncrease?: boolean
  /** Consent to specific newly declared permissions. */
  approvedPermissions?: string[]
  /** Required when a downgrade targets an older declared data schema. */
  acknowledgeDowngradeRisk?: boolean
  hostVersion?: string | null
  platform?: string | null
}

/**
 * Moves an installation to another release: upgrade or downgrade to any
 * published, non-revoked, compatible version. The registry gates the target,
 * new permissions need explicit consent, and the immutable install descriptor
 * for the target release is issued with the transition. Module data stays put.
 */
export class GreenfieldModuleUpdateService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  private planKey(idempotencyKey: string) {
    return `module-switch:${idempotencyKey}`
  }

  async versions(accountId: string, moduleId: string, options: VersionSwitchOptions = {}) {
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, moduleId)
    return new GreenfieldModuleVersionSwitchService(this.db, this.config).options(installed, moduleId, options)
  }

  async preview(accountId: string, moduleId: string, input: {version?: string} & VersionSwitchOptions) {
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const {incompatibleExtensions: _ignored, projectedGrants: _grants, ...evaluation} = await new GreenfieldModuleVersionSwitchService(this.db, this.config)
      .evaluate(accountId, installed, input.version, input)
    return evaluation
  }

  async update(accountId: string, moduleId: string, input: GreenfieldModuleUpdateInput) {
    return this.updateInternal(accountId, moduleId, input, false)
  }

  /** CLI-only escape from a historical untrusted source to a verified published target. */
  async migrateLegacyInstallation(accountId: string, moduleId: string, input: Pick<GreenfieldModuleUpdateInput, 'version' | 'idempotencyKey' | 'hostVersion' | 'platform'> & {installationId: string}) {
    if (!input.version) throw moduleError('VALIDATION_FAILED', 'A trusted target version is required')
    if (!input.installationId) throw moduleError('VALIDATION_FAILED', 'An exact historical installation ID is required')
    return this.updateInternal(accountId, moduleId, input, true, input.installationId)
  }

  private async updateInternal(accountId: string, moduleId: string, input: GreenfieldModuleUpdateInput, legacyTrustMigration: boolean, exactInstallationId?: string) {
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const installations = new GreenfieldModuleInstallationService(this.db, this.config)
    const installed = exactInstallationId
      ? await installations.getInstallationForAccount(accountId, exactInstallationId)
      : await installations.getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    if (resolveCanonicalModuleId(installed.moduleId) !== resolveCanonicalModuleId(moduleId)) throw moduleError('NOT_FOUND', 'Module installation not found')

    const replay = await this.db.selectFrom('greenfield_module_install_plans')
      .select(['plan_id', 'requested_version', 'install_descriptor', 'installation_id'])
      .where('account_id', '=', accountId)
      .where('idempotency_key', '=', this.planKey(input.idempotencyKey))
      .executeTakeFirst()
    if (replay) {
      if (replay.installation_id !== installed.installationId) throw moduleError('CONFLICT', 'Idempotency key belongs to another installation')
      return {
        installationId: installed.installationId,
        moduleId: installed.moduleId,
        status: installed.status,
        idempotent: true,
        planId: replay.plan_id,
        toVersion: replay.requested_version,
        descriptor: (replay.install_descriptor ?? null) as IssuedInstallDescriptor | null,
      }
    }

    if (legacyTrustMigration) {
      const source = await new GreenfieldModuleRegistryService(this.db).getVersion(installed.moduleId, installed.version)
      if ((await new GreenfieldRegistryTrustService(this.db).forRelease(source)).verified) {
        throw moduleError('CONFLICT', 'Legacy trust migration requires an untrusted installed source')
      }
    }

    const evaluation = await new GreenfieldModuleVersionSwitchService(this.db, this.config).evaluate(accountId, installed, input.version, {
      ...input,
      retainReviewedGrantsOnly: legacyTrustMigration,
    })
    if (legacyTrustMigration && (evaluation.direction !== 'upgrade' || evaluation.trust.releaseState !== 'published' || !evaluation.trust.verified)) {
      throw moduleError('UNTRUSTED_RELEASE', 'Legacy migration requires a newer, published, cryptographically trusted target')
    }
    const summary = {
      fromVersion: evaluation.fromVersion,
      toVersion: evaluation.toVersion,
      direction: evaluation.direction,
      permissions: {added: evaluation.permissions.added, removed: evaluation.permissions.removed},
      warnings: evaluation.warnings,
    }
    if (evaluation.noop) {
      return {
        installationId: installed.installationId,
        moduleId: evaluation.moduleId,
        status: installed.status,
        noop: true,
        ...summary,
        descriptor: await installations.getInstallDescriptor(accountId, evaluation.moduleId, {hostVersion: input.hostVersion ?? null}),
      }
    }
    GreenfieldModuleVersionSwitchService.assertAllowed(evaluation)

    const approved = new Set(input.approvedPermissionIncrease ? evaluation.permissions.requiresConsent : (input.approvedPermissions ?? []))
    const missingConsent = evaluation.permissions.requiresConsent.filter(permission => !approved.has(permission))
    if (missingConsent.length && !legacyTrustMigration) {
      throw moduleError('VALIDATION_FAILED', `PERMISSION_CONSENT_REQUIRED: ${evaluation.toVersion} adds permissions that need your consent: ${missingConsent.join(', ')}`)
    }
    if (evaluation.direction === 'downgrade' && evaluation.dataSchema.older && !input.acknowledgeDowngradeRisk) {
      throw moduleError('VALIDATION_FAILED', `DOWNGRADE_ACKNOWLEDGEMENT_REQUIRED: ${evaluation.toVersion} declares an older data schema; confirm the downgrade to continue`)
    }

    const {granted: grantedPermissions, denied: deniedPermissions} = evaluation.projectedGrants
    const descriptor = evaluation.descriptor
    const release = await new GreenfieldModuleRegistryService(this.db).getVersion(evaluation.moduleId, evaluation.toVersion)
    const extensionFabric = new GreenfieldExtensionFabricService(this.db)
    const runtime2 = new GreenfieldModuleRuntime2Service(this.db)
    const planId = uuidv7()
    const result = await installations.enqueueTransition(accountId, moduleId, 'updating', 'module.update.requested', 'module.update', input.idempotencyKey, {
      planId,
      targetReleaseId: release.releaseId,
      targetVersion: release.version,
      direction: evaluation.direction,
      rollbackSnapshot: {
        previousVersion: installed.version,
        previousStatus: installed.status,
        previousExtensionVersionId: installed.extensionVersionId,
      },
      permissionIncrease: evaluation.permissions.added.length > 0,
      incompatibleExtensions: evaluation.incompatibleExtensions,
      legacyTrustMigration,
    }, async trx => {
      const now = new Date()
      await trx
        .insertInto('greenfield_module_permission_reviews')
        .values({
          review_id: uuidv7(),
          installation_id: installed.installationId,
          release_id: release.releaseId,
          account_id: accountId,
          granted_permissions: jsonb(grantedPermissions),
          denied_permissions: jsonb(deniedPermissions),
          high_risk_increase: evaluation.permissions.highRiskIncrease,
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
          installation_id: installed.installationId,
          requested_version: release.version,
          resolved_dependencies: jsonb([]),
          permission_decision: jsonb({grantedPermissions, deniedPermissions, direction: evaluation.direction, fromVersion: evaluation.fromVersion}),
          status: 'queued',
          idempotency_key: this.planKey(input.idempotencyKey),
          install_descriptor: jsonb(descriptor),
          install_descriptor_sha256: descriptor.descriptorSha256,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await runtime2.persistPermissionReviewState(trx, {
        installationId: installed.installationId,
        accountId,
        release,
        grantedPermissions,
        deniedPermissions,
      })
      await extensionFabric.persistUpdatePlanState(trx, {
        installationId: installed.installationId,
        accountId,
        release,
        grantedPermissions,
      })
    }, exactInstallationId)
    return {...result, planId, ...summary, descriptor}
  }
}
