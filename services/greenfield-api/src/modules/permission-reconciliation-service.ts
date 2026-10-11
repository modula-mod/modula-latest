import {rewriteModuleIdentityAliases, resolveCanonicalModuleId} from '@modula/greenfield-contracts'
import {allRuntimePermissionKeys, GreenfieldModuleRuntime2Service} from './runtime2-service.js'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {sql} from 'kysely'
import {uuidv7} from '../lib/uuidv7.js'
import {NOT_INSTALLED_STATUSES} from './installation-status.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'
import {GreenfieldRegistryTrustService} from './registry-trust-service.js'
import {arrayOfStrings} from './runtime-access.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

export type PermissionReconciliationPlan = {
  installationId: string
  moduleId: string
  installationStatus: string
  currentReleaseId: string
  currentVersion: string
  currentReviewId: string | null
  sourceReviewId: string
  sourceReleaseId: string
  sourceVersion: string
  currentGrantedPermissions: string[]
  sourceGrantedPermissions: string[]
  reconciledGrantedPermissions: string[]
  reconciledDeniedPermissions: string[]
  recoveredPermissions: string[]
  unverifiableSourcePermissions: string[]
  changed: boolean
}

export type PermissionReconciliationResult = PermissionReconciliationPlan & {
  reviewId: string
  idempotent: boolean
}

/**
 * Reconciles an exact installation from an operator-selected historical review.
 * A historical grant is eligible only when the same installation/account owns
 * both reviews and the permission is still declared by the current release.
 * New, removed, denied, or otherwise unverifiable permissions are never added.
 */
