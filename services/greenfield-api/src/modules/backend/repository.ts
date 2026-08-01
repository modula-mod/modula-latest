import {createHash} from 'node:crypto'
import type {ModuleBackendDefinition, ModuleBackendDiscovery, ModuleSessionClaims, ResolvedModuleCapability} from '@modula/greenfield-module-manifest'
import {backendModeForManifest} from '@modula/greenfield-module-manifest'
import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {
  ModuleBackendCircuitState,
  ModuleBackendDeliveryStatus,
  ModuleBackendFailureType,
  ModuleBackendHealthComponent,
  ModuleBackendHealthStatus,
  ModuleBackendLifecycleState,
  ModuleBackendMode,
  ModuleBackendWebhookDirection,
} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import type {GreenfieldModuleRuntimeContext} from '../runtime-access.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

export type ModuleBackendInstallationProjection = {
  backendInstallationId: string
  installationId: string
  releaseId: string
  accountId: string
  moduleId: string
  mode: ModuleBackendMode
  resolvedOrigin: string | null
  lifecycleState: ModuleBackendLifecycleState
  protocolVersion: string | null
  discovery: Record<string, unknown>
  capabilities: ResolvedModuleCapability[]
  verificationStatus: string
  verificationErrors: string[]
  lastVerifiedAt: Date | null
  lastHealthAt: Date | null
}

export class ModuleBackendRepository {
  constructor(private readonly db: ModulaDb) {}

  async definitionForRelease(releaseId: string): Promise<ModuleBackendDefinition | undefined> {
    const row = await this.db.selectFrom('module_backend_definitions').select('backend').where('release_id', '=', releaseId).executeTakeFirst()
    return isRecord(row?.backend) ? row.backend as ModuleBackendDefinition : undefined
  }

  async ensureDefinitionForContext(context: GreenfieldModuleRuntimeContext): Promise<ModuleBackendDefinition> {
    const existing = await this.definitionForRelease(context.releaseId)
    if (existing) return existing
    const backend = context.manifest.backend ?? {mode: 'greenfield-managed' as const}
    await this.db
      .insertInto('module_backend_definitions')
      .values({
        definition_id: `module-backend-definition:${context.releaseId}`,
        release_id: context.releaseId,
        module_id: context.moduleId,
        mode: backendModeForManifest(context.manifest),
        protocol_version: backend.protocolVersion ?? null,
        endpoint_strategy: backend.endpoints?.baseUrlStrategy ?? null,
        discovery_path: backend.endpoints?.discoveryPath ?? null,
        health_path: backend.endpoints?.healthPath ?? null,
        backend: jsonb(backend),
        trust: jsonb(backend.trust ?? {}),
        data: jsonb(backend.data ?? {}),
        deployment: jsonb(backend.deployment ?? {}),
        network_policy: jsonb(backend.network ?? {}),
        actions: jsonb(backend.actions ?? []),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(oc => oc.column('release_id').doNothing())
      .execute()
    return backend
  }

  async ensureInstallation(context: GreenfieldModuleRuntimeContext, origin?: string | null): Promise<ModuleBackendInstallationProjection> {
    const backend = await this.ensureDefinitionForContext(context)
    const mode = backendModeForManifest(context.manifest)
    const now = new Date()
    const requiresVerification = mode === 'module-managed' || mode === 'hybrid'
    await this.db
      .insertInto('module_backend_installations')
      .values({
        backend_installation_id: `module-backend-installation:${context.installationId}`,
        installation_id: context.installationId,
        release_id: context.releaseId,
        account_id: context.accountId,
        module_id: context.moduleId,
        mode,
        resolved_origin: origin ?? null,
        lifecycle_state: requiresVerification ? 'unconfigured' : 'available',
        protocol_version: backend.protocolVersion ?? null,
        discovery: jsonb({}),
        capabilities: jsonb([]),
        verification_status: requiresVerification ? 'pending' : 'not-required',
        verification_errors: jsonb([]),
        last_verified_at: null,
        last_health_at: null,
        enabled_at: context.installationStatus === 'enabled' ? now : null,
        disabled_at: context.installationStatus === 'disabled' ? now : null,
        created_at: now,
        updated_at: now,
      })
      .onConflict(oc => oc.column('installation_id').doUpdateSet({updated_at: now, mode, release_id: context.releaseId}))
      .execute()
    return this.requireInstallation(context.installationId)
  }

  async requireInstallation(installationId: string): Promise<ModuleBackendInstallationProjection> {
    const row = await this.db.selectFrom('module_backend_installations').selectAll().where('installation_id', '=', installationId).executeTakeFirst()
    if (!row) throw Object.assign(new Error('Module backend installation not found'), {code: 'NOT_FOUND'})
    return {
      backendInstallationId: row.backend_installation_id,
      installationId: row.installation_id,
      releaseId: row.release_id,
      accountId: row.account_id,
      moduleId: row.module_id,
      mode: row.mode,
      resolvedOrigin: row.resolved_origin,
      lifecycleState: row.lifecycle_state,
      protocolVersion: row.protocol_version,
      discovery: isRecord(row.discovery) ? row.discovery : {},
      capabilities: Array.isArray(row.capabilities) ? row.capabilities as ResolvedModuleCapability[] : [],
      verificationStatus: row.verification_status,
      verificationErrors: Array.isArray(row.verification_errors) ? row.verification_errors.filter((item): item is string => typeof item === 'string') : [],
      lastVerifiedAt: row.last_verified_at,
      lastHealthAt: row.last_health_at,
    }
  }

  async markDiscovered(input: {
    context: GreenfieldModuleRuntimeContext
    origin: string
    discovery: ModuleBackendDiscovery
    capabilities: ResolvedModuleCapability[]
  }): Promise<ModuleBackendInstallationProjection> {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .updateTable('module_backend_installations')
        .set({
          resolved_origin: input.origin,
          lifecycle_state: 'available',
          protocol_version: input.discovery.protocolVersion,
          discovery: jsonb(input.discovery),
          capabilities: jsonb(input.capabilities),
          verification_status: 'verified',
          verification_errors: jsonb([]),
          last_verified_at: now,
          updated_at: now,
        })
        .where('installation_id', '=', input.context.installationId)
        .execute()
      await trx.deleteFrom('module_backend_capabilities').where('installation_id', '=', input.context.installationId).execute()
      if (input.capabilities.length) {
        await trx
          .insertInto('module_backend_capabilities')
          .values(
            input.capabilities.map(capability => ({
              capability_id: uuidv7(),
              installation_id: input.context.installationId,
              module_id: input.context.moduleId,
              capability: capability.capability,
              provider: capability.provider,
              available: capability.available,
              granted: capability.granted,
              reason: capability.reason ?? null,
              updated_at: now,
            })),
          )
          .execute()
      }
    })
    return this.requireInstallation(input.context.installationId)
  }

