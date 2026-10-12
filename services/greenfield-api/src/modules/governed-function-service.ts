import {
  governedFunctionInvokeCapability,
  type GreenfieldGovernedFunctionDeclaration,
  type GreenfieldHostFunctionCapability,
  type GreenfieldJsonSchema,
} from '@modula/greenfield-contracts'
import {canonicalJsonStringify, canonicalMutationJsonStringify} from '@modula/greenfield-protocol'
import {createHash, randomBytes} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'
import {safeFetch} from '../security/ssrf.js'
import {assertGovernedSchemaValue} from './governed-json-schema.js'
import {moduleError} from './module-errors.js'
import {GreenfieldModuleRuntimeAccessService, type GreenfieldModuleRuntimeContext} from './runtime-access.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`
const MAX_HOST_TTL_SECONDS = 3_600

export type GovernedServerFunctionHandler = (input: {
  db: Transaction<Database>
  accountId: string
  context: GreenfieldModuleRuntimeContext
  declaration: GreenfieldGovernedFunctionDeclaration
  input: unknown
  mutationId: string | null
}) => Promise<unknown>

const DEFAULT_SERVER_HANDLERS = new Map<string, GovernedServerFunctionHandler>([
  ['platform.echo', async ({input}) => input],
])

export class GreenfieldGovernedFunctionService {
  private readonly access: GreenfieldModuleRuntimeAccessService

  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
    private readonly serverHandlers: ReadonlyMap<string, GovernedServerFunctionHandler> = DEFAULT_SERVER_HANDLERS,
  ) {
    this.access = new GreenfieldModuleRuntimeAccessService(db, config)
  }

  async invoke(accountId: string, moduleId: string, functionId: string, version: string, input: unknown, options: {mutationId?: string; requestId?: string} = {}) {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    const declaration = await this.resolveDeclaration(context, functionId, version)
    this.enforceInvocationCapabilities(context, declaration)
    assertGovernedSchemaValue(declaration.inputSchema, input, 'input')
    const mutationId = declaration.mutating ? requireIdentity(options.mutationId, 'mutationId') : null
    const requestIdentity = mutationId ?? boundedIdentity(options.requestId) ?? uuidv7()

    if (declaration.executionMode === 'community') {
      await this.recordTerminalInvocation(context, declaration, requestIdentity, 'failed', 'FUNCTION_EXECUTION_UNSUPPORTED', 0)
      throw moduleError('FUNCTION_NOT_AVAILABLE', 'Community function execution is unsupported; no fallback was attempted')
    }
    if (declaration.executionMode === 'host') {
      return this.dispatchHost(context, declaration, input, mutationId, requestIdentity)
    }
    if (declaration.executionMode === 'server') {
      return this.executeServer(context, declaration, input, mutationId, requestIdentity)
    }
    return this.executeRemote(context, declaration, input, mutationId, requestIdentity)
  }

  async registerHostExecutor(accountId: string, moduleId: string, input: {executorId?: string; capabilities?: unknown; ttlSeconds?: number}) {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    if (context.permissionReviewRequired) throw moduleError('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required')
    const capabilities = normalizeHostCapabilities(input.capabilities)
    const ttlSeconds = Math.max(30, Math.min(Math.floor(input.ttlSeconds ?? 300), MAX_HOST_TTL_SECONDS))
    const executorId = boundedIdentity(input.executorId) ?? uuidv7()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000)
    await this.db.insertInto('greenfield_host_function_executors').values({
      executor_id: executorId,
      account_id: accountId,
      installation_id: context.installationId,
      release_id: context.releaseId,
      capabilities: jsonb(capabilities),
      status: 'available',
      expires_at: expiresAt,
      created_at: now,
      updated_at: now,
    }).onConflict(conflict => conflict.column('executor_id').doUpdateSet({
      capabilities: jsonb(capabilities), status: 'available', expires_at: expiresAt, updated_at: now,
    })).execute()
    return {executorId, releaseId: context.releaseId, capabilities, expiresAt: expiresAt.toISOString()}
  }

  async pendingHostRequests(accountId: string, moduleId: string, executorId: string) {
    const context = await this.access.resolve(accountId, moduleId, {requireEnabled: true})
    await this.expireHostRequests(accountId, executorId)
    const executor = await this.db.selectFrom('greenfield_host_function_executors').selectAll()
      .where('executor_id', '=', executorId).where('account_id', '=', accountId)
      .where('installation_id', '=', context.installationId).where('release_id', '=', context.releaseId)
      .where('status', '=', 'available').where('expires_at', '>', new Date()).executeTakeFirst()
    if (!executor) throw moduleError('NOT_FOUND', 'Host executor not found')
    const requests = await this.db.selectFrom('greenfield_host_function_requests').selectAll()
      .where('executor_id', '=', executorId).where('state', '=', 'dispatched')
      .orderBy('created_at').limit(50).execute()
    return {requests: requests.map(serializeHostRequest)}
  }

  async getHostRequest(accountId: string, moduleId: string, requestId: string) {
    await this.access.resolve(accountId, moduleId, {requireEnabled: false})
    await this.expireHostRequest(requestId, accountId)
    const request = await this.requireHostRequest(accountId, moduleId, requestId)
    return serializeHostRequest(request)
  }

  async completeHostRequest(accountId: string, moduleId: string, requestId: string, output: unknown) {
    const request = await this.requireHostRequest(accountId, moduleId, requestId)
    const context = await this.resolveCurrentRequestContext(accountId, request)
    if (!context) throw moduleError('CAPABILITY_DISABLED', 'Module was unloaded or changed release before host completion')
    const declaration = await this.resolveDeclaration(context, request.function_id, request.function_version)
    assertGovernedSchemaValue(declaration.outputSchema, output, 'output')
    const outputHash = sha256(canonicalJsonStringify(output))
    const result = await this.withTransaction(async trx => {
      const current = await trx.selectFrom('greenfield_host_function_requests').selectAll()
        .where('request_id', '=', requestId).where('account_id', '=', accountId).forUpdate().executeTakeFirstOrThrow()
      if (current.state === 'completed') {
        if (current.output_hash !== outputHash) throw moduleError('CONFLICT', 'Host request already completed with a different output')
        return {idempotent: true, request: current}
      }
      if (current.deadline_at <= new Date()) {
        await this.setHostTerminal(trx, current, 'timed_out', 'HOST_FUNCTION_TIMED_OUT')
        return {timedOut: true, request: {...current, state: 'timed_out' as const}}
      }
      if (current.state !== 'dispatched') throw moduleError('CONFLICT', `Host request cannot complete from ${current.state}`)
      const now = new Date()
      await trx.updateTable('greenfield_host_function_requests').set({
        state: 'completed', output_payload: jsonb(output), output_hash: outputHash, updated_at: now, completed_at: now,
      }).where('request_id', '=', requestId).execute()
      await trx.updateTable('greenfield_function_invocations').set({
        status: 'completed', success: true, error_code: null,
        latency_ms: Math.max(0, now.getTime() - current.created_at.getTime()), completed_at: now,
      }).where('invocation_id', '=', current.invocation_id).execute()
      if (declaration.mutating) {
        const invocation = await trx.selectFrom('greenfield_function_invocations').select('request_identity')
          .where('invocation_id', '=', current.invocation_id).executeTakeFirstOrThrow()
        await this.completeMutation(trx, context, declaration, invocation.request_identity, output, now)
      }
      await new AuditRepository(trx).append('module.function.host.completed', {
        moduleId: current.module_id, functionId: current.function_id, functionVersion: current.function_version,
        executionMode: 'host', requestIdentity: current.request_id,
      }, {type: 'moduleFunctionInvocation', id: current.invocation_id}, {accountId})
      return {idempotent: false, request: {...current, state: 'completed' as const, output_payload: output, output_hash: outputHash, completed_at: now}}
    })
    if ('timedOut' in result) throw moduleError('CAPABILITY_UNAVAILABLE', 'Host function request timed out')
    return {idempotent: result.idempotent, ...serializeHostRequest(result.request)}
  }

  async cancelHostRequest(accountId: string, moduleId: string, requestId: string) {
    const request = await this.requireHostRequest(accountId, moduleId, requestId)
    if (request.state === 'cancelled') return {idempotent: true, ...serializeHostRequest(request)}
    if (request.state !== 'created' && request.state !== 'dispatched') throw moduleError('CONFLICT', `Host request cannot be cancelled from ${request.state}`)
    await this.withTransaction(async trx => this.setHostTerminal(trx, request, 'cancelled', 'HOST_FUNCTION_CANCELLED'))
    return {idempotent: false, ...serializeHostRequest({...request, state: 'cancelled' as const})}
  }

  private async executeServer(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, input: unknown, mutationId: string | null, requestIdentity: string) {
    const implementation = await this.resolveImplementation(context, declaration, 'server')
    const handler = implementation.handler_key ? this.serverHandlers.get(implementation.handler_key) : undefined
    if (!handler) {
      await this.recordTerminalInvocation(context, declaration, requestIdentity, 'failed', 'FUNCTION_IMPLEMENTATION_NOT_REGISTERED', 0)
      throw moduleError('CAPABILITY_DISABLED', 'Reviewed server function implementation is unavailable')
    }
    const started = Date.now()
    try {
      return await this.withTransaction(async trx => {
        const replay = await this.reserveMutation(trx, context, declaration, input, mutationId)
        if (replay) return replay
        const invocationId = uuidv7()
        await this.insertInvocation(trx, invocationId, context, declaration, requestIdentity, 'created')
        const output = await handler({db: trx, accountId: context.accountId, context, declaration, input, mutationId})
        assertGovernedSchemaValue(declaration.outputSchema, output, 'output')
        const now = new Date()
        await trx.updateTable('greenfield_function_invocations').set({
          status: 'completed', success: true, latency_ms: Date.now() - started, completed_at: now,
        }).where('invocation_id', '=', invocationId).execute()
        if (mutationId) await this.completeMutation(trx, context, declaration, mutationId, output, now)
        await this.appendInvocationAudit(trx, invocationId, context, declaration, requestIdentity, true)
        return {idempotent: false, status: 'completed', invocationId, output}
      })
    } catch (error) {
      await this.recordTerminalInvocation(context, declaration, requestIdentity, 'failed', errorCode(error), Date.now() - started)
      throw error
    }
  }

  private async executeRemote(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, input: unknown, mutationId: string | null, requestIdentity: string) {
    const implementation = await this.resolveImplementation(context, declaration, 'remote')
    if (!implementation.network_allowed || !implementation.endpoint_url) {
      await this.recordTerminalInvocation(context, declaration, requestIdentity, 'failed', 'REMOTE_NETWORK_POLICY_DENIED', 0)
      throw moduleError('CAPABILITY_DISABLED', 'Remote function network policy denied; no fallback was attempted')
    }
    if (mutationId) {
      const replay = await this.withTransaction(trx => this.reserveMutation(trx, context, declaration, input, mutationId))
      if (replay) return replay
    }
    const invocationId = uuidv7()
    const started = Date.now()
    await this.withTransaction(async trx => {
      await this.insertInvocation(trx, invocationId, context, declaration, requestIdentity, 'dispatched')
      await this.appendInvocationAudit(trx, invocationId, context, declaration, requestIdentity, null)
    })
    try {
      const response = await safeFetch(implementation.endpoint_url, {
        method: 'POST', headers: {'content-type': 'application/json', 'idempotency-key': requestIdentity},
        body: JSON.stringify({functionId: declaration.functionId, version: declaration.version, input, mutationId}),
        timeoutMs: declaration.timeoutMs, maxResponseBytes: 1_048_576, allowedContentTypes: ['application/json'],
      })
      if (response.status < 200 || response.status >= 300) throw moduleError('VALIDATION_FAILED', `Remote function failed with HTTP ${response.status}`)
      const output = JSON.parse(response.body.toString('utf8'))
      assertGovernedSchemaValue(declaration.outputSchema, output, 'output')
      const now = new Date()
      await this.withTransaction(async trx => {
        await trx.updateTable('greenfield_function_invocations').set({status: 'completed', success: true, latency_ms: Date.now() - started, completed_at: now})
          .where('invocation_id', '=', invocationId).execute()
        if (mutationId) await this.completeMutation(trx, context, declaration, mutationId, output, now)
        await this.appendInvocationAudit(trx, invocationId, context, declaration, requestIdentity, true)
      })
      return {idempotent: false, status: 'completed', invocationId, output}
    } catch (error) {
      await this.db.updateTable('greenfield_function_invocations').set({
        status: 'failed', success: false, error_code: errorCode(error), latency_ms: Date.now() - started, completed_at: new Date(),
      }).where('invocation_id', '=', invocationId).execute()
      throw error
    }
  }

  private async dispatchHost(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, input: unknown, mutationId: string | null, requestIdentity: string) {
    const executorRows = await this.db.selectFrom('greenfield_host_function_executors').selectAll()
      .where('account_id', '=', context.accountId).where('installation_id', '=', context.installationId)
      .where('release_id', '=', context.releaseId).where('status', '=', 'available')
      .where('expires_at', '>', new Date()).orderBy('updated_at', 'desc').execute()
    const executor = executorRows.find(row => hasHostCapability(row.capabilities, declaration.functionId, declaration.version)) ?? null
    const invocationId = uuidv7()
    const requestId = uuidv7()
    const now = new Date()
    const deadlineAt = new Date(now.getTime() + declaration.timeoutMs)
    const dispatched = await this.withTransaction(async trx => {
      const replay = executor ? await this.reserveMutation(trx, context, declaration, input, mutationId) : null
      if (replay) return replay
      await this.insertInvocation(trx, invocationId, context, declaration, requestIdentity, executor ? 'dispatched' : 'host_unavailable')
      await trx.insertInto('greenfield_host_function_requests').values({
        request_id: requestId, invocation_id: invocationId, executor_id: executor?.executor_id ?? null,
        account_id: context.accountId, installation_id: context.installationId, release_id: context.releaseId,
        module_id: context.moduleId, function_id: declaration.functionId, function_version: declaration.version,
        state: executor ? 'dispatched' : 'host_unavailable', input_payload: jsonb(input), output_payload: null,
        output_hash: null, deadline_at: deadlineAt, created_at: now, updated_at: now, completed_at: executor ? null : now,
      }).execute()
      await this.appendInvocationAudit(trx, invocationId, context, declaration, requestIdentity, executor ? null : false)
      return null
    })
    if (dispatched) return dispatched
    if (!executor) throw moduleError('CAPABILITY_UNAVAILABLE', 'No negotiated host executor is available; no fallback was attempted')
    return {status: 'dispatched', invocationId, requestId, executorId: executor.executor_id, deadlineAt: deadlineAt.toISOString()}
  }

  private async resolveDeclaration(context: GreenfieldModuleRuntimeContext, functionId: string, version: string): Promise<GreenfieldGovernedFunctionDeclaration> {
    const rows = await this.db.selectFrom('greenfield_module_contributions').select(['manifest'])
      .where('release_id', '=', context.releaseId).where('module_id', '=', context.moduleId)
      .where('contribution_type', '=', 'function').where('registration_status', 'in', ['declared', 'registered']).execute()
    for (const row of rows) {
      const manifest = row.manifest as Record<string, unknown>
      if (manifest.functionId !== functionId || manifest.version !== version || !isExecutionMode(manifest.executionMode)) continue
      return {
        moduleId: context.moduleId,
        releaseIdentity: context.releaseId,
        functionId,
        version,
        inputSchema: requireSchema(manifest.inputSchema),
        outputSchema: requireSchema(manifest.outputSchema),
        requiredCapabilities: stringArray(manifest.requiredCapabilities),
        executionMode: manifest.executionMode,
        mutating: manifest.mutating === true,
        timeoutMs: boundedTimeout(manifest.timeoutMs),
      }
    }
    throw moduleError('FUNCTION_NOT_AVAILABLE', 'Function is not declared by the exact installed release')
  }

  private enforceInvocationCapabilities(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration): void {
    this.access.enforceCapability(context, governedFunctionInvokeCapability(context.moduleId, declaration.functionId))
    for (const capability of declaration.requiredCapabilities) this.access.enforceCapability(context, capability)
  }

  private async resolveImplementation(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, executionMode: 'server' | 'remote') {
    const implementation = await this.db.selectFrom('greenfield_function_implementations').selectAll()
      .where('release_id', '=', context.releaseId).where('function_id', '=', declaration.functionId)
      .where('function_version', '=', declaration.version).where('execution_mode', '=', executionMode).executeTakeFirst()
    if (!implementation || !implementation.reviewed || !implementation.enabled) {
      throw moduleError('CAPABILITY_DISABLED', `Reviewed ${executionMode} function implementation is not registered`)
    }
    return implementation
  }

  private async reserveMutation(trx: Transaction<Database>, context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, input: unknown, mutationId: string | null) {
    if (!mutationId) return null
    const payloadHash = this.invocationPayloadHash(context, declaration, input)
    const mutationRowId = uuidv7()
    const inserted = await trx.insertInto('greenfield_function_mutations').values({
      mutation_row_id: mutationRowId, account_id: context.accountId, installation_id: context.installationId,
      function_id: declaration.functionId, function_version: declaration.version, mutation_id: mutationId,
      payload_hash: payloadHash, status: 'pending', result: null, created_at: new Date(), completed_at: null,
    }).onConflict(conflict => conflict.columns(['account_id', 'installation_id', 'function_id', 'function_version', 'mutation_id']).doNothing())
      .returning('mutation_row_id').executeTakeFirst()
    if (inserted) return null
    const previous = await trx.selectFrom('greenfield_function_mutations').selectAll()
      .where('account_id', '=', context.accountId).where('installation_id', '=', context.installationId)
      .where('function_id', '=', declaration.functionId).where('function_version', '=', declaration.version)
      .where('mutation_id', '=', mutationId).executeTakeFirstOrThrow()
    if (previous.payload_hash !== payloadHash) throw moduleError('MUTATION_REUSE_CONFLICT', 'Mutation ID was reused with a different function payload')
    if (previous.status !== 'completed') throw moduleError('CONFLICT', 'Function mutation is already in progress')
    return {idempotent: true, status: 'completed', output: previous.result}
  }

  private async completeMutation(trx: Transaction<Database>, context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, mutationId: string, output: unknown, now: Date) {
    await trx.updateTable('greenfield_function_mutations').set({status: 'completed', result: jsonb(output), completed_at: now})
      .where('account_id', '=', context.accountId).where('installation_id', '=', context.installationId)
      .where('function_id', '=', declaration.functionId).where('function_version', '=', declaration.version)
      .where('mutation_id', '=', mutationId).execute()
  }

  private invocationPayloadHash(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, input: unknown): string {
    return sha256(canonicalMutationJsonStringify({moduleId: context.moduleId, releaseId: context.releaseId, functionId: declaration.functionId, version: declaration.version, input}))
  }

  private async insertInvocation(trx: Transaction<Database>, invocationId: string, context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, requestIdentity: string, status: Database['greenfield_function_invocations']['status']) {
    const terminal = ['failed', 'cancelled', 'timed_out', 'host_unavailable', 'module_unloaded'].includes(status)
    await trx.insertInto('greenfield_function_invocations').values({
      invocation_id: invocationId, account_id: context.accountId, installation_id: context.installationId,
      release_id: context.releaseId, module_id: context.moduleId, function_id: declaration.functionId,
      function_version: declaration.version, execution_mode: declaration.executionMode, request_identity: requestIdentity,
      status, success: terminal ? false : null, latency_ms: terminal ? 0 : null,
      error_code: null, created_at: new Date(), completed_at: terminal ? new Date() : null,
    }).execute()
  }

  private async appendInvocationAudit(trx: Transaction<Database>, invocationId: string, context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, requestIdentity: string, success: boolean | null) {
    await new AuditRepository(trx).append('module.function.invocation', {
      moduleId: context.moduleId, installationId: context.installationId, releaseId: context.releaseId,
      functionId: declaration.functionId, functionVersion: declaration.version,
      executionMode: declaration.executionMode, requestIdentity, success,
    }, {type: 'moduleFunctionInvocation', id: invocationId}, {accountId: context.accountId})
  }

  private async recordTerminalInvocation(context: GreenfieldModuleRuntimeContext, declaration: GreenfieldGovernedFunctionDeclaration, requestIdentity: string, status: 'failed' | 'host_unavailable' | 'timed_out' | 'module_unloaded', code: string, latencyMs: number) {
    const invocationId = uuidv7()
    await this.withTransaction(async trx => {
      await this.insertInvocation(trx, invocationId, context, declaration, requestIdentity, status)
      await trx.updateTable('greenfield_function_invocations').set({error_code: code, latency_ms: Math.max(0, latencyMs)}).where('invocation_id', '=', invocationId).execute()
      await this.appendInvocationAudit(trx, invocationId, context, declaration, requestIdentity, false)
    }).catch(error => {
      if (!isUniqueViolation(error)) throw error
    })
  }

  private async requireHostRequest(accountId: string, moduleId: string, requestId: string) {
    const request = await this.db.selectFrom('greenfield_host_function_requests').selectAll()
      .where('request_id', '=', requestId).where('account_id', '=', accountId).where('module_id', '=', moduleId).executeTakeFirst()
    if (!request) throw moduleError('NOT_FOUND', 'Host function request not found')
    return request
  }

  private async resolveCurrentRequestContext(accountId: string, request: Database['greenfield_host_function_requests']) {
    try {
      const context = await this.access.resolve(accountId, request.module_id, {requireEnabled: true})
      if (context.installationId === request.installation_id && context.releaseId === request.release_id) return context
    } catch {
      // Persist the terminal lifecycle state below without exposing installation details.
    }
    await this.withTransaction(async trx => this.setHostTerminal(trx, request, 'module_unloaded', 'HOST_MODULE_UNLOADED'))
    return null
  }

  private async expireHostRequests(accountId: string, executorId: string) {
    const rows = await this.db.selectFrom('greenfield_host_function_requests').selectAll()
      .where('account_id', '=', accountId).where('executor_id', '=', executorId)
      .where('state', '=', 'dispatched').where('deadline_at', '<=', new Date()).execute()
    for (const row of rows) await this.withTransaction(async trx => this.setHostTerminal(trx, row, 'timed_out', 'HOST_FUNCTION_TIMED_OUT'))
  }

  private async expireHostRequest(requestId: string, accountId: string) {
    const row = await this.db.selectFrom('greenfield_host_function_requests').selectAll()
      .where('request_id', '=', requestId).where('account_id', '=', accountId)
      .where('state', '=', 'dispatched').where('deadline_at', '<=', new Date()).executeTakeFirst()
    if (row) await this.withTransaction(async trx => this.setHostTerminal(trx, row, 'timed_out', 'HOST_FUNCTION_TIMED_OUT'))
  }

  private async setHostTerminal(trx: Transaction<Database>, request: Database['greenfield_host_function_requests'], state: 'cancelled' | 'timed_out' | 'module_unloaded', code: string) {
    const now = new Date()
    await trx.updateTable('greenfield_host_function_requests').set({state, updated_at: now, completed_at: now})
      .where('request_id', '=', request.request_id).where('state', 'in', ['created', 'dispatched']).execute()
    await trx.updateTable('greenfield_function_invocations').set({
      status: state, success: false, error_code: code,
      latency_ms: Math.max(0, now.getTime() - request.created_at.getTime()), completed_at: now,
    }).where('invocation_id', '=', request.invocation_id).execute()
  }

  private async withTransaction<T>(operation: (trx: Transaction<Database>) => Promise<T>): Promise<T> {
    const candidate = this.db as ModulaDb & {isTransaction?: boolean}
    return candidate.isTransaction
      ? operation(this.db as unknown as Transaction<Database>)
      : this.db.transaction().execute(operation)
  }
}

