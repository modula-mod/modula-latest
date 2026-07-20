import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {OutboxRepository} from '../domains/outbox/repository.js'
import {InstallationService} from './installation-service.js'

/**
 * Catalogue-aware extension lifecycle. Plugin hooks run asynchronously via
 * outbox jobs so a failing plugin cannot crash API readiness.
 */
export class ExtensionLifecycleService {
  private readonly installations: InstallationService

  constructor(private readonly db: ModulaDb) {
    this.installations = new InstallationService(db)
  }

  async listCatalogue() {
    return this.db.selectFrom('greenfield_extension_catalogue').selectAll().orderBy('name').execute()
  }

  async getCatalogueItem(extensionId: string) {
    return this.db
      .selectFrom('greenfield_extension_catalogue')
      .selectAll()
      .where(eb => eb.or([eb('extension_id', '=', extensionId), eb('slug', '=', extensionId)]))
      .executeTakeFirst()
  }

  async install(accountId: string, extensionId: string) {
    const item = await this.requireCatalogueItem(extensionId)
    if (item.catalogue_status === 'unavailable' || item.catalogue_status === 'incompatible') {
      throw Object.assign(new Error('Extension is incompatible'), {code: 'VALIDATION_FAILED'})
    }
    if (item.trust !== 'firstParty' && !item.executable) {
      throw Object.assign(new Error('Untrusted extension cannot execute'), {code: 'FORBIDDEN'})
    }
    const result = await this.installations.install(accountId, item.slug)
    await this.recordEvent(accountId, item.extension_id, 'installRequested', null, 'installing')
    await this.enqueuePlugin(accountId, item.extension_id, 'plugin.install', {installationId: result.installationId})
    await this.recordEvent(accountId, item.extension_id, 'installed', 'installing', 'installed')
    return {...result, status: 'installed'}
  }

  async enable(accountId: string, extensionId: string) {
    const item = await this.requireCatalogueItem(extensionId)
    if (!item.executable || item.trust !== 'firstParty') {
      throw Object.assign(new Error('Untrusted execution denied'), {code: 'FORBIDDEN'})
    }
    await this.setInstallationStatus(accountId, item.slug, 'enabled')
    await this.enqueuePlugin(accountId, item.extension_id, 'plugin.enable', {})
    await this.recordEvent(accountId, item.extension_id, 'enabled', 'installed', 'enabled')
    return {enabled: true}
  }

  async disable(accountId: string, extensionId: string) {
    const item = await this.requireCatalogueItem(extensionId)
    await this.setInstallationStatus(accountId, item.slug, 'disabled')
    await this.enqueuePlugin(accountId, item.extension_id, 'plugin.disable', {})
    await this.recordEvent(accountId, item.extension_id, 'disabled', 'enabled', 'disabled')
    return {disabled: true}
  }

  async configure(accountId: string, extensionId: string, configuration: Record<string, unknown>) {
    const item = await this.requireCatalogueItem(extensionId)
    await this.installations.updatePreferences(accountId, item.slug, configuration)
    await this.enqueuePlugin(accountId, item.extension_id, 'plugin.configure', {configuration})
    await this.recordEvent(accountId, item.extension_id, 'configurationChanged', null, 'needsConfiguration')
    return {configured: true}
  }

  async uninstall(accountId: string, extensionId: string) {
    const item = await this.requireCatalogueItem(extensionId)
    const result = await this.installations.uninstall(accountId, item.slug)
    await this.enqueuePlugin(accountId, item.extension_id, 'plugin.uninstall', {})
    await this.recordEvent(accountId, item.extension_id, 'uninstalled', null, 'removed')
    return result
  }

  async recordFailure(
    accountId: string,
    extensionId: string,
    code: string,
    message: string,
    retryable = false,
    installationId: string | null = null,
  ) {
    await this.db
      .insertInto('greenfield_extension_failures')
      .values({
        failure_id: randomUUID(),
        account_id: accountId,
        extension_id: extensionId,
        installation_id: installationId,
        code,
        message,
        retryable,
        created_at: new Date(),
      })
      .execute()
    await this.recordEvent(accountId, extensionId, 'failed', null, 'failed', {code, message})
  }

  private async requireCatalogueItem(extensionId: string) {
    const item = await this.getCatalogueItem(extensionId)
    if (!item) throw Object.assign(new Error('Extension not found'), {code: 'NOT_FOUND'})
    return item
  }

  private async setInstallationStatus(accountId: string, slug: string, status: string) {
    const installed = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin(
        'greenfield_extension_versions',
        'greenfield_extension_versions.extension_version_id',
        'greenfield_extension_installations.extension_version_id',
      )
      .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
      .select('greenfield_extension_installations.installation_id')
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_extensions.slug', '=', slug)
      .executeTakeFirst()
    if (!installed) throw Object.assign(new Error('Installation not found'), {code: 'NOT_FOUND'})
    await this.db
      .updateTable('greenfield_extension_installations')
      .set({status, updated_at: new Date()})
      .where('installation_id', '=', installed.installation_id)
      .execute()
  }

  private async enqueuePlugin(
    accountId: string,
    extensionId: string,
    eventType: 'plugin.install' | 'plugin.enable' | 'plugin.disable' | 'plugin.configure' | 'plugin.uninstall',
    payload: Record<string, unknown>,
  ) {
    await this.db.transaction().execute(async trx => {
      await new OutboxRepository(trx).enqueue(trx, {
        eventType,
        aggregateType: 'extension',
        aggregateId: extensionId,
        payload: {accountId, extensionId, ...payload},
      })
      await new AuditRepository(trx).append(eventType, {extensionId}, {
        type: 'extension',
        id: extensionId,
        actorId: null,
      })
    })
  }

  private async recordEvent(
    accountId: string,
    extensionId: string,
    event: string,
    fromStatus: string | null,
    toStatus: string | null,
    detail: Record<string, unknown> = {},
  ) {
    await this.db
      .insertInto('greenfield_extension_lifecycle_events')
      .values({
        event_id: randomUUID(),
        account_id: accountId,
        extension_id: extensionId,
        event,
        from_status: fromStatus,
        to_status: toStatus,
        detail,
        created_at: new Date(),
      })
      .execute()
  }
}
