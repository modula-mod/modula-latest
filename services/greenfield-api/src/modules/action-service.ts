import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {validateGreenfieldModuleAction, type GreenfieldModuleAction} from '@modula/greenfield-module-ui-contracts'
import {createHash} from 'node:crypto'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {moduleError} from './module-errors.js'
import {ModuleBackendGatewayService} from './backend/gateway-service.js'
import {GreenfieldModuleRecordService} from './record-service.js'
import {GreenfieldModuleRuntimeAccessService} from './runtime-access.js'
import {GreenfieldModuleSettingsService} from './settings-service.js'

export class GreenfieldModuleActionService {
  private readonly access: GreenfieldModuleRuntimeAccessService
  private readonly records: GreenfieldModuleRecordService
  private readonly settings: GreenfieldModuleSettingsService
  private readonly backendGateway: ModuleBackendGatewayService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
    this.records = new GreenfieldModuleRecordService(db, config)
    this.settings = new GreenfieldModuleSettingsService(db, config)
    this.backendGateway = new ModuleBackendGatewayService(db, config)
  }

  async execute(accountId: string, moduleId: string, actionId: string, input: {input?: unknown; idempotencyKey?: string; actorId?: string; requestId?: string} = {}) {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    // A prior idempotent result is still protected module output. Do not replay
    // it, or invoke a zero-permission backend action, without a review row.
    if (context.permissionReviewRequired) throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    const payload = normalizeInput(input.input)
    if (this.backendGateway.canHandle(context, actionId)) {
      if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
      const previous = await this.previousEvent(accountId, moduleId, actionId, input.idempotencyKey)
      if (previous) return {idempotent: true, status: previous.status, result: previous.result}
      try {
        const result = await this.backendGateway.executeAction({
          context,
          actionId,
          actorId: input.actorId ?? accountId,
          payload,
          idempotencyKey: input.idempotencyKey,
          requestId: input.requestId,
        })
        await this.recordBackendActionEvent(accountId, moduleId, actionId, input.idempotencyKey, 'completed', payload, result, null)
        return {idempotent: false, status: 'completed', result}
      } catch (error) {
        await this.recordBackendActionEvent(accountId, moduleId, actionId, input.idempotencyKey, 'failed', payload, null, errorCode(error))
        throw error
      }
    }
    const action = await this.resolveAction(context.releaseId, moduleId, actionId)
    this.access.enforceCapability(context, action.capability)
    if (action.requiresIdempotencyKey && !input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    if (input.idempotencyKey) {
      const previous = await this.previousEvent(accountId, moduleId, actionId, input.idempotencyKey)
      if (previous) return {idempotent: true, status: previous.status, result: previous.result}
    }

    const result = await this.dispatch(accountId, moduleId, action, payload)
    await this.recordEvent(accountId, moduleId, action, input.idempotencyKey ?? null, 'completed', payload, result, null)
    return {idempotent: false, status: 'completed', result}
  }

  private async previousEvent(accountId: string, moduleId: string, actionId: string, idempotencyKey: string) {
    return this.db
      .selectFrom('greenfield_module_action_events')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('module_id', '=', moduleId)
      .where('action_id', '=', actionId)
      .where('idempotency_key', '=', idempotencyKey)
      .executeTakeFirst()
  }

  private async resolveAction(releaseId: string, moduleId: string, actionId: string): Promise<GreenfieldModuleAction> {
    const row = await this.db
      .selectFrom('greenfield_module_actions')
      .selectAll()
      .where('release_id', '=', releaseId)
      .where('action_id', '=', actionId)
      .where('registration_status', '!=', 'quarantined')
      .where('registration_status', '!=', 'revoked')
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module action not found')
    const result = validateGreenfieldModuleAction(row.declaration, moduleId)
    if (!result.valid || !result.value) throw moduleError('VALIDATION_FAILED', 'Installed module action declaration is invalid')
    return result.value
  }

  private async dispatch(accountId: string, moduleId: string, action: GreenfieldModuleAction, input: Record<string, unknown>) {
    if (action.kind === 'record.create') return this.records.create(accountId, moduleId, requiredTargetCollection(action), {data: input})
    if (action.kind === 'record.update') {
      const recordId = readRecordId(action, input)
      return this.records.patch(accountId, moduleId, requiredTargetCollection(action), recordId, {
        data: recordPatchInput(action, input),
        expectedRevision: numberOrUndefined(input.expectedRevision),
      })
    }
    if (action.kind === 'record.delete') {
      const recordId = readRecordId(action, input)
      return this.records.delete(accountId, moduleId, requiredTargetCollection(action), recordId, {expectedRevision: numberOrUndefined(input.expectedRevision)})
    }
    if (action.kind === 'record.restore') {
      const recordId = readRecordId(action, input)
      return this.records.restore(accountId, moduleId, requiredTargetCollection(action), recordId, {expectedRevision: numberOrUndefined(input.expectedRevision)})
    }
    if (action.kind === 'record.purge') {
      const recordId = readRecordId(action, input)
      return this.records.purge(accountId, moduleId, requiredTargetCollection(action), recordId, {expectedRevision: numberOrUndefined(input.expectedRevision), confirm: input.confirm === true})
    }
    if (action.kind === 'record.query') {
      return this.records.list(accountId, moduleId, requiredTargetCollection(action), input as any)
    }
    if (action.kind === 'settings.update') return this.settings.patch(accountId, moduleId, input)
    if (action.kind === 'function.invoke') {
      throw moduleError('CAPABILITY_DISABLED', 'Declarative function actions require a reviewed handler before execution')
    }
    if (action.kind === 'route.open') return {kind: 'route.open', destination: action.target?.routePath ?? action.successDestination}
    if (action.kind === 'share') return {kind: 'share', payload: input}
    if (action.kind === 'dismiss') return {kind: 'dismiss'}
    throw moduleError('VALIDATION_FAILED', 'Unsupported module action')
  }

  private async recordEvent(
    accountId: string,
    moduleId: string,
    action: GreenfieldModuleAction,
    idempotencyKey: string | null,
    status: 'completed' | 'failed' | 'queued' | 'cancelled',
    input: Record<string, unknown>,
    result: unknown,
    errorCode: string | null,
  ) {
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_module_action_events')
        .values({
          event_id: uuidv7(),
          account_id: accountId,
          module_id: moduleId,
          action_id: action.actionId,
          action_kind: action.kind,
          idempotency_key: idempotencyKey,
          status,
          input_hash: sha256(canonicalJsonStringify(input)),
          result: safeResult(result),
          error_code: errorCode,
          created_at: new Date(),
        })
        .execute()
      await new AuditRepository(trx).append('module.action.completed', {moduleId, actionId: action.actionId, actionKind: action.kind}, {type: 'moduleAction', id: action.actionId})
    })
  }

  private async recordBackendActionEvent(
    accountId: string,
    moduleId: string,
    actionId: string,
    idempotencyKey: string | null,
    status: 'completed' | 'failed' | 'queued' | 'cancelled',
    input: Record<string, unknown>,
    result: unknown,
    errorCode: string | null,
  ) {
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_module_action_events')
        .values({
          event_id: uuidv7(),
          account_id: accountId,
          module_id: moduleId,
          action_id: actionId,
          action_kind: 'function.invoke',
          idempotency_key: idempotencyKey,
          status,
          input_hash: sha256(canonicalJsonStringify(input)),
          result: safeResult(result),
          error_code: errorCode,
          created_at: new Date(),
        })
        .execute()
      await new AuditRepository(trx).append(status === 'completed' ? 'module.backend.action.completed' : 'module.backend.action.failed', {moduleId, actionId}, {type: 'moduleBackendAction', id: actionId})
    })
  }
}