function normalizeHostCapabilities(value: unknown): GreenfieldHostFunctionCapability[] {
  if (!Array.isArray(value) || value.length > 100) throw moduleError('VALIDATION_FAILED', 'Host capabilities must be a bounded array')
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw moduleError('VALIDATION_FAILED', `Host capability ${index} is invalid`)
    const item = entry as Record<string, unknown>
    if (typeof item.functionId !== 'string' || typeof item.version !== 'string' || typeof item.contractVersion !== 'string' || typeof item.available !== 'boolean') {
      throw moduleError('VALIDATION_FAILED', `Host capability ${index} is invalid`)
    }
    return {functionId: item.functionId, version: item.version, contractVersion: item.contractVersion, available: item.available,
      provider: typeof item.provider === 'string' ? item.provider : undefined,
      timeoutMs: Number.isInteger(item.timeoutMs) ? Number(item.timeoutMs) : undefined}
  })
}

function hasHostCapability(value: unknown, functionId: string, version: string): boolean {
  try {
    return normalizeHostCapabilities(value).some(capability => capability.functionId === functionId && capability.version === version && capability.available)
  } catch {
    return false
  }
}

function serializeHostRequest(row: Database['greenfield_host_function_requests']) {
  return {
    requestId: row.request_id, invocationId: row.invocation_id, executorId: row.executor_id,
    moduleId: row.module_id, functionId: row.function_id, functionVersion: row.function_version,
    state: row.state, input: row.input_payload, output: row.output_payload,
    deadlineAt: row.deadline_at.toISOString(), createdAt: row.created_at.toISOString(),
    completedAt: row.completed_at?.toISOString() ?? null,
  }
}

function requireSchema(value: unknown): GreenfieldJsonSchema {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Function declaration schema is invalid')
  return value as GreenfieldJsonSchema
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) throw moduleError('VALIDATION_FAILED', 'Function required capabilities are invalid')
  return value as string[]
}

function isExecutionMode(value: unknown): value is GreenfieldGovernedFunctionDeclaration['executionMode'] {
  return value === 'host' || value === 'server' || value === 'remote' || value === 'community'
}

function boundedTimeout(value: unknown): number {
  return Number.isInteger(value) ? Math.max(100, Math.min(Number(value), 120_000)) : 30_000
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
  return error && typeof error === 'object' && 'code' in error ? String((error as {code?: unknown}).code) : 'FUNCTION_EXECUTION_FAILED'
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as {code?: unknown}).code === '23505')
}

export function generateModuleRuntimeCredential(): string {
  return `mrc_${randomBytes(32).toString('base64url')}`
}
