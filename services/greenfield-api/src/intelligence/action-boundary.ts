import type {GaiaAvailableAction, ModulaActionProposal} from '@modula/intelligence-contracts'
import type {GreenfieldModuleCollectionDefinition, GreenfieldModuleFieldDefinition} from '@modula/greenfield-module-ui-contracts'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldModuleRecordService, type ModuleRecordQuery} from '../modules/record-service.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService} from '../modules/runtime-access.js'
import {GreenfieldModuleViewService} from '../modules/view-service.js'

const VAULT_NOTES = 'digital.modula.vault-notes'

export type ResolvedProposalBoundary = {
  registered: boolean
  schemaValid: boolean
  permissionGranted: boolean
  workspaceAccess: boolean
  collection?: GreenfieldModuleCollectionDefinition
}

export class IntelligenceActionBoundary {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly views: GreenfieldModuleViewService
  private readonly records: GreenfieldModuleRecordService

  constructor(private readonly db: ModulaDb) {
    this.access = new GreenfieldModuleRuntimeAccessService(db)
    this.views = new GreenfieldModuleViewService(db)
    this.records = new GreenfieldModuleRecordService(db)
  }

  async availableActions(accountId: string): Promise<GaiaAvailableAction[]> {
    try {
      const context = await this.access.resolve(accountId, VAULT_NOTES, {requireEnabled: true})
      const collection = (await this.views.collectionsForRelease(context)).find(item => item.collection === 'note')
      if (!collection) return []
      const result: GaiaAvailableAction[] = []
      const read = collectionPermission(context.moduleId, collection.collection, 'read')
      const write = collectionPermission(context.moduleId, collection.collection, 'write')
      if (context.grantedPermissions.includes(read)) result.push({family: 'record.query', capability: read, moduleId: context.moduleId, collection: collection.collection})
      if (context.grantedPermissions.includes(write)) result.push({family: 'record.create', capability: write, moduleId: context.moduleId, collection: collection.collection})
      return result
    } catch {
      return []
    }
  }

  async revalidate(accountId: string, workspaceId: string | undefined, proposal: ModulaActionProposal): Promise<ResolvedProposalBoundary> {
    if (!proposal.moduleId || !['record.query', 'record.create'].includes(proposal.family)) {
      return {registered: false, schemaValid: isBasicProposal(proposal), permissionGranted: false, workspaceAccess: await this.hasWorkspaceAccess(accountId, workspaceId)}
    }
    try {
      const context = await this.access.resolve(accountId, proposal.moduleId, {requireEnabled: true})
      const input = record(proposal.input)
      const collectionName = typeof input.collection === 'string' ? input.collection : ''
      const collection = (await this.views.collectionsForRelease(context)).find(item => item.collection === collectionName)
      const expected = collectionPermission(context.moduleId, collectionName, proposal.family === 'record.query' ? 'read' : 'write')
      return {
        registered: Boolean(collection) && proposal.capability === expected,
        schemaValid: Boolean(collection) && validateProposalInput(proposal, collection!),
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

function validateProposalInput(proposal: ModulaActionProposal, collection: GreenfieldModuleCollectionDefinition): boolean {
  if (!isBasicProposal(proposal)) return false
  const input = record(proposal.input)
  if (input.collection !== collection.collection) return false
  if (proposal.family === 'record.query') {
    const limit = input.limit === undefined ? 25 : Number(input.limit)
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return false
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

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}
