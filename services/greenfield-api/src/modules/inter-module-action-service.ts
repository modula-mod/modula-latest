import {
  interModuleRequestCapability,
  type GreenfieldInterModuleActionIdentity,
  type GreenfieldJsonSchema,
} from '@modula/greenfield-contracts'
import type {GreenfieldModuleInterModuleActionContribution} from '@modula/greenfield-module-manifest'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {createHash} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {generateModuleRuntimeCredential, GreenfieldGovernedFunctionService} from './governed-function-service.js'
import {assertGovernedSchemaValue} from './governed-json-schema.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRecordService} from './record-service.js'
import {GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

export type InterModuleActionFailureHooks = {
  afterTargetWrite?: () => Promise<void>
}

export class GreenfieldInterModuleActionService {
  private readonly access: GreenfieldModuleRuntimeAccessService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly failureHooks: InterModuleActionFailureHooks = {},
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async issueRuntimeCredential(accountId: string, moduleId: string, ttlSeconds = 300) {
    const source = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    if (source.permissionReviewRequired) throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    const credential = generateModuleRuntimeCredential()
    const credentialId = uuidv7()
    const createdAt = new Date()
    const expiresAt = new Date(createdAt.getTime() + Math.max(30, Math.min(Math.floor(ttlSeconds), 3_600)) * 1_000)
    await this.db.insertInto('greenfield_module_runtime_credentials').values({
      credential_id: credentialId,
      credential_hash: sha256(credential),
      account_id: accountId,
      installation_id: source.installationId,
      release_id: source.releaseId,
      module_id: source.moduleId,
      expires_at: expiresAt,
      revoked_at: null,
      created_at: createdAt,
    }).execute()
    return {credentialId, credential, moduleId: source.moduleId, releaseId: source.releaseId, expiresAt: expiresAt.toISOString()}
  }

  async revokeRuntimeCredential(accountId: string, moduleId: string, credentialId: string) {
    const source = await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    const revoked = await this.db.updateTable('greenfield_module_runtime_credentials').set({revoked_at: new Date()})
      .where('credential_id', '=', credentialId).where('account_id', '=', accountId)
      .where('installation_id', '=', source.installationId).where('module_id', '=', source.moduleId)
      .where('revoked_at', 'is', null).executeTakeFirst()
    if (revoked.numUpdatedRows !== 1n) throw moduleError('NOT_FOUND', 'Runtime credential not found')
    return {credentialId, revoked: true}
  }

  async request(
    credential: string,
    identity: GreenfieldInterModuleActionIdentity,
    input: unknown,
    options: {mutationId?: string; requestId?: string} = {},
  ) {
    const source = await this.authenticateRuntimeCredential(credential)
    const target = await this.access.resolve(source.accountId, identity.targetModuleId, {requireEnabled: true})
    const action = await this.resolveAction(target, identity.actionId, identity.version)
    this.access.enforceCapability(source, interModuleRequestCapability(target.moduleId, action.actionId))
    if (!action.allowedSourceModules.includes(source.moduleId)) throw moduleError('MODULE_PERMISSION_DENIED', 'Target policy does not allow this source module')
    for (const capability of action.requiredCapabilities) this.access.enforceCapability(target, capability)
    assertGovernedSchemaValue(action.inputSchema, input, 'input')
    const mutationId = action.mutating
      ? requireIdentity(options.mutationId, 'mutationId')
      : boundedIdentity(options.mutationId) ?? boundedIdentity(options.requestId) ?? uuidv7()
    const payloadHash = sha256(canonicalJsonStringify({
      sourceModuleId: source.moduleId,
      sourceReleaseId: source.releaseId,
      targetModuleId: target.moduleId,
      targetReleaseId: target.releaseId,
      actionId: action.actionId,
      actionVersion: action.version,
      input,
    }))
    const started = Date.now()
    try {
      return await this.db.transaction().execute(async trx => {
        const requestId = uuidv7()
        const reserved = await trx.insertInto('greenfield_inter_module_action_requests').values({
          request_id: requestId,
          account_id: source.accountId,
          source_installation_id: source.installationId,
          source_module_id: source.moduleId,
          target_installation_id: target.installationId,
          target_module_id: target.moduleId,
          target_release_id: target.releaseId,
          action_id: action.actionId,
          action_version: action.version,
          mutation_id: mutationId,
          payload_hash: payloadHash,
          status: 'pending',
          result: null,
          latency_ms: null,
          created_at: new Date(),
          completed_at: null,
        }).onConflict(conflict => conflict.columns([
          'account_id', 'source_installation_id', 'target_installation_id', 'action_id', 'action_version', 'mutation_id',
        ]).doNothing()).returning('request_id').executeTakeFirst()
        if (!reserved) {
          const previous = await trx.selectFrom('greenfield_inter_module_action_requests').selectAll()
            .where('account_id', '=', source.accountId)
            .where('source_installation_id', '=', source.installationId)
            .where('target_installation_id', '=', target.installationId)
            .where('action_id', '=', action.actionId).where('action_version', '=', action.version)
            .where('mutation_id', '=', mutationId).executeTakeFirstOrThrow()
          if (previous.payload_hash !== payloadHash) throw moduleError('MUTATION_REUSE_CONFLICT', 'Mutation ID was reused with a different inter-module payload')
          if (previous.status !== 'completed') throw moduleError('CONFLICT', 'Inter-module action is already in progress or previously failed')
          return {idempotent: true, requestId: previous.request_id, status: 'completed', result: previous.result}
        }

        const result = await this.dispatchTarget(trx, source, target, action, input, mutationId, requestId)
        assertGovernedSchemaValue(action.outputSchema, result, 'output')
        await this.failureHooks.afterTargetWrite?.()
        const completedAt = new Date()
        await trx.updateTable('greenfield_inter_module_action_requests').set({
          status: 'completed', result: jsonb(result), latency_ms: Date.now() - started, completed_at: completedAt,
        }).where('request_id', '=', requestId).execute()
        await new AuditRepository(trx).append('module.inter-module-action.completed', {
          sourceModuleId: source.moduleId, sourceInstallationId: source.installationId,
          targetModuleId: target.moduleId, targetInstallationId: target.installationId,
          targetReleaseId: target.releaseId, actionId: action.actionId, actionVersion: action.version,
          requestIdentity: mutationId, success: true,
        }, {type: 'interModuleAction', id: requestId}, {accountId: source.accountId, requestId: options.requestId})
        return {idempotent: false, requestId, status: 'completed', result}
      })
    } catch (error) {
      await this.recordFailure(source, target, action, mutationId, payloadHash, Date.now() - started, errorCode(error), options.requestId)
      throw error
    }
  }

  private async authenticateRuntimeCredential(credential: string): Promise<GreenfieldModuleRuntimeContext> {
    if (!credential.startsWith('mrc_') || credential.length > 200) throw moduleError('UNAUTHENTICATED', 'Invalid module runtime credential')
    const row = await this.db.selectFrom('greenfield_module_runtime_credentials').selectAll()
      .where('credential_hash', '=', sha256(credential)).where('revoked_at', 'is', null)
      .where('expires_at', '>', new Date()).executeTakeFirst()
    if (!row) throw moduleError('UNAUTHENTICATED', 'Invalid or expired module runtime credential')
    const source = await this.access.resolve(row.account_id, row.module_id, {requireEnabled: true})
    if (source.installationId !== row.installation_id || source.releaseId !== row.release_id) {
      throw moduleError('UNAUTHENTICATED', 'Module runtime credential is no longer valid')
    }
    return source
  }

  private async resolveAction(target: GreenfieldModuleRuntimeContext, actionId: string, version: string): Promise<GreenfieldModuleInterModuleActionContribution> {
    const rows = await this.db.selectFrom('greenfield_module_contributions').select('manifest')
      .where('release_id', '=', target.releaseId).where('module_id', '=', target.moduleId)
      .where('contribution_type', '=', 'interModuleAction').where('registration_status', 'in', ['declared', 'registered']).execute()
    for (const row of rows) {
      const manifest = row.manifest as GreenfieldModuleInterModuleActionContribution
      if (manifest.actionId === actionId && manifest.version === version && isActionDeclaration(manifest)) return manifest
    }
    throw moduleError('NOT_FOUND', 'Target action is not declared by the exact installed release')
  }

  private async dispatchTarget(
    trx: Transaction<Database>,
    source: GreenfieldModuleRuntimeContext,
    target: GreenfieldModuleRuntimeContext,
    action: GreenfieldModuleInterModuleActionContribution,
    input: unknown,
    mutationId: string,
    requestId: string,
  ): Promise<unknown> {
    if (action.execution.kind === 'record.create') {
      const object = requireObject(input)
      const data = object.data && typeof object.data === 'object' && !Array.isArray(object.data)
        ? object.data as Record<string, unknown>
        : Object.fromEntries(Object.entries(object).filter(([key]) => !['recordId', 'visibility'].includes(key)))
      const created = await new GreenfieldModuleRecordService(trx as unknown as ModulaDb, this.config).create(
        target.accountId,
        target.moduleId,
        action.execution.collection,
        {
          data,
          recordId: typeof object.recordId === 'string' ? object.recordId : undefined,
          visibility: typeof object.visibility === 'string' ? object.visibility : undefined,
          mutationId: `ima:${sha256(`${source.installationId}:${target.installationId}:${mutationId}`)}`,
        },
        {actorId: `module:${source.moduleId}:${source.installationId}`, requestId},
      )
      return {
        record: {moduleId: target.moduleId, recordType: action.execution.collection, recordId: String((created as any).record_id)},
        revision: Number((created as any).revision),
      }
    }
    const invoked = await new GreenfieldGovernedFunctionService(trx as unknown as ModulaDb, this.config).invoke(
      target.accountId,
      target.moduleId,
      action.execution.functionId,
      action.execution.functionVersion,
      input,
      {mutationId: action.mutating ? `ima:${sha256(`${source.installationId}:${target.installationId}:${mutationId}`)}` : undefined, requestId},
    )
    if ((invoked as {status?: string}).status !== 'completed') throw moduleError('CAPABILITY_DISABLED', 'Inter-module target function must complete synchronously')
    return (invoked as {output?: unknown}).output
  }

  private async recordFailure(
    source: GreenfieldModuleRuntimeContext,
    target: GreenfieldModuleRuntimeContext,
    action: GreenfieldModuleInterModuleActionContribution,
    mutationId: string,
    payloadHash: string,
    latencyMs: number,
    code: string,
    traceRequestId?: string,
  ) {
    const requestId = uuidv7()
    await this.db.transaction().execute(async trx => {
      const inserted = await trx.insertInto('greenfield_inter_module_action_requests').values({
        request_id: requestId, account_id: source.accountId,
        source_installation_id: source.installationId, source_module_id: source.moduleId,
        target_installation_id: target.installationId, target_module_id: target.moduleId, target_release_id: target.releaseId,
        action_id: action.actionId, action_version: action.version, mutation_id: mutationId,
        payload_hash: payloadHash, status: 'failed', result: jsonb({errorCode: code}),
        latency_ms: Math.max(0, latencyMs), created_at: new Date(), completed_at: new Date(),
      }).onConflict(conflict => conflict.columns([
        'account_id', 'source_installation_id', 'target_installation_id', 'action_id', 'action_version', 'mutation_id',
      ]).doNothing()).returning('request_id').executeTakeFirst()
      if (!inserted) return
      await new AuditRepository(trx).append('module.inter-module-action.failed', {
        sourceModuleId: source.moduleId, sourceInstallationId: source.installationId,
        targetModuleId: target.moduleId, targetInstallationId: target.installationId,
        targetReleaseId: target.releaseId, actionId: action.actionId, actionVersion: action.version,
        requestIdentity: mutationId, success: false, errorCode: code,
      }, {type: 'interModuleAction', id: requestId}, {accountId: source.accountId, requestId: traceRequestId})
    }).catch(failure => {
      if (!isUniqueViolation(failure)) throw failure
    })
  }
}

function isActionDeclaration(value: GreenfieldModuleInterModuleActionContribution): boolean {
  return Boolean(value && typeof value === 'object'
    && typeof value.actionId === 'string'
    && typeof value.version === 'string'
    && value.inputSchema && typeof value.inputSchema === 'object'
    && value.outputSchema && typeof value.outputSchema === 'object'
    && Array.isArray(value.requiredCapabilities)
    && Array.isArray(value.allowedSourceModules)
    && value.execution && (value.execution.kind === 'record.create' || value.execution.kind === 'function.invoke'))
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Inter-module action input must be an object')
  return value as Record<string, unknown>
}

function requireIdentity(value: unknown, name: string): string {
  const identity = boundedIdentity(value)
  if (!identity) throw moduleError('VALIDATION_FAILED', `${name} is required`)
  return identity
}

function boundedIdentity(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 200 ? value : null
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as {code?: unknown}).code) : 'INTER_MODULE_ACTION_FAILED'
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as {code?: unknown}).code === '23505')
}
