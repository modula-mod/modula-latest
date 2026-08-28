import {
  dependencyProvidesFromManifest,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldDomainEventRepository} from '../events/domain-events.js'
import {moduleError} from '../modules/module-errors.js'

const installedStates = ['installedDisabled', 'enabling', 'enabled', 'disabling', 'disabled', 'updating']
const capabilityRolePattern = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/

export type GreenfieldProvider = {
  capabilityRole: string
  providerProductId: string
  providerVersion: string
  providerInstallationId: string
  providerReleaseId: string
  contractVersion: string
  contractKind: string
  title: string
  installationStatus: string
  enabled: boolean
  isDefault: boolean
}

export class GreenfieldProviderResolutionService {
  constructor(private readonly db: ModulaDb) {}

  async list(accountId: string, capabilityRole: string): Promise<{capabilityRole: string; providers: GreenfieldProvider[]; defaultProvider: GreenfieldProvider | null}> {
    const role = validateCapabilityRole(capabilityRole)
    const [rows, preference] = await Promise.all([
      this.db
        .selectFrom('greenfield_extension_installations')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
        .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
        .select([
          'greenfield_extension_installations.installation_id',
          'greenfield_extension_installations.status',
          'greenfield_module_releases.release_id',
          'greenfield_module_releases.module_id',
          'greenfield_module_releases.version',
          'greenfield_module_versions.manifest',
        ])
        .where('greenfield_extension_installations.account_id', '=', accountId)
        .where('greenfield_extension_installations.status', 'in', installedStates)
        .where('greenfield_module_releases.release_state', '=', 'published')
        .execute(),
      this.db
        .selectFrom('greenfield_account_default_providers')
        .select(['provider_product_id', 'provider_installation_id'])
        .where('account_id', '=', accountId)
        .where('capability_role', '=', role)
        .executeTakeFirst(),
    ])

    const providers = rows.flatMap(row => {
      let contract
      try {
        contract = dependencyProvidesFromManifest(row.manifest as GreenfieldModuleManifest).find(item => item.id === role)
      } catch {
        return []
      }
      if (!contract) return []
      return [{
        capabilityRole: role,
        providerProductId: row.module_id,
        providerVersion: row.version,
        providerInstallationId: row.installation_id,
        providerReleaseId: row.release_id,
        contractVersion: contract.version,
        contractKind: contract.kind,
        title: contract.title,
        installationStatus: row.status,
        enabled: row.status === 'enabled',
        isDefault: row.installation_id === preference?.provider_installation_id && row.module_id === preference.provider_product_id,
      } satisfies GreenfieldProvider]
    }).sort((left, right) => left.providerProductId.localeCompare(right.providerProductId) || left.providerInstallationId.localeCompare(right.providerInstallationId))

    return {capabilityRole: role, providers, defaultProvider: providers.find(provider => provider.isDefault) ?? null}
  }

  async resolve(accountId: string, capabilityRole: string): Promise<GreenfieldProvider> {
    const result = await this.list(accountId, capabilityRole)
    if (result.defaultProvider) {
      if (!result.defaultProvider.enabled) throw moduleError('NOT_FOUND', `Default provider for ${result.capabilityRole} is not enabled`)
      return result.defaultProvider
    }
    const fallback = result.providers.find(provider => provider.enabled)
    if (!fallback) throw moduleError('NOT_FOUND', `No enabled provider for ${result.capabilityRole}`)
    return fallback
  }

  async setDefault(accountId: string, capabilityRole: string, providerInstallationId: string): Promise<GreenfieldProvider> {
    const role = validateCapabilityRole(capabilityRole)
    if (!providerInstallationId.trim()) throw moduleError('VALIDATION_FAILED', 'providerInstallationId is required')
    const available = await this.list(accountId, role)
    const provider = available.providers.find(item => item.providerInstallationId === providerInstallationId)
    if (!provider) throw moduleError('NOT_FOUND', `Installation does not provide ${role}`)
    if (!provider.enabled) throw moduleError('CONFLICT', 'Provider must be enabled before it can be selected')

    await this.db.transaction().execute(async trx => {
      const now = new Date()
      await trx
        .insertInto('greenfield_account_default_providers')
        .values({
          account_id: accountId,
          capability_role: role,
          provider_product_id: provider.providerProductId,
          provider_installation_id: provider.providerInstallationId,
          selected_by_account_id: accountId,
          selected_at: now,
          updated_at: now,
        })
        .onConflict(conflict => conflict.columns(['account_id', 'capability_role']).doUpdateSet({
          provider_product_id: provider.providerProductId,
          provider_installation_id: provider.providerInstallationId,
          selected_by_account_id: accountId,
          selected_at: now,
          updated_at: now,
        }))
        .execute()
      await new GreenfieldDomainEventRepository(trx).append({
        eventType: 'greenfield.provider.default.changed',
        eventVersion: '1.0.0',
        aggregateType: 'account-provider-preference',
        aggregateId: `${accountId}:${role}`,
        accountId,
        producerKind: 'user',
        producerId: accountId,
        productId: provider.providerProductId,
        installationId: provider.providerInstallationId,
        releaseId: provider.providerReleaseId,
        visibility: 'account',
        classification: 'internal',
        payload: {capabilityRole: role, providerProductId: provider.providerProductId},
      })
    })

    return {...provider, isDefault: true}
  }
}

function validateCapabilityRole(value: string): string {
  const role = value.trim()
  if (role.length < 3 || role.length > 160 || !capabilityRolePattern.test(role)) {
    throw moduleError('VALIDATION_FAILED', 'Invalid capability role')
  }
  return role
}
