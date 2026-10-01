import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {NOT_INSTALLED_STATUSES} from './installation-status.js'
import type {GreenfieldModuleManifest} from '@modula/greenfield-module-manifest'
import {createCipheriv, createHash, randomBytes} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database, GreenfieldModuleDependencyRelation, GreenfieldModulePermissionState} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldPolicyEngine} from '../domains/policy/engine.js'
import {uuidv7} from '../lib/uuidv7.js'
import type {DependencyResolutionPlan} from './dependency-resolver.js'
import type {GreenfieldModuleReleaseRecord} from './module-domain.js'
import {moduleError} from './module-errors.js'

type Db = ModulaDb | Transaction<Database>

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`
const REGISTRATION_TABLES = [
  'greenfield_module_service_registrations',
  'greenfield_module_api_registrations',
  'greenfield_module_hook_registrations',
  'greenfield_module_storage_allocations',
  'greenfield_module_job_registrations',
  'greenfield_module_ui_contribution_registrations',
] as const

type RuntimePermissionEntry = {
  permission: string
  required: boolean
  risk: 'low' | 'medium' | 'high' | 'critical' | 'restricted'
  policyMode: 'observe' | 'warn' | 'require-confirmation' | 'block'
  reason: string
}

export class GreenfieldModuleRuntime2Service {
  constructor(private readonly db: ModulaDb) {}

  async persistInstallPlanState(
    trx: Transaction<Database>,
    input: {
      planId: string
      installationId: string
      accountId: string
      release: GreenfieldModuleReleaseRecord
      dependencyPlan: DependencyResolutionPlan
      grantedPermissions: string[]
      deniedPermissions: string[]
    },
  ): Promise<void> {
    const now = new Date()
    await this.persistResolvedDependencies(trx, input, now)
    await this.persistPermissionStates(trx, input, now)
    await this.recordLifecycleTransaction(trx, {
      installationId: input.installationId,
      accountId: input.accountId,
      releaseId: input.release.releaseId,
      moduleId: input.release.moduleId,
      action: 'install',
      status: 'running',
      idempotencyKey: input.planId,
      metadata: {planId: input.planId, dependencyErrors: input.dependencyPlan.errors, dependencyWarnings: input.dependencyPlan.warnings},
      stages: ['resolve-dependencies', 'review-permissions', 'accept-plan', 'enqueue-installation'],
    })
  }

  async persistPermissionReviewState(
    trx: Transaction<Database>,
    input: {
      installationId: string
      accountId: string
      release: GreenfieldModuleReleaseRecord
      grantedPermissions: string[]
      deniedPermissions: string[]
    },
  ): Promise<void> {
    await this.persistPermissionStates(trx, input, new Date())
  }

  async assertActivationAllowed(accountId: string, moduleId: string): Promise<void> {
    const installed = await this.installation(accountId, moduleId)
    const blockedPermission = await this.db
      .selectFrom('greenfield_module_permission_states')
      .select(['permission', 'state'])
      .where('installation_id', '=', installed.installation_id)
      .where('required', '=', true)
      .where('state', '!=', 'granted')
      .executeTakeFirst()
    if (blockedPermission) {
      throw moduleError('VALIDATION_FAILED', `Required permission ${blockedPermission.permission} is ${blockedPermission.state}`)
    }

    const blockedDependency = await this.db
      .selectFrom('greenfield_module_resolved_dependencies')
      .select(['target_module_id', 'provided_contract', 'relation'])
      .where('installation_id', '=', installed.installation_id)
      .where('blocking', '=', true)
      .where('satisfied', '=', false)
      .executeTakeFirst()
    if (blockedDependency) {
      throw moduleError('VALIDATION_FAILED', `Blocking dependency ${blockedDependency.target_module_id ?? blockedDependency.provided_contract} is unresolved`)
    }
  }

  async setRuntimeStatus(
    trx: Transaction<Database>,
    input: {
      installationId: string
      status: 'registered' | 'disabled' | 'quarantined' | 'removed'
      jobsPaused?: boolean
      storageStatus?: 'allocated' | 'disabled' | 'quarantined' | 'released'
    },
  ): Promise<void> {
    const now = new Date()
    for (const table of REGISTRATION_TABLES) {
      if (table === 'greenfield_module_storage_allocations') {
        const storageStatus = input.storageStatus ?? (input.status === 'registered' ? 'allocated' : input.status === 'removed' ? 'released' : input.status)
        await trx.updateTable(table).set({status: storageStatus, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
      } else if (table === 'greenfield_module_job_registrations') {
        await trx.updateTable(table).set({status: input.status === 'registered' ? 'registered' : input.status === 'removed' ? 'removed' : input.jobsPaused ? 'paused' : 'disabled', paused: Boolean(input.jobsPaused), updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
      } else {
        await trx.updateTable(table).set({status: input.status, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
      }
    }
  }

  async removeRuntimeState(trx: Transaction<Database>, installationId: string): Promise<void> {
    for (const table of REGISTRATION_TABLES) {
      await trx.deleteFrom(table).where('installation_id', '=', installationId).execute()
    }
    await trx.deleteFrom('greenfield_module_capability_registry').where('installation_id', '=', installationId).execute()
    await trx.deleteFrom('greenfield_module_permission_states').where('installation_id', '=', installationId).execute()
    await trx.deleteFrom('greenfield_module_resolved_dependencies').where('installation_id', '=', installationId).execute()
  }

  async storeSecret(input: {
    accountId: string
    moduleId: string
    secretKey: string
    plaintext: string
  }): Promise<{secretRef: string; descriptor: Record<string, unknown>}> {
    const installed = await this.installation(input.accountId, input.moduleId)
    const key = secretStorageKey()
    const nonce = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, nonce)
    const encrypted = Buffer.concat([cipher.update(input.plaintext, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const now = new Date()
    const secretRef = `module-secret:${installed.installation_id}:${input.secretKey}`
    const descriptor = {
      configured: true,
      secretRef,
      scope: 'installation',
      updatedAt: now.toISOString(),
    }
    await this.db
      .insertInto('greenfield_module_secret_refs')
      .values({
        secret_ref: secretRef,
        installation_id: installed.installation_id,
        account_id: input.accountId,
        module_id: input.moduleId,
        secret_key: input.secretKey,
        encrypted_value: encrypted,
        nonce,
        auth_tag: authTag,
        key_version: 'module-secrets.v1',
        status: 'active',
        redacted_descriptor: jsonb(descriptor),
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc =>
        oc.column('secret_ref').doUpdateSet({
          encrypted_value: encrypted,
          nonce,
          auth_tag: authTag,
          status: 'active',
          redacted_descriptor: jsonb(descriptor),
          updated_at: now,
        }),
      )
      .execute()
    return {secretRef, descriptor}
  }

  async invokeService(input: {
    accountId: string
    callerModuleId: string
    providerModuleId: string
    serviceId: string
    payload: unknown
    idempotencyKey: string
    depth?: number
    actorId?: string
    requestId?: string
  }): Promise<{idempotent: boolean; invocationId: string; status: string; result: unknown}> {
    if (!input.idempotencyKey) throw moduleError('VALIDATION_FAILED', 'Idempotency key is required')
    const depth = input.depth ?? 1
    const caller = await this.installation(input.accountId, input.callerModuleId)
    if (caller.status !== 'enabled') throw moduleError('FORBIDDEN', 'Calling module must be enabled')
    const service = await this.db
      .selectFrom('greenfield_module_service_registrations')
      .innerJoin('greenfield_extension_installations', 'greenfield_extension_installations.installation_id', 'greenfield_module_service_registrations.installation_id')
      .selectAll('greenfield_module_service_registrations')
      .select('greenfield_extension_installations.status as installation_status')
      .where('greenfield_module_service_registrations.account_id', '=', input.accountId)
      .where('greenfield_module_service_registrations.module_id', '=', input.providerModuleId)
      .where('greenfield_module_service_registrations.service_id', '=', input.serviceId)
      .executeTakeFirst()
    if (!service) throw moduleError('NOT_FOUND', 'Registered module service not found')
    if (service.status !== 'registered' || service.installation_status !== 'enabled') throw moduleError('FORBIDDEN', 'Provider service is not enabled')
    if (service.health_state !== 'healthy' && service.health_state !== 'degraded') throw moduleError('CAPABILITY_DISABLED', `Provider service health is ${service.health_state}`)
    if (depth > service.invocation_depth_limit) throw moduleError('VALIDATION_FAILED', 'Module service invocation depth exceeded')

    const previous = await this.db
      .selectFrom('greenfield_module_service_invocations')
      .selectAll()
      .where('caller_installation_id', '=', caller.installation_id)
      .where('service_registration_id', '=', service.service_registration_id)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
    if (previous) return {idempotent: true, invocationId: previous.invocation_id, status: previous.status, result: previous.redacted_output}

    await this.enforceRateLimit(service.service_registration_id, service.rate_limit_per_minute)
    const payload = objectPayload(input.payload)
    validateSchemaBoundary(service.input_schema_ref, payload, 'input')
    const policy = await new GreenfieldPolicyEngine(this.db).evaluateAndAudit({
      action: 'module.runtime.service.invoke',
      accountId: input.accountId,
      actorId: input.actorId,
      moduleId: input.providerModuleId,
      resource: {type: 'module', id: input.providerModuleId},
      currentState: 'enabled',
      requestContext: input.requestId ? {requestId: input.requestId} : undefined,
    })
    if (!policy.allowed) {
      const invocationId = await this.recordInvocation(input, caller.installation_id, service, payload, 'denied', null, policy.code, 'POLICY_DENIED', 0)
      throw Object.assign(new Error('Policy denied module service invocation'), {code: 'FORBIDDEN', invocationId, policyCode: policy.code})
    }
    await this.enforceServicePermissions(service.installation_id, arrayOfStrings(service.permissions))

    const started = Date.now()
    try {
      const result = await this.invokeGreenfieldProvider(service, payload)
      validateSchemaBoundary(service.output_schema_ref, result, 'output')
      const invocationId = await this.recordInvocation(input, caller.installation_id, service, payload, 'completed', result, policy.code, null, Date.now() - started)
      await new AuditRepository(this.db).append('module.service.invoked', {
        callerModuleId: input.callerModuleId,
        providerModuleId: input.providerModuleId,
        serviceId: input.serviceId,
        invocationId,
      }, {type: 'moduleService', id: input.serviceId, actorId: input.actorId ?? null}, {accountId: input.accountId, result: 'succeeded', requestId: input.requestId ?? null})
      return {idempotent: false, invocationId, status: 'completed', result}
    } catch (error) {
      const invocationId = await this.recordInvocation(input, caller.installation_id, service, payload, 'failed', null, policy.code, errorCode(error), Date.now() - started)
      await new AuditRepository(this.db).append('module.service.failed', {
        callerModuleId: input.callerModuleId,
        providerModuleId: input.providerModuleId,
        serviceId: input.serviceId,
        invocationId,
        failureCode: errorCode(error),
      }, {type: 'moduleService', id: input.serviceId, actorId: input.actorId ?? null}, {accountId: input.accountId, result: 'failed', requestId: input.requestId ?? null})
      throw error
    }
  }

  async runtimeSummary(accountId: string, moduleId: string) {
    const installed = await this.installation(accountId, moduleId)
    const [dependencies, permissions, capabilities, services, apis, hooks, storage, jobs, ui] = await Promise.all([
      this.db.selectFrom('greenfield_module_resolved_dependencies').selectAll().where('installation_id', '=', installed.installation_id).orderBy('relation').execute(),
      this.db.selectFrom('greenfield_module_permission_states').selectAll().where('installation_id', '=', installed.installation_id).orderBy('permission').execute(),
      this.db.selectFrom('greenfield_module_capability_registry').selectAll().where('installation_id', '=', installed.installation_id).orderBy('capability').execute(),
      this.db.selectFrom('greenfield_module_service_registrations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('service_id').execute(),
      this.db.selectFrom('greenfield_module_api_registrations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('api_id').execute(),
      this.db.selectFrom('greenfield_module_hook_registrations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('order_index').execute(),
      this.db.selectFrom('greenfield_module_storage_allocations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('storage_key').execute(),
      this.db.selectFrom('greenfield_module_job_registrations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('job_key').execute(),
      this.db.selectFrom('greenfield_module_ui_contribution_registrations').selectAll().where('installation_id', '=', installed.installation_id).orderBy('contribution_key').execute(),
    ])
    return {installationId: installed.installation_id, moduleId, status: installed.status, dependencies, permissions, capabilities, services, apis, hooks, storage, jobs, ui}
  }

  private async persistResolvedDependencies(
    trx: Transaction<Database>,
    input: {
      planId: string
      installationId: string
      accountId: string
      release: GreenfieldModuleReleaseRecord
      dependencyPlan: DependencyResolutionPlan
    },
    now: Date,
  ) {
    await trx.deleteFrom('greenfield_module_resolved_dependencies').where('installation_id', '=', input.installationId).execute()
    const rows = [
      ...input.dependencyPlan.dependencies.map((dependency, index) => ({
        resolution_id: `module-dependency-resolution:${input.planId}:${index}`,
        plan_id: input.planId,
        installation_id: input.installationId,
        account_id: input.accountId,
        release_id: input.release.releaseId,
        module_id: input.release.moduleId,
        relation: dependency.relation as GreenfieldModuleDependencyRelation,
        target_module_id: dependency.moduleId === 'unknown' ? null : dependency.moduleId,
        provided_contract: dependency.provides,
        requested_range: dependency.requestedRange,
        resolved_module_id: dependency.resolvedModuleId,
        resolved_version: dependency.resolvedVersion,
        installed: dependency.installed,
        satisfied: dependency.satisfied,
        blocking: dependency.blocking,
        degraded: dependency.optional && !dependency.satisfied,
        reason: dependency.reason ?? null,
        created_at: now,
        updated_at: now,
      })),
      ...input.dependencyPlan.provides.map((provide, index) => ({
        resolution_id: `module-dependency-provide:${input.planId}:${index}`,
        plan_id: input.planId,
        installation_id: input.installationId,
        account_id: input.accountId,
        release_id: input.release.releaseId,
        module_id: input.release.moduleId,
        relation: 'provides' as GreenfieldModuleDependencyRelation,
        target_module_id: null,
        provided_contract: provide.id,
        requested_range: provide.version,
        resolved_module_id: input.release.moduleId,
        resolved_version: input.release.version,
        installed: false,
        satisfied: true,
        blocking: false,
        degraded: false,
        reason: provide.title,
        created_at: now,
        updated_at: now,
      })),
    ]
    if (rows.length) await trx.insertInto('greenfield_module_resolved_dependencies').values(rows).execute()
  }

  private async persistPermissionStates(
    trx: Transaction<Database>,
    input: {
      installationId: string
      accountId: string
      release: GreenfieldModuleReleaseRecord
      grantedPermissions: string[]
      deniedPermissions: string[]
    },
    now: Date,
  ) {
    await trx.deleteFrom('greenfield_module_permission_states').where('installation_id', '=', input.installationId).execute()
    const granted = new Set(input.grantedPermissions)
    const denied = new Set(input.deniedPermissions)
    const rows = permissionEntries(input.release.manifest).map(permission => {
      const state = stateForPermission(permission.permission, permission.required, granted, denied)
      return {
        permission_state_id: `module-permission-state:${input.installationId}:${permission.permission}`,
        installation_id: input.installationId,
        account_id: input.accountId,
        release_id: input.release.releaseId,
        module_id: input.release.moduleId,
        permission: permission.permission,
        state,
        required: permission.required,
        risk: permission.risk,
        policy_mode: permission.policyMode,
        reason: permission.reason,
        granted_at: state === 'granted' ? now : null,
        denied_at: state === 'denied' || state === 'unsupported' || state === 'requires-platform' ? now : null,
        revoked_at: state === 'revoked' ? now : null,
        updated_at: now,
      }
    })
    if (rows.length) await trx.insertInto('greenfield_module_permission_states').values(rows).execute()
  }

  private async recordLifecycleTransaction(
    trx: Transaction<Database>,
    input: {
      installationId: string
      accountId: string
      releaseId: string | null
      moduleId: string
      action: 'install' | 'enable' | 'disable' | 'update' | 'uninstall' | 'repair' | 'quarantine' | 'unquarantine'
      status: 'planned' | 'running' | 'completed' | 'failed' | 'rolled-back' | 'cancelled'
      idempotencyKey?: string | null
      metadata?: Record<string, unknown>
      dataRetentionChoice?: 'keepData' | 'exportThenDelete' | 'deleteData' | null
      stages: string[]
    },
  ): Promise<string> {
    const now = new Date()
    const transactionId = `module-lifecycle:${input.installationId}:${input.action}:${now.getTime()}`
    await trx
      .insertInto('greenfield_module_lifecycle_transactions')
      .values({
        transaction_id: transactionId,
        installation_id: input.installationId,
        account_id: input.accountId,
        release_id: input.releaseId,
        module_id: input.moduleId,
        action: input.action,
        status: input.status,
        idempotency_key: input.idempotencyKey ?? null,
        rollback_policy: 'preserve-data',
        data_retention_choice: input.dataRetentionChoice ?? null,
        metadata: jsonb(input.metadata ?? {}),
        started_at: now,
        completed_at: input.status === 'completed' || input.status === 'failed' || input.status === 'rolled-back' ? now : null,
        created_at: now,
        updated_at: now,
      })
      .execute()
    await trx
      .insertInto('greenfield_module_lifecycle_stages')
      .values(input.stages.map((stage, index) => ({
        stage_id: `module-lifecycle-stage:${transactionId}:${index}`,
        transaction_id: transactionId,
        stage,
        order_index: index,
        status: index === input.stages.length - 1 && input.status === 'running' ? 'running' : 'completed',
        failure_code: null,
        metadata: jsonb({deterministicOrder: index}),
        started_at: now,
        completed_at: index === input.stages.length - 1 && input.status === 'running' ? null : now,
        created_at: now,
      })))
      .execute()
    return transactionId
  }

  private async installation(accountId: string, moduleId: string) {
    const row = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select([
        'greenfield_extension_installations.installation_id',
        'greenfield_extension_installations.status',
        'greenfield_module_releases.release_id',
      ])
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.module_id', '=', moduleId)
      .where('greenfield_extension_installations.status', 'not in', [...NOT_INSTALLED_STATUSES])
      .executeTakeFirst()
    if (!row) throw moduleError('NOT_FOUND', 'Module installation not found')
    return row
  }

  private async enforceRateLimit(serviceRegistrationId: string, rateLimitPerMinute: number): Promise<void> {
    const since = new Date(Date.now() - 60_000)
    const row = await this.db
      .selectFrom('greenfield_module_service_invocations')
      .select(({fn}) => fn.countAll<number>().as('count'))
      .where('service_registration_id', '=', serviceRegistrationId)
      .where('created_at', '>', since)
      .executeTakeFirst()
    if (Number(row?.count ?? 0) >= rateLimitPerMinute) throw moduleError('CAPABILITY_DISABLED', 'Module service rate limit exceeded')
  }

  private async enforceServicePermissions(providerInstallationId: string, permissions: string[]): Promise<void> {
    for (const permission of permissions) {
      const row = await this.db
        .selectFrom('greenfield_module_permission_states')
        .select('state')
        .where('installation_id', '=', providerInstallationId)
        .where('permission', '=', permission)
        .executeTakeFirst()
      if (!row || row.state !== 'granted') throw moduleError('FORBIDDEN', `Module service permission denied: ${permission}`)
    }
  }

  private async invokeGreenfieldProvider(service: Database['greenfield_module_service_registrations'], payload: Record<string, unknown>) {
    if (service.service_kind === 'search') {
      const query = typeof payload.query === 'string' ? payload.query.toLowerCase() : ''
      const rows = await this.db
        .selectFrom('greenfield_module_records')
        .select(['record_id', 'collection', 'search_text', 'updated_at'])
        .where('account_id', '=', service.account_id)
        .where('module_id', '=', service.module_id)
        .where('deleted_at', 'is', null)
        .$if(Boolean(query), qb => qb.where(sql`lower(search_text)`, 'like', `%${query}%`))
        .orderBy('updated_at', 'desc')
        .limit(10)
        .execute()
      return {ok: true, kind: 'search', items: rows}
    }
    if (service.service_kind === 'markdown') {
      const text = typeof payload.text === 'string' ? payload.text : ''
      return {ok: true, kind: 'markdown', wordCount: text.trim() ? text.trim().split(/\s+/).length : 0, characterCount: text.length}
    }
    if (service.service_kind === 'storage') {
      const rows = await this.db
        .selectFrom('greenfield_module_storage_allocations')
        .select(['storage_key', 'storage_kind', 'scope', 'quota_bytes', 'retention_policy', 'encrypted', 'status'])
        .where('installation_id', '=', service.installation_id)
        .orderBy('storage_key')
        .execute()
      return {ok: true, kind: 'storage', allocations: rows}
    }
    return {ok: true, kind: service.service_kind, handledBy: 'greenfield-service-gateway'}
  }

  private async recordInvocation(
    input: {
      accountId: string
      callerModuleId: string
      providerModuleId: string
      serviceId: string
      idempotencyKey: string
      depth?: number
    },
    callerInstallationId: string,
    service: Database['greenfield_module_service_registrations'],
    payload: Record<string, unknown>,
    status: 'completed' | 'failed' | 'denied' | 'timed-out',
    result: unknown,
    policyCode: string,
    failureCode: string | null,
    latencyMs: number,
  ): Promise<string> {
    const invocationId = uuidv7()
    await this.db
      .insertInto('greenfield_module_service_invocations')
      .values({
        invocation_id: invocationId,
        caller_installation_id: callerInstallationId,
        provider_installation_id: service.installation_id,
        service_registration_id: service.service_registration_id,
        account_id: input.accountId,
        caller_module_id: input.callerModuleId,
        provider_module_id: input.providerModuleId,
        service_id: input.serviceId,
        idempotency_key: input.idempotencyKey,
        invocation_depth: input.depth ?? 1,
        status,
        input_hash: sha256(canonicalJsonStringify(payload)),
        output_hash: result === null ? null : sha256(canonicalJsonStringify(result)),
        policy_code: policyCode,
        failure_code: failureCode,
        latency_ms: latencyMs,
        redacted_input: jsonb(redactSecrets(payload)),
        redacted_output: jsonb(redactSecrets(result ?? {})),
        created_at: new Date(),
        completed_at: new Date(),
      })
      .execute()
    return invocationId
  }
}

export function permissionEntries(manifest: GreenfieldModuleManifest): RuntimePermissionEntry[] {
  const byPermission = new Map<string, RuntimePermissionEntry>()
  for (const permission of manifest.permissions ?? []) {
    const permissionRecord = permission as unknown as Record<string, unknown>
    byPermission.set(permission.permission, {
      permission: permission.permission,
      required: true,
      risk: normalRisk(permission.risk),
      policyMode: normalPolicyMode(permissionRecord.policyMode),
      reason: permission.reason,
    })
  }
  const model = asRecord((manifest as unknown as Record<string, unknown>).permissionModel)
  const categories = asRecord(model.categories)
  for (const entries of Object.values(categories)) {
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      const permission = asRecord(entry)
      const id = stringValue(permission.id)
      if (!id) continue
      const existing = byPermission.get(id)
      byPermission.set(id, {
        permission: id,
        required: Boolean(permission.required) || existing?.required === true,
        risk: normalRisk(permission.risk ?? existing?.risk),
        policyMode: normalPolicyMode(permission.policyMode ?? existing?.policyMode),
        reason: stringValue(permission.reason) ?? existing?.reason ?? 'Declared by Standard 2 permission model',
      })
    }
  }
  return Array.from(byPermission.values()).sort((a, b) => a.permission.localeCompare(b.permission))
}

export function allRuntimePermissionKeys(manifest: GreenfieldModuleManifest): string[] {
  return permissionEntries(manifest).map(permission => permission.permission)
}

function stateForPermission(permission: string, required: boolean, granted: Set<string>, denied: Set<string>): GreenfieldModulePermissionState {
  if (/^(unsupported|blocked):/.test(permission)) return 'unsupported'
  if (/^(ios|android|native|keychain|camera|location|bluetooth|nfc):/.test(permission)) return 'requires-platform'
  if (permission.includes('reauthorisation') || permission.includes('reauthorization')) return 'requires-reauthorisation'
  if (denied.has(permission)) return 'denied'
  if (granted.has(permission)) return 'granted'
  return required ? 'denied' : 'requested'
}

function secretStorageKey(): Buffer {
  const raw = process.env.MODULA_MODULE_SECRETS_KEY ?? process.env.MODULA_ENCRYPTION_KEY
  if (!raw) throw moduleError('CAPABILITY_DISABLED', 'Module secret storage key is not configured')
  return createHash('sha256').update(raw, 'utf8').digest()
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) throw moduleError('VALIDATION_FAILED', 'Module service payload must be an object')
  return value as Record<string, unknown>
}

function validateSchemaBoundary(schemaRef: string | null, value: unknown, direction: 'input' | 'output'): void {
  if (!schemaRef) return
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw moduleError('VALIDATION_FAILED', `Module service ${direction} must be an object for schema ${schemaRef}`)
  }
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalRisk(value: unknown): 'low' | 'medium' | 'high' | 'critical' | 'restricted' {
  return value === 'medium' || value === 'high' || value === 'critical' || value === 'restricted' ? value : 'low'
}

function normalPolicyMode(value: unknown): 'observe' | 'warn' | 'require-confirmation' | 'block' {
  return value === 'warn' || value === 'require-confirmation' || value === 'block' ? value : 'observe'
}

function redactSecrets(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactSecrets)
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    /secret|token|password|private|credential/i.test(key) ? '[redacted]' : redactSecrets(entry),
  ]))
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'MODULE_SERVICE_INVOCATION_FAILED'
}