export class GreenfieldModulePermissionReconciliationService {
  private readonly registry: GreenfieldModuleRegistryService
  private readonly trust: GreenfieldRegistryTrustService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.registry = new GreenfieldModuleRegistryService(db)
    this.trust = new GreenfieldRegistryTrustService(db)
  }

  async plan(input: {installationId: string; sourceReviewId: string}): Promise<PermissionReconciliationPlan> {
    if (!input.installationId || !input.sourceReviewId) {
      throw moduleError('VALIDATION_FAILED', 'Exact installation and source review IDs are required')
    }
    const installation = await this.db
      .selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select([
        'installation.installation_id', 'installation.account_id', 'installation.status',
        'release.release_id', 'release.module_id', 'release.version', 'release.release_state',
      ])
      .where('installation.installation_id', '=', input.installationId)
      .executeTakeFirst()
    if (!installation || NOT_INSTALLED_STATUSES.includes(installation.status as never)) {
      throw moduleError('NOT_FOUND', 'Installed module not found')
    }
    if (installation.release_state !== 'published') {
      throw moduleError('UNTRUSTED_RELEASE', 'Current module release is not published')
    }

    const currentRelease = await this.registry.getVersion(installation.module_id, installation.version)
    const trust = await this.trust.forRelease(currentRelease)
    const allowDevelopmentRelease = this.config.environment === 'development'
      && this.config.moduleAllowUntrustedDevelopmentReleases
    if (!trust.verified && !allowDevelopmentRelease) {
      throw moduleError('UNTRUSTED_RELEASE', `Current release is not production-trusted (signature: ${trust.signature.state})`)
    }

    const source = await this.db
      .selectFrom('greenfield_module_permission_reviews as review')
      .innerJoin('greenfield_module_releases as release', 'release.release_id', 'review.release_id')
      .select([
        'review.review_id', 'review.installation_id', 'review.account_id', 'review.release_id',
        'review.granted_permissions', 'review.denied_permissions',
        'release.module_id', 'release.version',
      ])
      .where('review.review_id', '=', input.sourceReviewId)
      .executeTakeFirst()
    if (!source
      || source.installation_id !== installation.installation_id
      || source.account_id !== installation.account_id
      || resolveCanonicalModuleId(source.module_id) !== resolveCanonicalModuleId(installation.module_id)) {
      throw moduleError('NOT_FOUND', 'Historical permission review not found for this installation')
    }

    const currentReview = await this.db
      .selectFrom('greenfield_module_permission_reviews')
      .select(['review_id', 'granted_permissions'])
      .where('installation_id', '=', installation.installation_id)
      .where('account_id', '=', installation.account_id)
      .where('release_id', '=', installation.release_id)
      .orderBy('reviewed_at', 'desc')
      .orderBy('review_id', 'desc')
      .executeTakeFirst()

    const declared = [...new Set([
      ...currentRelease.manifest.permissions.map(item => item.permission),
      ...allRuntimePermissionKeys(currentRelease.manifest),
    ])].sort()
    const declaredByCanonical = new Map(declared.map(permission => [rewriteModuleIdentityAliases(permission), permission]))
    const currentGranted = arrayOfStrings(currentReview?.granted_permissions)
      .map(permission => declaredByCanonical.get(rewriteModuleIdentityAliases(permission)))
      .filter((permission): permission is string => Boolean(permission))
    const sourceGranted = arrayOfStrings(source.granted_permissions)
    const migrated = sourceGranted
      .map(permission => declaredByCanonical.get(rewriteModuleIdentityAliases(permission)))
      .filter((permission): permission is string => Boolean(permission))
    const reconciledGrantedPermissions = [...new Set([...currentGranted, ...migrated])].sort()
    const recoveredPermissions = reconciledGrantedPermissions
      .filter(permission => !currentGranted.includes(permission))
      .sort()
    const unverifiableSourcePermissions = sourceGranted
      .filter(permission => !declaredByCanonical.has(rewriteModuleIdentityAliases(permission)))
      .sort()
    const reconciledDeniedPermissions = declared
      .filter(permission => !reconciledGrantedPermissions.includes(permission))

    return {
      installationId: installation.installation_id,
      moduleId: resolveCanonicalModuleId(installation.module_id),
      installationStatus: installation.status,
      currentReleaseId: installation.release_id,
      currentVersion: installation.version,
      currentReviewId: currentReview?.review_id ?? null,
      sourceReviewId: source.review_id,
      sourceReleaseId: source.release_id,
      sourceVersion: source.version,
      currentGrantedPermissions: [...new Set(currentGranted)].sort(),
      sourceGrantedPermissions: sourceGranted.sort(),
      reconciledGrantedPermissions,
      reconciledDeniedPermissions,
      recoveredPermissions,
      unverifiableSourcePermissions,
      changed: recoveredPermissions.length > 0,
    }
  }

  async reconcile(input: {
    installationId: string
    sourceReviewId: string
    expectedCurrentReviewId: string | null
    idempotencyKey: string
  }): Promise<PermissionReconciliationResult> {
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const plan = await this.plan(input)
    const installation = await this.db
      .selectFrom('greenfield_extension_installations')
      .select('account_id')
      .where('installation_id', '=', plan.installationId)
      .executeTakeFirstOrThrow()
    const replay = await this.db
      .selectFrom('greenfield_module_permission_reviews')
      .select(['review_id', 'installation_id', 'release_id'])
      .where('account_id', '=', installation.account_id)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (replay) {
      if (replay.installation_id !== plan.installationId || replay.release_id !== plan.currentReleaseId) {
        throw moduleError('CONFLICT', 'Idempotency key belongs to another reconciliation')
      }
      return {...plan, reviewId: replay.review_id, idempotent: true}
    }
    if (plan.currentReviewId !== input.expectedCurrentReviewId) {
      throw moduleError('CONFLICT', 'Current permission review changed after dry-run')
    }
    if (!plan.changed) throw moduleError('CONFLICT', 'Permission reconciliation has no eligible grants to recover')

    const reviewId = uuidv7()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      const latest = await trx
        .selectFrom('greenfield_module_permission_reviews')
        .select('review_id')
        .where('installation_id', '=', plan.installationId)
        .where('account_id', '=', installation.account_id)
        .where('release_id', '=', plan.currentReleaseId)
        .orderBy('reviewed_at', 'desc')
        .orderBy('review_id', 'desc')
        .forUpdate()
        .executeTakeFirst()
      if ((latest?.review_id ?? null) !== input.expectedCurrentReviewId) {
        throw moduleError('CONFLICT', 'Current permission review changed after dry-run')
      }
      await trx.insertInto('greenfield_module_permission_reviews').values({
        review_id: reviewId,
        installation_id: plan.installationId,
        release_id: plan.currentReleaseId,
        account_id: installation.account_id,
        granted_permissions: jsonb(plan.reconciledGrantedPermissions),
        denied_permissions: jsonb(plan.reconciledDeniedPermissions),
        high_risk_increase: false,
        idempotency_key: input.idempotencyKey,
        reviewed_at: now,
      }).execute()
      const release = await this.registry.getVersion(plan.moduleId, plan.currentVersion)
      await new GreenfieldModuleRuntime2Service(this.db).persistPermissionReviewState(trx, {
        installationId: plan.installationId,
        accountId: installation.account_id,
        release,
        grantedPermissions: plan.reconciledGrantedPermissions,
        deniedPermissions: plan.reconciledDeniedPermissions,
      })
      await new AuditRepository(trx).append('module.permissions.reconciled', {
        moduleId: plan.moduleId,
        sourceReviewId: plan.sourceReviewId,
        sourceReleaseId: plan.sourceReleaseId,
        currentReleaseId: plan.currentReleaseId,
        recoveredPermissions: plan.recoveredPermissions,
        deniedPermissions: plan.reconciledDeniedPermissions,
      }, {type: 'moduleInstallation', id: plan.installationId}, {accountId: installation.account_id})
    })
    return {...plan, reviewId, idempotent: false}
  }
}
