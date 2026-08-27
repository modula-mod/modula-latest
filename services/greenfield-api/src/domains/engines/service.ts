import type {
  GreenfieldEngineCapabilityAvailability,
  GreenfieldEngineExecutionMode,
  GreenfieldEngineRuntimeStatus,
} from '../../database/types.js'
import type {ModulaDb} from '../../database/client.js'

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export type GreenfieldEngineTopology = {
  engineId: string
  version: string
  executionMode: GreenfieldEngineExecutionMode
  runtimeStatus: GreenfieldEngineRuntimeStatus
  packageName: string
  source: {repository: string; revision: string}
  trustedPlatform: true
  health: unknown
  capabilities: Array<{capability: string; version: number; operations: string[]; sensitive: boolean; availability: GreenfieldEngineCapabilityAvailability}>
  services: Array<{serviceId: string; executionMode: Exclude<GreenfieldEngineExecutionMode, 'CONTRACT_ONLY'>; audience: string; protocolVersion: string; actions: string[]; requiredCapabilities: string[]; healthPath: string; timeoutMs: number; tlsRequired: boolean}>
  jobs: Array<{action: string; version: number; timeoutSeconds: number; maximumAttempts: number; active: boolean}>
  eventConsumers: Array<{eventType: string; schemaVersion: number; active: boolean}>
  usageMetrics: Array<{metric: string; active: boolean}>
}

export class GreenfieldEngineRegistryService {
  constructor(private readonly db: ModulaDb) {}

  async list(): Promise<GreenfieldEngineTopology[]> {
    const [engines, capabilities, services, jobs, consumers, metrics] = await Promise.all([
      this.db.selectFrom('greenfield_engine_registrations').selectAll().orderBy('engine_id').execute(),
      this.db.selectFrom('greenfield_engine_capability_registrations').selectAll().orderBy('engine_id').orderBy('capability').execute(),
      this.db.selectFrom('greenfield_engine_service_registrations').selectAll().orderBy('engine_id').orderBy('service_id').execute(),
      this.db.selectFrom('greenfield_engine_job_registrations').selectAll().orderBy('engine_id').orderBy('action').execute(),
      this.db.selectFrom('greenfield_engine_event_consumer_registrations').selectAll().orderBy('engine_id').orderBy('event_type').execute(),
      this.db.selectFrom('greenfield_engine_usage_metric_registrations').selectAll().orderBy('engine_id').orderBy('metric').execute(),
    ])
    return engines.map(engine => ({
      engineId: engine.engine_id,
      version: engine.version,
      executionMode: engine.execution_mode,
      runtimeStatus: engine.runtime_status,
      packageName: engine.package_name,
      source: {repository: engine.source_repository, revision: engine.source_revision},
      trustedPlatform: true,
      health: engine.health,
      capabilities: capabilities.filter(item => item.engine_id === engine.engine_id).map(item => ({
        capability: item.capability, version: item.version, operations: stringArray(item.operations), sensitive: item.sensitive, availability: item.availability,
      })),
      services: services.filter(item => item.engine_id === engine.engine_id).map(item => ({
        serviceId: item.service_id, executionMode: item.execution_mode, audience: item.audience, protocolVersion: item.protocol_version,
        actions: stringArray(item.actions), requiredCapabilities: stringArray(item.required_capabilities), healthPath: item.health_path,
        timeoutMs: item.timeout_ms, tlsRequired: item.tls_required,
      })),
      jobs: jobs.filter(item => item.engine_id === engine.engine_id).map(item => ({action: item.action, version: item.version, timeoutSeconds: item.timeout_seconds, maximumAttempts: item.maximum_attempts, active: item.active})),
      eventConsumers: consumers.filter(item => item.engine_id === engine.engine_id).map(item => ({eventType: item.event_type, schemaVersion: item.schema_version, active: item.active})),
      usageMetrics: metrics.filter(item => item.engine_id === engine.engine_id).map(item => ({metric: item.metric, active: item.active})),
    }))
  }

  async get(engineId: string): Promise<GreenfieldEngineTopology | undefined> {
    return (await this.list()).find(engine => engine.engineId === engineId)
  }

  async publicTopology() {
    return (await this.list()).map(engine => ({
      engineId: engine.engineId,
      version: engine.version,
      executionMode: engine.executionMode,
      runtimeStatus: engine.runtimeStatus,
      serviceIds: engine.services.map(service => service.serviceId),
      source: engine.source,
    }))
  }
}
