import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {assertTrustedExtension} from './trust-policy.js'

export class InstallationService {
  constructor(private readonly db: ModulaDb) {}

  async listInstalled(accountId: string) {
    return this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin(
        'greenfield_extension_versions',
        'greenfield_extension_versions.extension_version_id',
        'greenfield_extension_installations.extension_version_id',
      )
      .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.status',
        'greenfield_extension_installations.config',
        'greenfield_extensions.slug',
        'greenfield_extension_versions.version',
        'greenfield_extension_versions.manifest',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .execute()
  }

  async install(accountId: string, extensionIdOrVersionId: string, capabilities: string[] = []) {
    let version = await this.db
      .selectFrom('greenfield_extension_versions')
      .selectAll()
      .where('extension_version_id', '=', extensionIdOrVersionId)
      .executeTakeFirst()

    if (!version) {
      version = await this.db
        .selectFrom('greenfield_extension_versions')
        .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
        .selectAll('greenfield_extension_versions')
        .where('greenfield_extensions.slug', '=', extensionIdOrVersionId)
        .where('greenfield_extension_versions.status', '=', 'published')
        .executeTakeFirst()
    }

    if (!version) throw Object.assign(new Error('Extension not found'), {code: 'NOT_FOUND'})
    assertTrustedExtension(version.status)

    const installationId = uuidv7()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_extension_installations')
        .values({
          installation_id: installationId,
          extension_version_id: version!.extension_version_id,
          account_id: accountId,
          status: 'active',
          config: {},
          created_at: now,
          updated_at: now,
        })
        .onConflict(oc => oc.columns(['extension_version_id', 'account_id']).where('legacy_duplicate_allowed', '=', false).doUpdateSet({status: 'active', updated_at: now}))
        .execute()
      if (capabilities.length) {
        await trx
          .insertInto('greenfield_extension_capabilities')
          .values(
            capabilities.map(capability => ({
              capability_id: uuidv7(),
              installation_id: installationId,
              capability,
              granted_at: now,
              revoked_at: null,
            })),
          )
          .onConflict(oc => oc.columns(['installation_id', 'capability']).doNothing())
          .execute()
      }
    })
    return {installationId, extensionVersionId: version.extension_version_id}
  }

  async uninstall(accountId: string, extensionIdOrSlug: string) {
    const installed = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin(
        'greenfield_extension_versions',
        'greenfield_extension_versions.extension_version_id',
        'greenfield_extension_installations.extension_version_id',
      )
      .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
      .select(['greenfield_extension_installations.installation_id'])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where(eb =>
        eb.or([
          eb('greenfield_extensions.slug', '=', extensionIdOrSlug),
          eb('greenfield_extension_versions.extension_version_id', '=', extensionIdOrSlug),
        ]),
      )
      .executeTakeFirst()
    if (!installed) throw Object.assign(new Error('Installation not found'), {code: 'NOT_FOUND'})
    await this.db
      .updateTable('greenfield_extension_installations')
      .set({status: 'uninstalled', updated_at: new Date()})
      .where('installation_id', '=', installed.installation_id)
      .execute()
    return {uninstalled: true}
  }

  async updatePreferences(accountId: string, extensionIdOrSlug: string, config: Record<string, unknown>) {
    const installed = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin(
        'greenfield_extension_versions',
        'greenfield_extension_versions.extension_version_id',
        'greenfield_extension_installations.extension_version_id',
      )
      .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
      .select(['greenfield_extension_installations.installation_id', 'greenfield_extension_installations.config'])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where(eb =>
        eb.or([
          eb('greenfield_extensions.slug', '=', extensionIdOrSlug),
          eb('greenfield_extension_versions.extension_version_id', '=', extensionIdOrSlug),
        ]),
      )
      .executeTakeFirst()
    if (!installed) throw Object.assign(new Error('Installation not found'), {code: 'NOT_FOUND'})
    const next = {...((installed.config as Record<string, unknown>) ?? {}), ...config}
    await this.db
      .updateTable('greenfield_extension_installations')
      .set({config: next, updated_at: new Date()})
      .where('installation_id', '=', installed.installation_id)
      .execute()
    return {installationId: installed.installation_id, config: next}
  }
}
