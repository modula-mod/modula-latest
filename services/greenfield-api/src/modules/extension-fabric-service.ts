import {createHash} from 'node:crypto'
import {
  satisfiesSemverRange,
  type GreenfieldModuleManifest,
  type ModulaExtensionContribution,
  type ModulaExtensionPoint,
  type ModulaExtensionProduct,
} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {
  GreenfieldExtensionContributionStatus,
  GreenfieldExtensionRuntimeState,
} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`
const ACTIVE_INSTALLATION_STATES = ['installedDisabled', 'enabling', 'enabled', 'disabling', 'disabled', 'updating'] as const

type PersistInstallInput = {
  installationId: string
  accountId: string
  release: GreenfieldModuleReleaseRecord
  grantedPermissions: string[]
}

type InvocationInput = {
  accountId: string
  extensionProductId: string
  targetProductId: string
  contributionId: string
  actionId: string
  requiredCapabilities: string[]
  resource?: {type: string; id: string; collection?: string}
}

/**
 * Account-scoped extension graph and capability broker. This service projects
 * Standard 2.1 declarations into the existing Greenfield install/runtime
 * architecture; it never executes extension code or grants database access.
 */
export class GreenfieldExtensionFabricService {
  constructor(private readonly db: ModulaDb) {}

  async persistInstallPlanState(trx: any, input: PersistInstallInput): Promise<void> {
    const product = extensionProduct(input.release.manifest)
    if (!product) return
    const now = new Date()
    await trx
      .insertInto('greenfield_extension_runtime_projection')
      .values({
        installation_id: input.installationId,
        account_id: input.accountId,
        product_id: input.release.moduleId,
        product_kind: product.kind,
        release_id: input.release.releaseId,
        version: input.release.version,
        state: 'INSTALLING',
        health_state: 'healthy',
        last_error_code: null,
        last_error_message: null,
        projected_at: now,
        updated_at: now,
      })
      .onConflict((oc: any) => oc.column('installation_id').doUpdateSet({
        release_id: input.release.releaseId,
        version: input.release.version,
        state: 'INSTALLING',
        health_state: 'healthy',
        last_error_code: null,
        last_error_message: null,
        projected_at: now,
        updated_at: now,
      }))
      .execute()

    for (const target of product.targets) {
      const targetInstallation = await trx
        .selectFrom('greenfield_extension_installations')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
        .select([
          'greenfield_extension_installations.installation_id',
          'greenfield_extension_installations.status',
          'greenfield_module_releases.release_id',
          'greenfield_module_releases.module_id',
          'greenfield_module_releases.version',
        ])
        .where('greenfield_extension_installations.account_id', '=', input.accountId)
        .where('greenfield_module_releases.module_id', '=', target.productId)
        .where('greenfield_extension_installations.status', 'in', ACTIVE_INSTALLATION_STATES)
        .executeTakeFirst()
      if (!targetInstallation) {
        throw moduleError('CONFLICT', `Required target ${target.productId}@${target.versionRange} is not installed`)
      }
      if (!satisfiesSemverRange(targetInstallation.version, target.versionRange)) {
        throw moduleError('CONFLICT', `Target ${target.productId}@${targetInstallation.version} does not satisfy ${target.versionRange}`)
      }

      const pointRows = await trx
        .selectFrom('greenfield_extension_points')
        .selectAll()
        .where('release_id', '=', targetInstallation.release_id)
        .execute()
      const points = new Map<string, {point_key: string; contribution_kinds: unknown; required_capability: string | null; max_contributions: number}>(
        pointRows.map((point: any) => [point.point_key, point]),
      )
      for (const requiredPoint of target.requiredExtensionPoints ?? []) {
        if (!points.has(requiredPoint)) throw moduleError('CONFLICT', `Target ${target.productId} does not expose required extension point ${requiredPoint}`)
      }

      await trx
        .insertInto('greenfield_extension_installation_edges')
        .values({
          edge_id: `extension-edge:${input.installationId}:${targetInstallation.installation_id}`,
          account_id: input.accountId,
          source_installation_id: input.installationId,
          source_product_id: input.release.moduleId,
          target_installation_id: targetInstallation.installation_id,
          target_product_id: target.productId,
          relation: 'targets',
          version_range: target.versionRange,
          resolved_version: targetInstallation.version,
          state: 'resolved',
          blocking: true,
          created_at: now,
          updated_at: now,
        })
        .onConflict((oc: any) => oc.columns(['source_installation_id', 'target_installation_id', 'relation']).doUpdateSet({
          version_range: target.versionRange,
          resolved_version: targetInstallation.version,
          state: 'resolved',
          updated_at: now,
        }))
        .execute()

      const capabilities = new Set(target.requiredCapabilities ?? [])
      for (const contribution of product.contributions) {
        const point = points.get(contribution.extensionPoint)
        if (!point) throw moduleError('CONFLICT', `Target ${target.productId} does not expose extension point ${contribution.extensionPoint}`)
        if (!arrayOfStrings(point.contribution_kinds).includes(contribution.kind)) {
          throw moduleError('CONFLICT', `Extension point ${contribution.extensionPoint} does not accept ${contribution.kind}`)
        }
        const existingCount = await trx
          .selectFrom('greenfield_extension_contribution_registrations')
          .select(({fn}: any) => fn.countAll().as('count'))
          .where('account_id', '=', input.accountId)
          .where('target_installation_id', '=', targetInstallation.installation_id)
          .where('extension_point', '=', contribution.extensionPoint)
          .where('status', '!=', 'removed')
          .executeTakeFirst()
        if (Number(existingCount?.count ?? 0) >= point.max_contributions) {
          throw moduleError('CONFLICT', `Extension point ${contribution.extensionPoint} contribution limit reached`)
        }
        if (point.required_capability) capabilities.add(point.required_capability)
        if (contribution.requiredCapability) capabilities.add(contribution.requiredCapability)
        for (const capability of contribution.availability?.requiredCapabilities ?? []) capabilities.add(capability)
        await this.registerContribution(trx, {
          accountId: input.accountId,
          installationId: input.installationId,
          releaseId: input.release.releaseId,
          extensionProductId: input.release.moduleId,
          targetProductId: target.productId,
          targetInstallationId: targetInstallation.installation_id,
          contribution,
          now,
        })
      }

      for (const capability of [...capabilities].sort()) {
        const granted = input.grantedPermissions.includes(capability)
        await trx
          .insertInto('greenfield_extension_capability_grants')
          .values({
            grant_id: `extension-grant:${input.installationId}:${targetInstallation.installation_id}:${capability}`,
            account_id: input.accountId,
            consumer_installation_id: input.installationId,
            consumer_product_id: input.release.moduleId,
            target_installation_id: targetInstallation.installation_id,
            target_product_id: target.productId,
            capability,
            state: granted ? 'granted' : 'denied',
            scope_type: 'installation',
            scope_ref: null,
            approved_by_account_id: granted ? input.accountId : null,
            approved_at: granted ? now : null,
            revoked_at: null,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc: any) => oc.columns(['consumer_installation_id', 'target_installation_id', 'capability', 'scope_type', 'scope_ref']).doUpdateSet({
            state: granted ? 'granted' : 'denied',
            approved_by_account_id: granted ? input.accountId : null,
            approved_at: granted ? now : null,
            revoked_at: null,
            updated_at: now,
          }))
          .execute()
      }

      for (const declaration of input.release.manifest.contributions.events ?? []) {
        if (declaration.direction !== 'subscribes') continue
        const requiredCapability = [...capabilities].find(capability => capability.endsWith('.events.subscribe')) ?? 'events:subscribe'
        const subscriptionId = `extension-subscription:${input.installationId}:${target.productId}:${declaration.eventType}`
        const enabled = input.grantedPermissions.includes(requiredCapability)
        await trx
          .insertInto('greenfield_extension_event_subscriptions')
          .values({
            subscription_id: subscriptionId,
            account_id: input.accountId,
            installation_id: input.installationId,
            extension_product_id: input.release.moduleId,
            target_product_id: target.productId,
            event_type: declaration.eventType,
            event_version: eventVersion(declaration.eventType),
            required_capability: requiredCapability,
            status: enabled ? 'registered' : 'disabled',
            last_delivery_at: null,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc: any) => oc.columns(['installation_id', 'target_product_id', 'event_type']).doUpdateSet({
            required_capability: requiredCapability,
            status: enabled ? 'registered' : 'disabled',
            updated_at: now,
          }))
          .execute()
        await trx
          .insertInto('greenfield_event_subscriptions')
          .values({
            subscription_id: `domain-${subscriptionId}`,
            event_type: declaration.eventType,
            subscriber_id: subscriptionId,
            target_type: 'background-job',
            target_key: 'extension.event.dispatch',
            filters: jsonb({accountId: input.accountId, targetProductId: target.productId}),
            enabled: false,
            permitted_visibility: ['account', 'internal'],
            permitted_classifications: ['internal', 'private', 'sensitive'],
            subscriber_timeout_ms: 15_000,
            max_concurrency: 1,
            created_at: now,
            updated_at: now,
          })
          .onConflict((oc: any) => oc.columns(['event_type', 'subscriber_id']).doUpdateSet({
            filters: jsonb({accountId: input.accountId, targetProductId: target.productId}),
            enabled: false,
            updated_at: now,
          }))
          .execute()
      }
    }
  }

  async transition(accountId: string, installationId: string, state: GreenfieldExtensionRuntimeState, error?: {code: string; message: string}): Promise<void> {
    const now = new Date()
    const registrationStatus = contributionStatusForState(state)
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_extension_runtime_projection')
        .set({
          state,
          health_state: healthForState(state),
          last_error_code: error?.code ?? null,
          last_error_message: error?.message ?? null,
          projected_at: now,
          updated_at: now,
        })
        .where('account_id', '=', accountId)
        .where('installation_id', '=', installationId)
        .execute()
      await trx
        .updateTable('greenfield_extension_contribution_registrations')
        .set({status: registrationStatus, last_error_code: error?.code ?? null, updated_at: now})
        .where('account_id', '=', accountId)
        .where('installation_id', '=', installationId)
        .where('status', '!=', 'removed')
        .execute()
      await trx
        .updateTable('greenfield_extension_installation_edges')
        .set({state: edgeStateForState(state), updated_at: now})
        .where('account_id', '=', accountId)
        .where('source_installation_id', '=', installationId)
        .where('state', '!=', 'removed')
        .execute()
      await trx
        .updateTable('greenfield_extension_event_subscriptions')
        .set({status: subscriptionStatusForState(state), updated_at: now})
        .where('account_id', '=', accountId)
        .where('installation_id', '=', installationId)
        .where('status', '!=', 'removed')
        .execute()
      const extensionSubscriptions = await trx
        .selectFrom('greenfield_extension_event_subscriptions')
        .select(['subscription_id', 'required_capability'])
        .where('account_id', '=', accountId)
        .where('installation_id', '=', installationId)
        .execute()
      for (const subscription of extensionSubscriptions) {
        const grant = state === 'ENABLED'
          ? await trx
            .selectFrom('greenfield_extension_capability_grants')
            .select('grant_id')
            .where('account_id', '=', accountId)
            .where('consumer_installation_id', '=', installationId)
            .where('capability', '=', subscription.required_capability)
            .where('state', '=', 'granted')
            .executeTakeFirst()
          : null
        const enabled = state === 'ENABLED' && Boolean(grant)
        await trx
          .updateTable('greenfield_event_subscriptions')
          .set({enabled, updated_at: now})
          .where('subscriber_id', '=', subscription.subscription_id)
          .execute()
        await trx
          .updateTable('greenfield_extension_event_subscriptions')
          .set({status: enabled ? 'enabled' : subscriptionStatusForState(state), updated_at: now})
          .where('subscription_id', '=', subscription.subscription_id)
          .execute()
      }
      const projection = await trx
        .selectFrom('greenfield_extension_runtime_projection')
        .select(['product_id'])
        .where('installation_id', '=', installationId)
        .executeTakeFirst()
      if (projection) {
        await new AuditRepository(trx).append(`extension.${auditActionForState(state)}`, {
          productId: projection.product_id,
          state,
          errorCode: error?.code,
        }, {type: 'extensionInstallation', id: installationId})
      }
    })
  }

  async composeHost(accountId: string, targetProductId: string, input: {platform?: string; route?: string; online?: boolean} = {}) {
    const target = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.status',
        'greenfield_module_releases.release_id',
        'greenfield_module_releases.version',
        'greenfield_module_versions.manifest',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.module_id', '=', targetProductId)
      .where('greenfield_extension_installations.status', '!=', 'removed')
      .executeTakeFirst()
    if (!target) throw moduleError('NOT_FOUND', 'Target product installation not found')

    const platform = input.platform ?? 'web'
    const rows = await this.db
      .selectFrom('greenfield_extension_contribution_registrations')
      .innerJoin('greenfield_extension_runtime_projection', 'greenfield_extension_runtime_projection.installation_id', 'greenfield_extension_contribution_registrations.installation_id')
      .leftJoin('greenfield_release_frontends', 'greenfield_release_frontends.release_id', 'greenfield_extension_runtime_projection.release_id')
      .select([
        'greenfield_extension_contribution_registrations.contribution_registration_id',
        'greenfield_extension_contribution_registrations.extension_product_id',
        'greenfield_extension_contribution_registrations.contribution_id',
        'greenfield_extension_contribution_registrations.contribution_kind',
        'greenfield_extension_contribution_registrations.extension_point',
        'greenfield_extension_contribution_registrations.contract_id',
        'greenfield_extension_contribution_registrations.required_capability',
        'greenfield_extension_contribution_registrations.platforms',
        'greenfield_extension_contribution_registrations.requires_online',
        'greenfield_extension_contribution_registrations.priority',
        'greenfield_extension_contribution_registrations.status',
        'greenfield_extension_contribution_registrations.last_error_code',
        'greenfield_extension_contribution_registrations.declaration',
        'greenfield_release_frontends.frontend_id',
        'greenfield_release_frontends.artifact_sha256 as frontend_artifact_sha256',
        'greenfield_release_frontends.runtime_projection as frontend_runtime_projection',
      ])
      .where('greenfield_extension_contribution_registrations.account_id', '=', accountId)
      .where('greenfield_extension_contribution_registrations.target_product_id', '=', targetProductId)
      .where('greenfield_extension_contribution_registrations.target_installation_id', '=', target.installation_id)
      .where('greenfield_extension_contribution_registrations.status', '=', 'enabled')
      .where('greenfield_extension_runtime_projection.state', '=', 'ENABLED')
      .orderBy('greenfield_extension_contribution_registrations.priority', 'desc')
      .orderBy('greenfield_extension_contribution_registrations.extension_product_id')
      .orderBy('greenfield_extension_contribution_registrations.contribution_id')
      .execute()
    const contributions: Array<Record<string, unknown>> = []
    for (const row of rows) {
      const platforms = arrayOfStrings(row.platforms)
      if (platforms.length && !platforms.includes(platform)) continue
      if (row.requires_online && input.online === false) continue
      const {frontend_id, frontend_artifact_sha256, frontend_runtime_projection, ...registration} = row
      if (!frontend_id) {
        contributions.push({...registration, frontend_source: 'legacy', frontend_artifact_sha256: null})
        continue
      }
      const frontend = isRecord(frontend_runtime_projection) ? frontend_runtime_projection : null
      const declared = Array.isArray(frontend?.contributions)
        ? frontend.contributions.filter(isRecord).find(contribution =>
          contribution.id === registration.contribution_id
          && contribution.target === registration.extension_point,
        )
        : null
      if (!declared) continue
      const action = Array.isArray(frontend?.actions)
        ? frontend.actions.filter(isRecord).find(candidate => candidate.id === declared.action)
        : null
      const base = isRecord(registration.declaration) ? registration.declaration : {}
      contributions.push({
        ...registration,
        frontend_source: 'mps',
        frontend_artifact_sha256,
        declaration: {
          ...base,
          title: localizedText(action?.label, localizedText(declared.title, registration.contribution_id)),
          actionId: typeof declared.action === 'string' ? declared.action : base.actionId,
          frontend: isRecord(declared.component) ? declared.component : null,
          source: 'mps-product-frontend',
        },
      })
    }
    const points = await this.db
      .selectFrom('greenfield_extension_points')
      .select(['point_key', 'title', 'contribution_kinds', 'required_capability', 'platforms', 'max_contributions'])
      .where('release_id', '=', target.release_id)
      .orderBy('point_key')
      .execute()
    return {
      target: {productId: targetProductId, installationId: target.installation_id, version: target.version, status: target.status},
      route: input.route ?? null,
      platform,
      core: {manifest: target.manifest, extensionPoints: points},
      extensions: contributions,
      failureIsolation: true,
      arbitraryRemoteCode: false,
    }
  }

  async relationships(productId: string) {
    const [targets, extensions] = await Promise.all([
      this.db
        .selectFrom('greenfield_extension_targets')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_extension_targets.release_id')
        .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
        .select(['greenfield_extension_targets.target_product_id', 'greenfield_extension_targets.version_range', 'greenfield_extension_targets.required_capabilities', 'greenfield_extension_targets.required_extension_points', 'greenfield_module_releases.module_id', 'greenfield_module_releases.product_kind', 'greenfield_module_releases.version', 'greenfield_module_versions.manifest'])
        .where('greenfield_extension_targets.product_id', '=', productId)
        .where('greenfield_module_releases.release_state', '=', 'published')
        .execute(),
      this.db
        .selectFrom('greenfield_extension_targets')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_extension_targets.release_id')
        .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
        .select(['greenfield_module_releases.module_id', 'greenfield_module_releases.product_kind', 'greenfield_module_releases.version', 'greenfield_extension_targets.version_range', 'greenfield_extension_targets.required_capabilities', 'greenfield_module_versions.manifest'])
        .where('greenfield_extension_targets.target_product_id', '=', productId)
        .where('greenfield_module_releases.release_state', '=', 'published')
        .orderBy('greenfield_module_releases.product_kind')
        .orderBy('greenfield_module_releases.module_id')
        .execute(),
    ])
    const presentExtension = (row: any) => ({
      productId: row.module_id,
      productKind: row.product_kind,
      version: row.version,
      versionRange: row.version_range,
      requiredCapabilities: arrayOfStrings(row.required_capabilities),
      name: row.manifest?.name ?? row.module_id,
      description: row.manifest?.description ?? '',
    })
    const presentedTargets = await Promise.all(targets.map(async (row: any) => {
      const target = await this.db
        .selectFrom('greenfield_module_releases')
        .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
        .select(['greenfield_module_releases.product_kind', 'greenfield_module_releases.version', 'greenfield_module_versions.manifest'])
        .where('greenfield_module_releases.module_id', '=', row.target_product_id)
        .where('greenfield_module_releases.release_state', '=', 'published')
        .orderBy('greenfield_module_releases.published_at', 'desc')
        .executeTakeFirst()
      return {
        productId: row.target_product_id,
        productKind: target?.product_kind ?? 'module',
        version: target?.version ?? '',
        versionRange: row.version_range,
        requiredCapabilities: arrayOfStrings(row.required_capabilities),
        name: (target?.manifest as any)?.name ?? row.target_product_id,
        description: (target?.manifest as any)?.description ?? '',
      }
    }))
    return {productId, targets: presentedTargets, extensions: extensions.map(presentExtension)}
  }

  async targetReview(accountId: string, release: GreenfieldModuleReleaseRecord) {
    const product = extensionProduct(release.manifest)
    if (!product) return {productKind: 'module' as const, targets: [], contributions: [], errors: []}
    const targets = []
    const errors: string[] = []
    for (const target of product.targets) {
      const installed = await this.db
        .selectFrom('greenfield_extension_installations')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
        .select(['greenfield_extension_installations.installation_id', 'greenfield_module_releases.release_id', 'greenfield_module_releases.version'])
        .where('greenfield_extension_installations.account_id', '=', accountId)
        .where('greenfield_module_releases.module_id', '=', target.productId)
        .where('greenfield_extension_installations.status', 'in', ACTIVE_INSTALLATION_STATES)
        .executeTakeFirst()
      const compatible = Boolean(installed && satisfiesSemverRange(installed.version, target.versionRange))
      if (!installed) errors.push(`Required target ${target.productId}@${target.versionRange} is not installed`)
      else if (!compatible) errors.push(`Target ${target.productId}@${installed.version} does not satisfy ${target.versionRange}`)
      const points = installed
        ? await this.db.selectFrom('greenfield_extension_points').select('point_key').where('release_id', '=', installed.release_id).execute()
        : []
      const availablePoints = new Set(points.map(point => point.point_key))
      for (const requiredPoint of target.requiredExtensionPoints ?? []) {
        if (installed && !availablePoints.has(requiredPoint)) errors.push(`Target ${target.productId} does not expose ${requiredPoint}`)
      }
      targets.push({
        productId: target.productId,
        versionRange: target.versionRange,
        installedVersion: installed?.version ?? null,
        installed: Boolean(installed),
        compatible,
        requiredCapabilities: target.requiredCapabilities ?? [],
        requiredExtensionPoints: target.requiredExtensionPoints ?? [],
      })
    }
    return {
      productKind: product.kind,
      targets,
      contributions: product.contributions.map(contribution => ({
        id: contribution.id,
        kind: contribution.kind,
        extensionPoint: contribution.extensionPoint,
        requiredCapability: contribution.requiredCapability ?? null,
      })),
      errors,
    }
  }

  async activeDependants(accountId: string, targetProductId: string, options: {recursive?: boolean} = {}) {
    const queue = [{productId: targetProductId, depth: 0}]
    const seen = new Set([targetProductId])
    const dependants: Array<{installationId: string; productId: string; versionRange: string; blocking: boolean; productKind: string; version: string; state: string}> = []
    while (queue.length) {
      const current = queue.shift()!
      if (current.depth >= 8) throw moduleError('CONFLICT', 'Extension dependant graph exceeds maximum depth 8')
      const rows = await this.db
        .selectFrom('greenfield_extension_installation_edges')
        .innerJoin('greenfield_extension_runtime_projection', 'greenfield_extension_runtime_projection.installation_id', 'greenfield_extension_installation_edges.source_installation_id')
        .select([
          'greenfield_extension_installation_edges.source_installation_id as installationId',
          'greenfield_extension_installation_edges.source_product_id as productId',
          'greenfield_extension_installation_edges.version_range as versionRange',
          'greenfield_extension_installation_edges.blocking',
          'greenfield_extension_runtime_projection.product_kind as productKind',
          'greenfield_extension_runtime_projection.version',
          'greenfield_extension_runtime_projection.state',
        ])
        .where('greenfield_extension_installation_edges.account_id', '=', accountId)
        .where('greenfield_extension_installation_edges.target_product_id', '=', current.productId)
        .where('greenfield_extension_installation_edges.state', 'in', ['resolved', 'enabled', 'disabled', 'incompatible'])
        .where('greenfield_extension_runtime_projection.state', 'not in', ['NOT_INSTALLED'])
        .orderBy('greenfield_extension_installation_edges.source_product_id')
        .execute()
      for (const row of rows) {
        if (seen.has(row.productId)) continue
        seen.add(row.productId)
        dependants.push(row)
        if (options.recursive !== false) queue.push({productId: row.productId, depth: current.depth + 1})
        if (dependants.length > 128) throw moduleError('CONFLICT', 'Extension dependant graph exceeds maximum 128 products')
      }
    }
    return dependants
  }

  async developerInspector(accountId: string, productId: string) {
    const projection = await this.db
      .selectFrom('greenfield_extension_runtime_projection')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('product_id', '=', productId)
      .executeTakeFirst()
    if (!projection) throw moduleError('NOT_FOUND', 'Extension runtime projection not found')
    const [edges, contributions, grants, services, jobs] = await Promise.all([
      this.db.selectFrom('greenfield_extension_installation_edges').selectAll().where('account_id', '=', accountId).where('source_installation_id', '=', projection.installation_id).execute(),
      this.db.selectFrom('greenfield_extension_contribution_registrations').selectAll().where('account_id', '=', accountId).where('installation_id', '=', projection.installation_id).execute(),
      this.db.selectFrom('greenfield_extension_capability_grants').selectAll().where('account_id', '=', accountId).where('consumer_installation_id', '=', projection.installation_id).execute(),
      this.db.selectFrom('greenfield_module_service_registrations').select(['service_id', 'status', 'health_state', 'contract_ref']).where('account_id', '=', accountId).where('installation_id', '=', projection.installation_id).execute(),
      this.db.selectFrom('greenfield_extension_job_executions').select(['execution_id', 'action_id', 'status', 'failure_code', 'created_at', 'updated_at']).where('account_id', '=', accountId).where('owner_installation_id', '=', projection.installation_id).orderBy('created_at', 'desc').limit(25).execute(),
    ])
    return {projection, edges, contributions, grants, services, jobs}
  }

  async reviewCapabilities(accountId: string, productId: string, approvedCapabilities: string[]) {
    const projection = await this.requireProjection(accountId, productId)
    const requested = await this.db
      .selectFrom('greenfield_extension_capability_grants')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('consumer_installation_id', '=', projection.installation_id)
      .execute()
    const approved = new Set(approvedCapabilities)
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      for (const grant of requested) {
        const isApproved = approved.has(grant.capability)
        await trx
          .updateTable('greenfield_extension_capability_grants')
          .set({
            state: isApproved ? 'granted' : 'denied',
            approved_by_account_id: isApproved ? accountId : null,
            approved_at: isApproved ? now : null,
            revoked_at: isApproved ? null : now,
            updated_at: now,
          })
          .where('grant_id', '=', grant.grant_id)
          .where('account_id', '=', accountId)
          .execute()
      }
      const eventSubscriptions = await trx
        .selectFrom('greenfield_extension_event_subscriptions')
        .select(['subscription_id', 'required_capability'])
        .where('account_id', '=', accountId)
        .where('installation_id', '=', projection.installation_id)
        .execute()
      for (const subscription of eventSubscriptions) {
        const enabled = projection.state === 'ENABLED' && approved.has(subscription.required_capability)
        await trx
          .updateTable('greenfield_extension_event_subscriptions')
          .set({status: enabled ? 'enabled' : 'disabled', updated_at: now})
          .where('subscription_id', '=', subscription.subscription_id)
          .execute()
        await trx
          .updateTable('greenfield_event_subscriptions')
          .set({enabled, updated_at: now})
          .where('subscriber_id', '=', subscription.subscription_id)
          .execute()
      }
      await new AuditRepository(trx).append('extension.capability.reviewed', {
        productId,
        granted: requested.filter(grant => approved.has(grant.capability)).map(grant => grant.capability),
        denied: requested.filter(grant => !approved.has(grant.capability)).map(grant => grant.capability),
      }, {type: 'extensionInstallation', id: projection.installation_id})
    })
    return this.declaredCapabilities(accountId, productId)
  }

  async declaredCapabilities(accountId: string, productId: string) {
    const projection = await this.requireProjection(accountId, productId)
    return this.db
      .selectFrom('greenfield_extension_capability_grants')
      .select(['grant_id', 'target_product_id', 'capability', 'state', 'scope_type', 'scope_ref', 'approved_at', 'revoked_at'])
      .where('account_id', '=', accountId)
      .where('consumer_installation_id', '=', projection.installation_id)
      .orderBy('target_product_id')
      .orderBy('capability')
      .execute()
  }

  async assertInvocation(input: InvocationInput) {
    const contribution = await this.db
      .selectFrom('greenfield_extension_contribution_registrations')
      .innerJoin('greenfield_extension_runtime_projection', 'greenfield_extension_runtime_projection.installation_id', 'greenfield_extension_contribution_registrations.installation_id')
      .select([
        'greenfield_extension_contribution_registrations.installation_id',
        'greenfield_extension_contribution_registrations.target_installation_id',
        'greenfield_extension_contribution_registrations.contribution_kind',
        'greenfield_extension_contribution_registrations.contract_id',
        'greenfield_extension_contribution_registrations.required_capability',
        'greenfield_extension_contribution_registrations.declaration',
      ])
      .where('greenfield_extension_contribution_registrations.account_id', '=', input.accountId)
      .where('greenfield_extension_contribution_registrations.extension_product_id', '=', input.extensionProductId)
      .where('greenfield_extension_contribution_registrations.target_product_id', '=', input.targetProductId)
      .where('greenfield_extension_contribution_registrations.contribution_id', '=', input.contributionId)
      .where('greenfield_extension_contribution_registrations.status', '=', 'enabled')
      .where('greenfield_extension_runtime_projection.state', '=', 'ENABLED')
      .executeTakeFirst()
    if (!contribution || !contribution.target_installation_id) throw moduleError('FORBIDDEN', 'Extension contribution is not enabled or declared')
    const declaration = contribution.declaration as ModulaExtensionContribution
    const declaredAction = declaration.actionId ?? declaration.functionId ?? contribution.contract_id
    if (declaredAction !== input.actionId) throw moduleError('FORBIDDEN', 'Extension action is not declared by this contribution')
    const required = new Set(input.requiredCapabilities)
    if (contribution.required_capability) required.add(contribution.required_capability)
    for (const capability of declaration.availability?.requiredCapabilities ?? []) required.add(capability)
    for (const capability of required) {
      const grant = await this.db
        .selectFrom('greenfield_extension_capability_grants')
        .select('grant_id')
        .where('account_id', '=', input.accountId)
        .where('consumer_installation_id', '=', contribution.installation_id)
        .where('target_installation_id', '=', contribution.target_installation_id)
        .where('capability', '=', capability)
        .where('state', '=', 'granted')
        .executeTakeFirst()
      if (!grant) throw moduleError('FORBIDDEN', `Undeclared or ungranted capability denied: ${capability}`)
    }

    let resource: unknown = null
    if (input.resource) {
      if (input.resource.type !== 'moduleRecord') throw moduleError('VALIDATION_FAILED', 'Unsupported extension resource scope')
      const row = await this.db
        .selectFrom('greenfield_module_records')
        .select(['record_id', 'module_id', 'collection', 'schema_ref', 'data', 'revision', 'updated_at'])
        .where('account_id', '=', input.accountId)
        .where('module_id', '=', input.targetProductId)
        .where('record_id', '=', input.resource.id)
        .$if(Boolean(input.resource.collection), query => query.where('collection', '=', input.resource!.collection!))
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!row) throw moduleError('NOT_FOUND', 'Scoped target resource not found')
      resource = row
    }
    return {
      consumerInstallationId: contribution.installation_id,
      targetInstallationId: contribution.target_installation_id,
      contributionKind: contribution.contribution_kind,
      capabilities: [...required].sort(),
      scope: input.resource ? {type: 'resource' as const, ref: input.resource.id} : {type: 'action' as const, ref: input.actionId},
      resource,
    }
  }

  async enqueueJob(input: {
    accountId: string
    extensionProductId: string
    targetProductId: string
    contributionId: string
    actionId: string
    idempotencyKey: string
    requestId: string
    metadata?: Record<string, unknown>
  }) {
    const invocation = await this.assertInvocation({
      accountId: input.accountId,
      extensionProductId: input.extensionProductId,
      targetProductId: input.targetProductId,
      contributionId: input.contributionId,
      actionId: input.actionId,
      requiredCapabilities: [],
    })
    if (invocation.contributionKind !== 'background.action') {
      throw moduleError('FORBIDDEN', 'Only declared background.action contributions may enqueue extension jobs')
    }
    const projection = await this.requireProjection(input.accountId, input.extensionProductId)
    if (projection.state !== 'ENABLED') throw moduleError('FORBIDDEN', 'Extension must be enabled')
    const existing = await this.db
      .selectFrom('greenfield_extension_job_executions')
      .selectAll()
      .where('owner_installation_id', '=', projection.installation_id)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (existing) return existing
    const now = new Date()
    const executionId = uuidv7()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_extension_job_executions')
        .values({
          execution_id: executionId,
          job_registration_id: null,
          account_id: input.accountId,
          owner_installation_id: projection.installation_id,
          extension_product_id: input.extensionProductId,
          target_product_id: input.targetProductId,
          action_id: input.actionId,
          status: 'QUEUED',
          attempt_count: 0,
          maximum_attempts: 3,
          idempotency_key: input.idempotencyKey,
          request_id: input.requestId,
          failure_code: null,
          input_hash: sha256(JSON.stringify(input.metadata ?? {})),
          redacted_metadata: jsonb(redactMetadata(input.metadata ?? {})),
          available_at: now,
          started_at: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'extension.job.execute',
        aggregateType: 'extensionJob',
        aggregateId: executionId,
        payload: {executionId, accountId: input.accountId, extensionProductId: input.extensionProductId, requestId: input.requestId},
      })
      await new AuditRepository(trx).append('extension.job.created', {
        extensionProductId: input.extensionProductId,
        targetProductId: input.targetProductId,
        actionId: input.actionId,
      }, {type: 'extensionJob', id: executionId}, {accountId: input.accountId, requestId: input.requestId})
    })
    return this.db.selectFrom('greenfield_extension_job_executions').selectAll().where('owner_installation_id', '=', projection.installation_id).where('idempotency_key', '=', input.idempotencyKey).executeTakeFirstOrThrow()
  }

  async failContribution(accountId: string, extensionProductId: string, contributionId: string, errorCode: string) {
    const registration = await this.db
      .selectFrom('greenfield_extension_contribution_registrations')
      .select(['contribution_registration_id', 'installation_id', 'target_product_id'])
      .where('account_id', '=', accountId)
      .where('extension_product_id', '=', extensionProductId)
      .where('contribution_id', '=', contributionId)
      .executeTakeFirst()
    if (!registration) throw moduleError('NOT_FOUND', 'Extension contribution not found')
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('greenfield_extension_contribution_registrations')
        .set({status: 'failed', last_error_code: errorCode, updated_at: new Date()})
        .where('contribution_registration_id', '=', registration.contribution_registration_id)
        .where('account_id', '=', accountId)
        .execute()
      await new AuditRepository(trx).append('extension.contribution.failed', {
        extensionProductId,
        targetProductId: registration.target_product_id,
        contributionId,
        errorCode,
      }, {type: 'extensionInstallation', id: registration.installation_id}, {accountId})
    })
    return {extensionProductId, contributionId, status: 'failed', coreHostUnaffected: true}
  }

  private async registerContribution(trx: any, input: {
    accountId: string
    installationId: string
    releaseId: string
    extensionProductId: string
    targetProductId: string
    targetInstallationId: string
    contribution: ModulaExtensionContribution
    now: Date
  }) {
    const contractId = input.contribution.actionId ?? input.contribution.functionId ?? input.contribution.viewId ?? input.contribution.widgetId ?? input.contribution.id
    await trx
      .insertInto('greenfield_extension_contribution_registrations')
      .values({
        contribution_registration_id: `extension-contribution:${input.installationId}:${input.targetProductId}:${input.contribution.id}`,
        account_id: input.accountId,
        installation_id: input.installationId,
        release_id: input.releaseId,
        extension_product_id: input.extensionProductId,
        target_product_id: input.targetProductId,
        target_installation_id: input.targetInstallationId,
        contribution_id: input.contribution.id,
        contribution_kind: input.contribution.kind,
        extension_point: input.contribution.extensionPoint,
        contract_id: contractId,
        required_capability: input.contribution.requiredCapability ?? null,
        platforms: jsonb(input.contribution.availability?.platforms ?? []),
        requires_online: input.contribution.availability?.requiresOnline ?? false,
        priority: input.contribution.priority ?? 0,
        status: 'registered',
        last_error_code: null,
        declaration: jsonb(input.contribution),
        created_at: input.now,
        updated_at: input.now,
      })
      .onConflict((oc: any) => oc.columns(['installation_id', 'contribution_id', 'target_product_id']).doUpdateSet({
        release_id: input.releaseId,
        contract_id: contractId,
        required_capability: input.contribution.requiredCapability ?? null,
        platforms: jsonb(input.contribution.availability?.platforms ?? []),
        requires_online: input.contribution.availability?.requiresOnline ?? false,
        priority: input.contribution.priority ?? 0,
        status: 'registered',
        last_error_code: null,
        declaration: jsonb(input.contribution),
        updated_at: input.now,
      }))
      .execute()
  }

  private async requireProjection(accountId: string, productId: string) {
    const projection = await this.db
      .selectFrom('greenfield_extension_runtime_projection')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('product_id', '=', productId)
      .executeTakeFirst()
    if (!projection) throw moduleError('NOT_FOUND', 'Extension runtime projection not found')
    return projection
  }
}

function extensionProduct(manifest: GreenfieldModuleManifest): ModulaExtensionProduct | null {
  const value = (manifest as any).extensionProduct
  return value && typeof value === 'object' && !Array.isArray(value) ? value as ModulaExtensionProduct : null
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function localizedText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value
  if (isRecord(value) && typeof value.default === 'string' && value.default.trim()) return value.default
  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function eventVersion(eventType: string): number {
  const match = eventType.match(/\.v(\d+)$/)
  return match ? Number(match[1]) : 1
}

function contributionStatusForState(state: GreenfieldExtensionRuntimeState): GreenfieldExtensionContributionStatus {
  if (state === 'ENABLED') return 'enabled'
  if (state === 'INCOMPATIBLE') return 'incompatible'
  if (state === 'QUARANTINED') return 'quarantined'
  if (state === 'FAILED') return 'failed'
  if (state === 'NOT_INSTALLED') return 'removed'
  return 'disabled'
}

function edgeStateForState(state: GreenfieldExtensionRuntimeState): 'resolved' | 'enabled' | 'disabled' | 'incompatible' | 'removed' {
  if (state === 'ENABLED') return 'enabled'
  if (state === 'INCOMPATIBLE' || state === 'QUARANTINED' || state === 'FAILED') return 'incompatible'
  if (state === 'NOT_INSTALLED') return 'removed'
  if (state === 'INSTALLED' || state === 'INSTALLING' || state === 'RESOLVING') return 'resolved'
  return 'disabled'
}

function subscriptionStatusForState(state: GreenfieldExtensionRuntimeState): 'registered' | 'enabled' | 'disabled' | 'failed' | 'quarantined' | 'removed' {
  if (state === 'ENABLED') return 'enabled'
  if (state === 'QUARANTINED') return 'quarantined'
  if (state === 'FAILED') return 'failed'
  if (state === 'NOT_INSTALLED') return 'removed'
  if (state === 'INSTALLED' || state === 'INSTALLING' || state === 'RESOLVING') return 'registered'
  return 'disabled'
}

function healthForState(state: GreenfieldExtensionRuntimeState): 'healthy' | 'degraded' | 'unavailable' | 'configuration-required' | 'disabled' | 'quarantined' | 'failed' {
  if (state === 'QUARANTINED') return 'quarantined'
  if (state === 'FAILED') return 'failed'
  if (state === 'INCOMPATIBLE') return 'unavailable'
  if (state === 'DISABLED' || state === 'DISABLING' || state === 'NOT_INSTALLED') return 'disabled'
  return 'healthy'
}

function auditActionForState(state: GreenfieldExtensionRuntimeState): string {
  if (state === 'ENABLED') return 'enabled'
  if (state === 'DISABLED') return 'disabled'
  if (state === 'NOT_INSTALLED') return 'uninstalled'
  if (state === 'UPDATING') return 'update.requested'
  if (state === 'QUARANTINED') return 'quarantined'
  if (state === 'FAILED') return 'failed'
  return 'lifecycle.projected'
}

function redactMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    /content|body|note|token|secret|password|audio|transcript/i.test(key) ? '[redacted]' : entry,
  ]))
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