function requiredTargetCollection(action: GreenfieldModuleAction): string {
  if (!action.target?.collection) throw moduleError('VALIDATION_FAILED', 'Record action target collection is required')
  return action.target.collection
}

function readRecordId(action: GreenfieldModuleAction, input: Record<string, unknown>): string {
  const field = action.target?.recordIdField ?? 'recordId'
  const value = input[field]
  if (typeof value !== 'string' || !value) throw moduleError('VALIDATION_FAILED', `Record action requires ${field}`)
  return value
}

function recordPatchInput(action: GreenfieldModuleAction, input: Record<string, unknown>): Record<string, unknown> {
  const recordIdField = action.target?.recordIdField ?? 'recordId'
  const omitted = new Set([recordIdField, 'recordId', 'expectedRevision', 'idempotencyKey', 'confirm'])
  return Object.fromEntries(Object.entries(input).filter(([key]) => !omitted.has(key)))
}

function numberOrUndefined(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) throw moduleError('VALIDATION_FAILED', 'expectedRevision must be a positive integer')
  return parsed
}

function normalizeInput(input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {}
  if (typeof input !== 'object' || Array.isArray(input)) throw moduleError('VALIDATION_FAILED', 'Action input must be an object')
  return input as Record<string, unknown>
}

function safeResult(result: unknown): unknown {
  if (!result || typeof result !== 'object') return result
  return JSON.parse(JSON.stringify(result))
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'BACKEND_ACTION_FAILED'
}
