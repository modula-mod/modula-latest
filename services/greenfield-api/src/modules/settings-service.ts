import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {redactModuleSecrets} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

export class GreenfieldModuleSettingsService {
  private readonly access: GreenfieldModuleRuntimeAccessService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async schema(accountId: string, moduleId: string) {
    const context = await this.resolveAuthorized(accountId, moduleId, 'settings:read')
    const settings = context.manifest.contributions.settings ?? []
    return {
      moduleId: context.moduleId,
      version: context.version,
      settings,
      schemaRefs: settings.map(setting => setting.schemaRef),
      defaults: redactModuleSecrets(this.defaultsFor(context)),
    }
  }

  async get(accountId: string, moduleId: string) {
    const context = await this.resolveAuthorized(accountId, moduleId, 'settings:read')
    const settings = await this.db
      .selectFrom('greenfield_module_installation_settings')
      .selectAll()
      .where('installation_id', '=', context.installationId)
      .executeTakeFirst()
    return settings
      ? {...settings, values: redactModuleSecrets(settings.values)}
      : {module_id: context.moduleId, installation_id: context.installationId, version: 0, values: {}, secret_refs: {}}
  }

  async patch(accountId: string, moduleId: string, patch: Record<string, unknown>) {
    const context = await this.resolveAuthorized(accountId, moduleId, 'settings:write')
    const defaults = this.defaultsFor(context)
    const knownKeys = new Set(Object.keys(defaults))
    for (const key of Object.keys(patch)) {
      if (knownKeys.size > 0 && !knownKeys.has(key)) throw moduleError('VALIDATION_FAILED', `Unknown module setting ${key}`)
    }
    const existing = await this.db
      .selectFrom('greenfield_module_installation_settings')
      .selectAll()
      .where('installation_id', '=', context.installationId)
      .executeTakeFirst()
    const now = new Date()
    const nextValues = {...defaults, ...((existing?.values as Record<string, unknown> | undefined) ?? {}), ...patch}
    const nextVersion = (existing?.version ?? 0) + 1
    const settingsId = existing?.settings_id ?? uuidv7()
    await this.db.transaction().execute(async trx => {
      if (existing) {
        await trx
          .updateTable('greenfield_module_installation_settings')
          .set({values: nextValues, version: nextVersion, updated_by: accountId, updated_at: now})
          .where('settings_id', '=', settingsId)
          .execute()
      } else {
        await trx
          .insertInto('greenfield_module_installation_settings')
          .values({
            settings_id: settingsId,
            installation_id: context.installationId,
            module_id: context.moduleId,
            scope: 'installation',
            schema_version: 1,
            values: nextValues,
            secret_refs: {},
            version: nextVersion,
            updated_by: accountId,
            updated_at: now,
          })
          .execute()
      }
      await trx
        .insertInto('greenfield_module_settings_versions')
        .values({
          settings_version_id: uuidv7(),
          settings_id: settingsId,
          version: nextVersion,
          values: nextValues,
          secret_refs: {},
          changed_by: accountId,
          created_at: now,
        })
        .execute()
      await new AuditRepository(trx).append(
        'module.settings.updated',
        {moduleId: context.moduleId, version: nextVersion, changedKeys: Object.keys(patch).sort()},
        {type: 'moduleInstallation', id: context.installationId, actorId: accountId},
        {accountId},
      )
    })
    const acknowledgement = {
      module_id: context.moduleId,
      installation_id: context.installationId,
      version: nextVersion,
      updated_at: now,
    }
    if (!context.grantedPermissions.includes('settings:read')) return acknowledgement
    return {
      settings_id: settingsId,
      ...acknowledgement,
      scope: existing?.scope ?? 'installation',
      schema_version: existing?.schema_version ?? 1,
      values: redactModuleSecrets(nextValues),
      secret_refs: existing?.secret_refs ?? {},
      updated_by: accountId,
    }
  }

  private async resolveAuthorized(accountId: string, moduleId: string, capability: 'settings:read' | 'settings:write') {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    this.access.enforceCapability(context, capability)
    return context
  }

  private defaultsFor(context: GreenfieldModuleRuntimeContext): Record<string, unknown> {
    const defaults = context.manifest.extensions?.settingsDefaults
    return defaults && typeof defaults === 'object' && !Array.isArray(defaults)
      ? defaults as Record<string, unknown>
      : {}
  }
}