  async markUnavailable(context: GreenfieldModuleRuntimeContext, reasonCode: string, details: Record<string, unknown>) {
    const now = new Date()
    await this.db
      .updateTable('module_backend_installations')
      .set({lifecycle_state: 'unreachable', verification_status: 'failed', verification_errors: jsonb([reasonCode]), updated_at: now})
      .where('installation_id', '=', context.installationId)
      .execute()
    await this.recordFailure({context, type: 'discovery', reasonCode, details})
  }

  async recordSession(input: {
    context: GreenfieldModuleRuntimeContext
    claims: ModuleSessionClaims
    token: string
    requestId?: string
  }) {
    await this.db
      .insertInto('module_backend_sessions')
      .values({
        session_id: input.claims.sessionId,
        installation_id: input.context.installationId,
        module_id: input.context.moduleId,
        account_id: input.context.accountId,
        actor_id: input.claims.actorId,
        audience: input.claims.audience,
        token_hash: sha256(input.token),
        permissions: jsonb(input.claims.permissions),
        capabilities: jsonb(input.claims.capabilities),
        issued_at: new Date(input.claims.issuedAt * 1000),
        expires_at: new Date(input.claims.expiresAt * 1000),
        revoked_at: null,
        request_id: input.requestId ?? input.claims.requestId ?? null,
        created_at: new Date(),
      })
      .execute()
  }

