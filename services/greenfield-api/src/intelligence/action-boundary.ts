import type {GaiaAvailableAction, ModulaActionProposal} from '@modula/intelligence-contracts'
import type {GreenfieldModuleCollectionDefinition, GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import type {ModulaDb} from '../database/client.js'
import type {AppConfig} from '../config/index.js'
import {GreenfieldModuleRecordService, type ModuleRecordQuery} from '../modules/record-service.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'
import {GreenfieldModuleViewService} from '../modules/view-service.js'

const EXECUTABLE_FAMILIES = ['record.query', 'record.create'] as const
type ExecutableFamily = (typeof EXECUTABLE_FAMILIES)[number]

export type ResolvedProposalBoundary = {
  registered: boolean
  schemaValid: boolean
  permissionGranted: boolean
  workspaceAccess: boolean
  collection?: GreenfieldModuleCollectionDefinition
}

export type DeclaredActionProjectionInput = {
  moduleId: string
  manifest: unknown
  collections: GreenfieldModuleCollectionDefinition[]
  grantedPermissions: string[]
}

export class IntelligenceActionBoundary {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService
  private readonly records: GreenfieldModuleRecordService

  constructor(private readonly db: ModulaDb, config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.views = new GreenfieldModuleViewService(db, config)
    this.records = new GreenfieldModuleRecordService(db, config)
  }

  async availableActions(accountId: string): Promise<GaiaAvailableAction[]> {
    const modules = await this.db
      .selectFrom('greenfield_extension_installations as installation')
      .innerJoin('greenfield_module_releases as release', 'release.extension_version_id', 'installation.extension_version_id')
      .select('release.module_id')
      .distinct()
      .where('installation.account_id', '=', accountId)
      .where('installation.status', '=', 'enabled')
      .where('release.release_state', '=', 'published')
      .execute()
    const result: GaiaAvailableAction[] = []
    for (const module of modules) {
      try {
        const context = await this.access.resolve(accountId, module.module_id, {requireEnabled: true})
        const collections = await this.views.collectionsForRelease(context)
        result.push(...projectAiCallableAvailableActions({
          moduleId: context.moduleId,
          manifest: context.manifest,
          collections,
          grantedPermissions: context.grantedPermissions,
        }))
      } catch {
        // A disabled, untrusted, or unreviewed installation contributes no
        // actions; one invalid module must not hide unrelated valid modules.
      }
    }
    return result.sort((left, right) => `${left.moduleId}:${left.collection}:${left.family}:${left.actionId ?? ''}`.localeCompare(`${right.moduleId}:${right.collection}:${right.family}:${right.actionId ?? ''}`))
  }

  async revalidate(accountId: string, workspaceId: string | undefined, proposal: ModulaActionProposal): Promise<ResolvedProposalBoundary> {
    if (!proposal.moduleId || !EXECUTABLE_FAMILIES.includes(proposal.family as ExecutableFamily)) {
      return {registered: false, schemaValid: isBasicProposal(proposal), permissionGranted: false, workspaceAccess: await this.hasWorkspaceAccess(accountId, workspaceId)}
    }
    try {
      const context = await this.access.resolve(accountId, proposal.moduleId, {requireEnabled: true})
      const input = record(proposal.input)
      const collectionName = typeof input.collection === 'string' ? input.collection : ''
      const collections = await this.views.collectionsForRelease(context)
      const collection = collections.find(item => item.collection === collectionName)
      const expected = collectionPermission(context.moduleId, collectionName, proposal.family === 'record.query' ? 'read' : 'write')
      const declared = projectAiCallableAvailableActions({
        moduleId: context.moduleId,
        manifest: context.manifest,
        collections,
        grantedPermissions: context.grantedPermissions,
      }).find(action => actionMatchesProposal(action, proposal, collectionName))
      return {
        registered: Boolean(declared) && Boolean(collection) && proposal.capability === expected,
        schemaValid: Boolean(declared) && Boolean(collection) && validateProposalInput(proposal, collection!, declared),
        permissionGranted: context.grantedPermissions.includes(proposal.capability),
        workspaceAccess: await this.hasWorkspaceAccess(accountId, workspaceId),
        collection,
      }
    } catch {
      return {registered: false, schemaValid: false, permissionGranted: false, workspaceAccess: await this.hasWorkspaceAccess(accountId, workspaceId)}
    }
  }

  async execute(accountId: string, proposal: ModulaActionProposal): Promise<unknown> {
    const input = record(proposal.input)
    const collection = String(input.collection ?? '')
    if (proposal.family === 'record.query' && proposal.moduleId) {
      const query = {...input}
      delete query.collection
      return this.records.list(accountId, proposal.moduleId, collection, query as ModuleRecordQuery)
    }
    if (proposal.family === 'record.create' && proposal.moduleId) {
      return this.records.create(accountId, proposal.moduleId, collection, {
        data: input.data,
        visibility: typeof input.visibility === 'string' ? input.visibility : undefined,
        recordId: typeof input.recordId === 'string' ? input.recordId : undefined,
        mutationId: proposal.idempotencyKey ?? proposal.id,
      })
    }
    throw new Error(`Unsupported governed runtime action ${proposal.family}`)
  }

  private async hasWorkspaceAccess(accountId: string, workspaceId?: string): Promise<boolean> {
    if (!workspaceId) return true
    const membership = await this.db
      .selectFrom('greenfield_developer_organisation_memberships')
      .select('membership_id')
      .where('organisation_id', '=', workspaceId)
      .where('account_id', '=', accountId)
      .where('state', '=', 'ACTIVE')
      .executeTakeFirst()
    return Boolean(membership)
  }
}

export function projectAiCallableAvailableActions(input: DeclaredActionProjectionInput): GaiaAvailableAction[] {
  const functions = arrayOfRecords(record(input.manifest).functions)
  const actions = arrayOfRecords(record(input.manifest).actions)
  const referenced = referencedAiIds(record(input.manifest).ai)
  const functionsById = new Map(functions.filter(item => typeof item.id === 'string').map(item => [String(item.id), item]))
  const projected: GaiaAvailableAction[] = []
  const consumedFunctions = new Set<string>()

  for (const action of actions) {
    const linked = typeof action.functionId === 'string' ? functionsById.get(action.functionId) : undefined
    if (!isDeclaredAiCallable(action, linked, referenced)) continue
    const mapped = mapDeclaredEntry(action, linked, input)
    if (!mapped) continue
    projected.push(mapped)
    if (typeof action.functionId === 'string') consumedFunctions.add(action.functionId)
  }

  for (const fn of functions) {
    if (typeof fn.id === 'string' && consumedFunctions.has(fn.id)) continue
    if (!isDeclaredAiCallable(fn, fn, referenced)) continue
    const mapped = mapDeclaredEntry(fn, fn, input)
    if (mapped) projected.push(mapped)
  }

  return projected
}

function mapDeclaredEntry(
  entry: Record<string, unknown>,
  schemaSource: Record<string, unknown> | undefined,
  input: DeclaredActionProjectionInput,
): GaiaAvailableAction | undefined {
  const actionId = typeof entry.id === 'string' ? entry.id : undefined
  if (!actionId) return undefined
  const family = executableFamily(entry.sideEffects) ?? executableFamily(schemaSource?.sideEffects)
  if (!family) return undefined
  const collection = collectionFromDeclaration(entry, schemaSource, input)
  if (!collection) return undefined
  const capability = collectionPermission(input.moduleId, collection, family === 'record.query' ? 'read' : 'write')
  if (!input.grantedPermissions.includes(capability)) return undefined
  const limits = limitsFromSchema(schemaSource?.inputSchema ?? entry.inputSchema)
  return {
    family,
    capability,
    moduleId: input.moduleId,
    actionId,
    collection,
    ...(limits ? {limits} : {}),
  }
}

function isDeclaredAiCallable(
  entry: Record<string, unknown>,
  linkedFunction: Record<string, unknown> | undefined,
  referenced: Set<string>,
): boolean {
  if (entry.aiCallable === false) return false
  if (entry.aiCallable === true) return true
  if (linkedFunction?.aiCallable === true) return true
  if (typeof entry.id === 'string' && referenced.has(entry.id)) return true
  if (typeof entry.functionId === 'string' && referenced.has(entry.functionId)) return true
  if (typeof linkedFunction?.id === 'string' && referenced.has(linkedFunction.id)) return true
  return false
}

function executableFamily(sideEffects: unknown): ExecutableFamily | undefined {
  if (!Array.isArray(sideEffects)) return undefined
  return EXECUTABLE_FAMILIES.find(family => sideEffects.includes(family))
}

function collectionFromDeclaration(
  entry: Record<string, unknown>,
  schemaSource: Record<string, unknown> | undefined,
  input: DeclaredActionProjectionInput,
): string | undefined {
  const known = new Set(input.collections.map(collection => collection.collection))
  const candidates = [
    collectionFromSchema(schemaSource?.inputSchema ?? entry.inputSchema),
    ...permissionsOf(entry),
    ...permissionsOf(schemaSource),
  ]
  for (const candidate of candidates) {
    const collection = typeof candidate === 'string' && known.has(candidate)
      ? candidate
      : parseCollectionPermission(candidate, input.moduleId)
    if (collection && known.has(collection)) return collection
  }
  if (input.collections.length === 1) return input.collections[0]?.collection
  return undefined
}

function collectionFromSchema(schema: unknown): string | undefined {
  const collection = record(record(record(schema).properties).collection)
  if (typeof collection.const === 'string') return collection.const
  if (typeof collection.default === 'string') return collection.default
  if (Array.isArray(collection.enum) && collection.enum.length === 1 && typeof collection.enum[0] === 'string') return collection.enum[0]
  return undefined
}

function parseCollectionPermission(value: unknown, moduleId: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const prefix = `records:module.${moduleId}.`
  if (!value.startsWith(prefix)) return undefined
  const remainder = value.slice(prefix.length)
  const separator = remainder.lastIndexOf(':')
  if (separator <= 0) return undefined
  return remainder.slice(0, separator)
}

function limitsFromSchema(schema: unknown): GaiaAvailableAction['limits'] | undefined {
  const limit = record(record(record(schema).properties).limit)
  const limits: NonNullable<GaiaAvailableAction['limits']> = {}
  if (Number.isInteger(limit.minimum)) limits.min = Number(limit.minimum)
  if (Number.isInteger(limit.maximum)) limits.max = Number(limit.maximum)
  if (Number.isInteger(limit.default)) limits.default = Number(limit.default)
  return Object.keys(limits).length > 0 ? limits : undefined
}

function referencedAiIds(ai: unknown): Set<string> {
  const ids = new Set<string>()
  if (!Array.isArray(ai)) return ids
  for (const integration of ai) {
    if (!isRecord(integration)) continue
    const tools = integration.toolDefinitions
    if (!Array.isArray(tools)) continue
    for (const tool of tools) {
      if (typeof tool === 'string') ids.add(tool)
      if (!isRecord(tool)) continue
      for (const key of ['id', 'actionId', 'functionId', 'toolId'] as const) {
        if (typeof tool[key] === 'string') ids.add(tool[key])
      }
    }
  }
  return ids
}

function actionMatchesProposal(action: GaiaAvailableAction, proposal: ModulaActionProposal, collectionName: string): boolean {
  if (action.family !== proposal.family) return false
  if (action.moduleId !== proposal.moduleId) return false
  if (action.collection !== collectionName) return false
  if (action.capability !== proposal.capability) return false
  if (proposal.actionId && action.actionId !== proposal.actionId) return false
  return true
}

function validateProposalInput(
  proposal: ModulaActionProposal,
  collection: GreenfieldModuleCollectionDefinition,
  declared?: GaiaAvailableAction,
): boolean {
  if (!isBasicProposal(proposal)) return false
  const input = record(proposal.input)
  if (input.collection !== collection.collection) return false
  if (proposal.family === 'record.query') {
    const limit = input.limit === undefined ? (declared?.limits?.default ?? 25) : Number(input.limit)
    const min = declared?.limits?.min ?? 1
    const max = declared?.limits?.max ?? 100
    if (!Number.isInteger(limit) || limit < min || limit > max) return false
    const sort = input.sort === undefined ? 'updatedAt' : String(input.sort)
    if (!['createdAt', 'updatedAt', ...collection.sortableFields].includes(sort)) return false
    if (input.direction !== undefined && input.direction !== 'asc' && input.direction !== 'desc') return false
    return true
  }
  if (proposal.family === 'record.create') {
    const data = record(input.data)
    const allowed = new Set(collection.fields.map(field => field.name))
    return Object.keys(data).every(key => allowed.has(key))
      && collection.fields.every(field => !field.required || field.name in data)
      && collection.fields.every(field => !(field.name in data) || validField(field, data[field.name]))
  }
  return false
}

function validField(field: GreenfieldModuleFieldDefinition, value: unknown): boolean {
  if (value === null || value === undefined) return !field.required
  if (field.type === 'boolean') return typeof value === 'boolean'
  if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (field.type === 'json' || field.type === 'richText') return typeof value === 'object'
  if (field.type === 'tags' || field.type === 'multiSelect') return Array.isArray(value) && value.every(item => typeof item === 'string')
  return typeof value === 'string'
}

function isBasicProposal(proposal: ModulaActionProposal): boolean {
  return Boolean(proposal.id && proposal.missionId && proposal.family && proposal.capability && proposal.requestedBy === 'gaia' && proposal.input && typeof proposal.input === 'object' && !Array.isArray(proposal.input))
}

function permissionsOf(value: Record<string, unknown> | undefined): unknown[] {
  return Array.isArray(value?.permissions) ? value.permissions : []
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}
