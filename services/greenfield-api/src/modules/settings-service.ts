import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {redactModuleSecrets} from './module-domain.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleInstallationService} from './installation-service.js'
import {GreenfieldModuleRegistryService} from './registry-service.js'

export class GreenfieldModuleSettingsService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async schema(accountId: string, moduleId: string) {
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const release = await new GreenfieldModuleRegistryService(this.db).getVersion(moduleId, installed.version)
    return {
      moduleId,
      version: installed.version,
      settings: release.manifest.contributions.settings ?? [],
      schemaRefs: (release.manifest.contributions.settings ?? []).map(setting => setting.schemaRef),
      defaults: (release.manifest.extensions?.settingsDefaults ?? {}) as Record<string, unknown>,
    }
  }

  async get(accountId: string, moduleId: string) {
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const settings = await this.db
      .selectFrom('greenfield_module_installation_settings')
      .selectAll()
      .where('installation_id', '=', installed.installationId)
      .executeTakeFirst()
    return settings
      ? {...settings, values: redactModuleSecrets(settings.values)}
      : {module_id: moduleId, installation_id: installed.installationId, version: 0, values: {}, secret_refs: {}}
  }

  async patch(accountId: string, moduleId: string, patch: Record<string, unknown>) {
    const installed = await new GreenfieldModuleInstallationService(this.db, this.config).getInstalled(accountId, moduleId)
    if (!installed) throw moduleError('NOT_FOUND', 'Module installation not found')
    const schema = await this.schema(accountId, moduleId)
    const defaults = schema.defaults
    const knownKeys = new Set(Object.keys(defaults))
    for (const key of Object.keys(patch)) {
      if (knownKeys.size > 0 && !knownKeys.has(key)) throw moduleError('VALIDATION_FAILED', `Unknown module setting ${key}`)
    }
    const existing = await this.db
      .selectFrom('greenfield_module_installation_settings')
      .selectAll()
      .where('installation_id', '=', installed.installationId)
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
            installation_id: installed.installationId,
            module_id: moduleId,
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
    })
    return this.get(accountId, moduleId)
  }
}
