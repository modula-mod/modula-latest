import {
  validateGreenfieldModuleAction,
  validateGreenfieldModuleCollection,
  validateGreenfieldModuleView,
  type GreenfieldModuleAction,
  type GreenfieldModuleCollectionDefinition,
  type GreenfieldModuleView,
} from '@modula/greenfield-module-ui-contracts'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {moduleError} from './module-errors.js'
import {arrayOfStrings, collectionPermission, GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

export type GreenfieldModuleViewResponse = {
  moduleId: string
  version: string
  installationStatus: string
  releaseState: string
  available: boolean
  views: Array<GreenfieldModuleView & {allowedActions: GreenfieldModuleAction[]}>
}

export class GreenfieldModuleViewService {
  private readonly access: GreenfieldModuleRuntimeAccessService

  constructor(private readonly db: ModulaDb, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async listViews(accountId: string, moduleId: string): Promise<GreenfieldModuleViewResponse> {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    const rows = await this.db
      .selectFrom('greenfield_module_views')
      .selectAll()
      .where('release_id', '=', context.releaseId)
      .where('registration_status', '!=', 'quarantined')
      .where('registration_status', '!=', 'revoked')
      .orderBy('view_key')
      .execute()
    const actions = await this.actionsById(context)
    const views = rows
      .map(row => this.safeView(row.declaration, context))
      .filter((view): view is GreenfieldModuleView => Boolean(view))
      .map(view => ({
        ...view,
        allowedActions: (view.toolbar ?? []).filter(action => actions.has(action.actionId) && this.hasCapability(context, action.capability)),
      }))
    return {
      moduleId,
      version: context.version,
      installationStatus: context.installationStatus,
      releaseState: context.releaseState,
      available: context.installationStatus === 'enabled',
      views,
    }
  }

  async getView(accountId: string, moduleId: string, viewId: string): Promise<GreenfieldModuleView & {allowedActions: GreenfieldModuleAction[]; available: boolean}> {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    const row = await this.db
      .selectFrom('greenfield_module_views')
      .selectAll()
      .where('release_id', '=', context.releaseId)
      .where('view_key', '=', viewId)
      .where('registration_status', '!=', 'quarantined')
      .where('registration_status', '!=', 'revoked')
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module view not found')
    const view = this.safeView(row.declaration, context)
    if (!view) throw moduleError('VALIDATION_FAILED', 'Installed module view declaration is invalid')
    for (const capability of view.requiredCapabilities) this.access.enforceCapability(context, capability)
    const actions = await this.actionsById(context)
    return {
      ...view,
      allowedActions: (view.toolbar ?? []).filter(action => actions.has(action.actionId) && this.hasCapability(context, action.capability)),
      available: context.installationStatus === 'enabled',
    }
  }

  async listCollections(accountId: string, moduleId: string): Promise<GreenfieldModuleCollectionDefinition[]> {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    return this.collectionsForRelease(context)
  }

  async collectionsForRelease(context: GreenfieldModuleRuntimeContext): Promise<GreenfieldModuleCollectionDefinition[]> {
    const rows = await this.db
      .selectFrom('greenfield_module_record_collections')
      .selectAll()
      .where('release_id', '=', context.releaseId)
      .where('registration_status', '!=', 'quarantined')
      .where('registration_status', '!=', 'revoked')
      .execute()
    const definitions = rows.map(row => {
      const candidate: GreenfieldModuleCollectionDefinition = {
        collection: row.collection,
        schemaRef: row.schema_ref,
        defaultVisibility: row.default_visibility,
        fields: Array.isArray(row.fields) ? (row.fields as GreenfieldModuleCollectionDefinition['fields']) : [],
        searchableFields: arrayOfStrings(row.searchable_fields),
        filterableFields: arrayOfStrings(row.filterable_fields),
        sortableFields: arrayOfStrings(row.sortable_fields),
        folderField: row.folder_field ?? undefined,
        referenceFields: arrayOfStrings(row.reference_fields),
        ...(row.schema_definition && typeof row.schema_definition === 'object' && !Array.isArray(row.schema_definition)
          ? {schemaDefinition: row.schema_definition as Record<string, unknown>} : {}),
        retentionPolicy: row.retention_policy,
      }
      const result = validateGreenfieldModuleCollection(candidate, context.moduleId)
      return result.valid ? result.value! : null
    })
    const declared = definitions.filter((definition): definition is GreenfieldModuleCollectionDefinition => Boolean(definition))
    if (declared.length > 0) return declared
    return (context.manifest.contributions.schemas ?? []).map(schema => ({
      collection: schema.collection,
      schemaRef: schema.schemaRef,
      defaultVisibility: schema.defaultVisibility,
      fields: [],
      searchableFields: [],
      filterableFields: [],
      sortableFields: [],
      retentionPolicy: 'keepOnUninstall',
    }))
  }

  private async actionsById(context: GreenfieldModuleRuntimeContext): Promise<Map<string, GreenfieldModuleAction>> {
    const rows = await this.db
      .selectFrom('greenfield_module_actions')
      .selectAll()
      .where('release_id', '=', context.releaseId)
      .where('registration_status', '!=', 'quarantined')
      .where('registration_status', '!=', 'revoked')
      .execute()
    const actions = new Map<string, GreenfieldModuleAction>()
    for (const row of rows) {
      const result = validateGreenfieldModuleAction(row.declaration, context.moduleId)
      if (result.valid && result.value) actions.set(result.value.actionId, result.value)
    }
    return actions
  }

  private safeView(value: unknown, context: GreenfieldModuleRuntimeContext): GreenfieldModuleView | null {
    const result = validateGreenfieldModuleView(value)
    if (!result.valid || !result.value || result.value.moduleId !== context.moduleId) return null
    if (result.value.collection) this.access.enforceCapability(context, collectionPermission(context.moduleId, result.value.collection, 'read'))
    return result.value
  }

  private hasCapability(context: GreenfieldModuleRuntimeContext, capability: string): boolean {
    return context.grantedPermissions.includes(capability)
  }
}