  async recordHealth(input: {
    context: GreenfieldModuleRuntimeContext
    component: ModuleBackendHealthComponent
    status: ModuleBackendHealthStatus
    latencyMs?: number | null
    failureCount?: number
    circuitState?: ModuleBackendCircuitState
    details?: Record<string, unknown>
  }) {
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('module_backend_health')
        .values({
          health_id: uuidv7(),
          installation_id: input.context.installationId,
          module_id: input.context.moduleId,
          component: input.component,
          status: input.status,
          latency_ms: input.latencyMs ?? null,
          failure_count: input.failureCount ?? (input.status === 'healthy' ? 0 : 1),
          circuit_state: input.circuitState ?? (input.status === 'healthy' ? 'closed' : 'open'),
          redacted_details: jsonb(input.details ?? {}),
          checked_at: now,
        })
        .execute()
      await trx
        .updateTable('module_backend_installations')
        .set({
          lifecycle_state: input.status === 'healthy' ? 'available' : input.status === 'degraded' ? 'degraded' : input.status,
          last_health_at: now,
          updated_at: now,
        })
        .where('installation_id', '=', input.context.installationId)
        .execute()
    })
  }

  async latestHealth(installationId: string) {
    return this.db
      .selectFrom('module_backend_health')
      .selectAll()
      .where('installation_id', '=', installationId)
      .orderBy('checked_at', 'desc')
      .executeTakeFirst()
  }

  async disableInstallation(installationId: string): Promise<ModuleBackendInstallationProjection> {
    await this.db
      .updateTable('module_backend_installations')
      .set({lifecycle_state: 'disabled', verification_status: 'failed', disabled_at: new Date(), updated_at: new Date()})
      .where('installation_id', '=', installationId)
      .execute()
    return this.requireInstallation(installationId)
  }

  async recordFailure(input: {
    context: GreenfieldModuleRuntimeContext
    type: ModuleBackendFailureType
    reasonCode: string
    details?: Record<string, unknown>
  }) {
    await this.db
      .insertInto('module_backend_failures')
      .values({
        failure_id: uuidv7(),
        installation_id: input.context.installationId,
        release_id: input.context.releaseId,
        module_id: input.context.moduleId,
        failure_type: input.type,
        reason_code: input.reasonCode,
        redacted_details: jsonb(input.details ?? {}),
        occurred_at: new Date(),
      })
      .execute()
  }

  async recordEventDelivery(input: {
    context: GreenfieldModuleRuntimeContext
    eventId: string
    eventType: string
    direction: 'greenfield-to-backend' | 'backend-to-greenfield'
    status: ModuleBackendDeliveryStatus
    payload: unknown
    idempotencyKey?: string | null
    failureCode?: string | null
    details?: Record<string, unknown>
  }) {
    await this.db
      .insertInto('module_backend_event_deliveries')
      .values({
        delivery_id: uuidv7(),
        installation_id: input.context.installationId,
        module_id: input.context.moduleId,
        event_id: input.eventId,
        event_type: input.eventType,
        direction: input.direction,
        status: input.status,
        idempotency_key: input.idempotencyKey ?? null,
        payload_hash: sha256(JSON.stringify(input.payload ?? null)),
        failure_code: input.failureCode ?? null,
        redacted_details: jsonb(input.details ?? {}),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(oc => oc.columns(['installation_id', 'event_id', 'direction']).doUpdateSet({status: 'duplicate', updated_at: new Date()}))
      .execute()
  }

  async hasEventDelivery(installationId: string, eventId: string, direction: 'greenfield-to-backend' | 'backend-to-greenfield'): Promise<boolean> {
    const row = await this.db
      .selectFrom('module_backend_event_deliveries')
      .select('delivery_id')
      .where('installation_id', '=', installationId)
      .where('event_id', '=', eventId)
      .where('direction', '=', direction)
      .executeTakeFirst()
    return Boolean(row)
  }

  async hasWebhookDelivery(installationId: string, webhookId: string, idempotencyKey: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('module_backend_webhook_deliveries')
      .select('webhook_delivery_id')
      .where('installation_id', '=', installationId)
      .where('webhook_id', '=', webhookId)
      .where('idempotency_key', '=', idempotencyKey)
      .executeTakeFirst()
    return Boolean(row)
  }

  async recordWebhookDelivery(input: {
    context: GreenfieldModuleRuntimeContext
    webhookId: string
    eventType: string
    direction: ModuleBackendWebhookDirection
    status: ModuleBackendDeliveryStatus
    payload: unknown
    idempotencyKey: string
    signatureValid: boolean
    failureCode?: string | null
  }) {
    await this.db
      .insertInto('module_backend_webhook_deliveries')
      .values({
        webhook_delivery_id: uuidv7(),
        installation_id: input.context.installationId,
        module_id: input.context.moduleId,
        webhook_id: input.webhookId,
        event_type: input.eventType,
        direction: input.direction,
        status: input.status,
        idempotency_key: input.idempotencyKey,
        payload_hash: sha256(JSON.stringify(input.payload ?? null)),
        signature_valid: input.signatureValid,
        failure_code: input.failureCode ?? null,
        redacted_details: jsonb({}),
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict(oc => oc.columns(['installation_id', 'webhook_id', 'idempotency_key']).doUpdateSet({status: 'duplicate', updated_at: new Date()}))
      .execute()
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
