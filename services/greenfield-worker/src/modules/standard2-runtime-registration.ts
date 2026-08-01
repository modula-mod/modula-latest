import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'

const jsonb = (value: unknown) => sql`${JSON.stringify(value)}::jsonb`

type RuntimeStatus = 'registered' | 'disabled' | 'quarantined' | 'removed'

const REGISTRATION_TABLES = [
  'greenfield_module_capability_registry',
  'greenfield_module_service_registrations',
  'greenfield_module_api_registrations',
  'greenfield_module_hook_registrations',
  'greenfield_module_storage_allocations',
  'greenfield_module_job_registrations',
  'greenfield_module_ui_contribution_registrations',
] as const

export async function projectStandard2Runtime(
  db: ModulaWorkerDb,
  input: {
    installationId: string
    accountId: string
    moduleId: string
    releaseId: string
    status: RuntimeStatus
    jobsPaused: boolean
  },
): Promise<void> {
  const release = await db
    .selectFrom('greenfield_module_releases')
    .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
    .select(['greenfield_module_versions.manifest'])
    .where('greenfield_module_releases.release_id', '=', input.releaseId)
    .executeTakeFirst()
  const manifest = asRecord(release?.manifest)
  const now = new Date()

  for (const table of REGISTRATION_TABLES) {
    await (db as any).deleteFrom(table).where('installation_id', '=', input.installationId).execute()
  }

  await insertCapabilities(db, input, manifest, now)
  await insertServices(db, input, manifest, now)
  await insertApis(db, input, manifest, now)
  await insertHooks(db, input, manifest, now)
  await insertStorage(db, input, manifest, now)
  await insertJobs(db, input, manifest, now)
  await insertUiContributions(db, input, manifest, now)
  await recordLifecycleTransaction(db, input, lifecycleStagesFor(input.status), now)
}

export async function setStandard2RuntimeStatus(
  db: ModulaWorkerDb,
  input: {
    installationId: string
    accountId: string
    moduleId: string
    releaseId: string | null
    action: 'enable' | 'disable' | 'update' | 'uninstall' | 'repair' | 'quarantine' | 'unquarantine'
    status: RuntimeStatus
    jobsPaused: boolean
  },
): Promise<void> {
  const now = new Date()
  const inactiveHealth = input.status === 'removed' ? 'disabled' : input.status
  await db.updateTable('greenfield_module_capability_registry').set({state: input.status === 'registered' ? 'granted' : input.status === 'removed' ? 'revoked' : 'denied', health_state: input.status === 'registered' ? 'healthy' : inactiveHealth, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_service_registrations').set({status: input.status, health_state: input.status === 'registered' ? 'healthy' : inactiveHealth, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_api_registrations').set({status: input.status, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_hook_registrations').set({status: input.status, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_storage_allocations').set({status: input.status === 'registered' ? 'allocated' : input.status === 'removed' ? 'released' : input.status, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_job_registrations').set({status: input.status === 'registered' ? 'registered' : input.status === 'removed' ? 'removed' : input.jobsPaused ? 'paused' : 'disabled', paused: input.jobsPaused, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await db.updateTable('greenfield_module_ui_contribution_registrations').set({status: input.status, updated_at: now} as any).where('installation_id', '=', input.installationId).execute()
  await recordLifecycleTransaction(db, input, lifecycleStagesFor(input.status), now)
}

export async function removeStandard2Runtime(db: ModulaWorkerDb, installationId: string): Promise<void> {
  for (const table of REGISTRATION_TABLES) {
    await (db as any).deleteFrom(table).where('installation_id', '=', installationId).execute()
  }
}

async function insertCapabilities(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows: any[] = []
  const discovery = asRecord(manifest.capabilityDiscovery)
  for (const [key, value] of Object.entries(discovery)) {
    if (!key.startsWith('supports') || typeof value !== 'boolean') continue
    const capability = capabilityNameFromFlag(key)
    rows.push({
      capability_registration_id: `module-capability:${input.installationId}:${capability}:module`,
      installation_id: input.installationId,
      account_id: input.accountId,
      release_id: input.releaseId,
      module_id: input.moduleId,
      capability,
      provider_kind: capability === 'ai' ? 'ai-provider' : 'module',
      provider_module_id: input.moduleId,
      provider_installation_id: input.installationId,
      state: value ? 'granted' : 'unsupported',
      required: false,
      health_state: value ? (capability === 'ai' ? 'configuration-required' : 'healthy') : 'unavailable',
      declaration: jsonb({flag: key, value}),
      reason: value ? 'Declared by Standard 2 capabilityDiscovery' : 'Capability explicitly unsupported by module',
      created_at: now,
      updated_at: now,
    })
  }
  for (const service of versionedItems(manifest.serviceRegistry)) {
    for (const capability of arrayOfStrings(service.capabilities)) {
      rows.push({
        capability_registration_id: `module-capability:${input.installationId}:${capability}:service`,
        installation_id: input.installationId,
        account_id: input.accountId,
        release_id: input.releaseId,
        module_id: input.moduleId,
        capability,
        provider_kind: 'service',
        provider_module_id: input.moduleId,
        provider_installation_id: input.installationId,
        state: 'granted',
        required: false,
        health_state: capability === 'ai' ? 'configuration-required' : 'healthy',
        declaration: jsonb(service),
        reason: 'Provided by Standard 2 serviceRegistry',
        created_at: now,
        updated_at: now,
      })
    }
  }
  for (const provide of arrayOfRecords(asRecord(manifest.dependencyGraph).provides)) {
    rows.push({
      capability_registration_id: `module-capability:${input.installationId}:${String(provide.id)}:provide`,
      installation_id: input.installationId,
      account_id: input.accountId,
      release_id: input.releaseId,
      module_id: input.moduleId,
      capability: String(provide.id),
      provider_kind: provide.kind === 'api' ? 'api' : provide.kind === 'service' ? 'service' : 'module',
      provider_module_id: input.moduleId,
      provider_installation_id: input.installationId,
      state: 'granted',
      required: false,
      health_state: 'healthy',
      declaration: jsonb(provide),
      reason: 'Provided contract from Standard 2 dependencyGraph',
      created_at: now,
      updated_at: now,
    })
  }
  const deduped = dedupeCapabilities(rows)
  if (deduped.length) await db.insertInto('greenfield_module_capability_registry').values(deduped).execute()
}

function dedupeCapabilities(rows: any[]): any[] {
  const seen = new Set<string>()
  return rows.filter(row => {
    const key = `${row.installation_id}:${row.capability}:${row.provider_kind}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

async function insertServices(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows = versionedItems(manifest.serviceRegistry).map(service => ({
    service_registration_id: `module-service:${input.installationId}:${String(service.id)}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    service_id: String(service.id),
    service_kind: String(service.kind ?? 'custom'),
    version: String(service.version ?? '1.0.0'),
    contract_ref: String(service.contract ?? service.id),
    permissions: jsonb(arrayOfStrings(service.permissions)),
    capabilities: jsonb(arrayOfStrings(service.capabilities)),
    input_schema_ref: stringOrNull(service.inputSchema),
    output_schema_ref: stringOrNull(service.outputSchema),
    status: input.status,
    health_state: input.status === 'registered' ? (arrayOfStrings(service.capabilities).includes('ai') ? 'configuration-required' : 'healthy') : 'disabled',
    timeout_ms: boundedNumber(service.timeoutMs, 5000, 100, 30000),
    rate_limit_per_minute: boundedNumber(service.rateLimitPerMinute, 60, 1, 10000),
    invocation_depth_limit: boundedNumber(service.invocationDepthLimit, 4, 1, 16),
    declaration: jsonb(service),
    created_at: now,
    updated_at: now,
  }))
  if (rows.length) await db.insertInto('greenfield_module_service_registrations').values(rows as any).execute()
}

async function insertApis(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows = versionedItems(manifest.apiRegistry).map(api => ({
    api_registration_id: `module-api:${input.installationId}:${String(api.id)}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    api_id: String(api.id),
    method: String(api.method ?? 'GET'),
    path: String(api.path ?? `/api/modula/${input.moduleId}`),
    input_schema_ref: stringOrNull(api.inputSchema),
    output_schema_ref: stringOrNull(api.outputSchema),
    permissions: jsonb(arrayOfStrings(api.permissions)),
    side_effects: String(api.sideEffects ?? 'none'),
    idempotent: Boolean(api.idempotent),
    status: input.status,
    declaration: jsonb(api),
    created_at: now,
    updated_at: now,
  }))
  if (rows.length) await db.insertInto('greenfield_module_api_registrations').values(rows as any).execute()
}

async function insertHooks(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const hooks = versionedItems(manifest.hookRegistry).sort((a, b) =>
    `${phaseOrder(a.phase)}:${a.target ?? ''}:${a.hook ?? ''}:${a.id ?? ''}`.localeCompare(`${phaseOrder(b.phase)}:${b.target ?? ''}:${b.hook ?? ''}:${b.id ?? ''}`),
  )
  assertNoHookCycles(hooks)
  const rows = hooks.map((hook, index) => ({
    hook_registration_id: `module-hook:${input.installationId}:${String(hook.id)}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    hook_id: String(hook.id),
    hook: String(hook.hook ?? hook.id),
    phase: String(hook.phase ?? 'before'),
    target: String(hook.target ?? input.moduleId),
    order_index: index,
    timeout_ms: boundedNumber(hook.timeoutMs, 2000, 100, 10000),
    failure_policy: String(hook.policyMode ?? 'observe'),
    status: input.status,
    declaration: jsonb(hook),
    created_at: now,
    updated_at: now,
  }))
  if (rows.length) await db.insertInto('greenfield_module_hook_registrations').values(rows as any).execute()
}

function phaseOrder(value: unknown): string {
  if (value === 'before') return '0-before'
  if (value === 'after') return '2-after'
  return '1-around'
}

function assertNoHookCycles(hooks: Record<string, unknown>[]): void {
  const ids = new Set(hooks.map(hook => stringOrNull(hook.id)).filter((id): id is string => Boolean(id)))
  const edges = new Map<string, string[]>()
  for (const hook of hooks) {
    const id = stringOrNull(hook.id)
    if (!id) continue
    const dependencies = [
      ...arrayOfStrings(hook.dependsOn),
      ...arrayOfStrings(hook.afterHooks),
      ...arrayOfStrings(hook.beforeHooks),
      stringOrNull(hook.after),
      stringOrNull(hook.before),
    ].filter((dependency): dependency is string => typeof dependency === 'string' && ids.has(dependency))
    if (dependencies.includes(id)) throw new Error(`Standard 2 hook ordering cycle detected at ${id}`)
    edges.set(id, dependencies)
  }
  const visiting = new Set<string>()
  const visited = new Set<string>()
  const visit = (id: string, path: string[]) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`Standard 2 hook ordering cycle detected: ${[...path, id].join(' -> ')}`)
    visiting.add(id)
    for (const dependency of edges.get(id) ?? []) visit(dependency, [...path, id])
    visiting.delete(id)
    visited.add(id)
  }
  for (const id of ids) visit(id, [])
}

async function insertStorage(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows = versionedItems(manifest.storageModel).map(storage => ({
    allocation_id: `module-storage:${input.installationId}:${String(storage.id)}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    storage_key: String(storage.id),
    storage_kind: runtimeStorageKind(String(storage.kind ?? 'structured-records')),
    scope: String(storage.scope ?? 'installation'),
    quota_bytes: quotaBytes(storage.quota),
    retention_policy: String(storage.retention ?? 'retain'),
    encrypted: Boolean(storage.encrypted) || String(storage.kind).includes('secret') || String(storage.kind).includes('encrypted'),
    export_supported: storage.exportSupported !== false,
    deletion_supported: storage.deletionSupported !== false,
    status: input.status === 'removed' ? 'released' : input.status === 'registered' || input.status === 'disabled' ? 'allocated' : input.status,
    declaration: jsonb(storage),
    created_at: now,
    updated_at: now,
  }))
  if (rows.length) await db.insertInto('greenfield_module_storage_allocations').values(rows as any).execute()
}

async function insertJobs(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows = versionedItems(manifest.jobRegistry).map(job => ({
    job_registration_id: `module-job:${input.installationId}:${String(job.id)}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    job_key: String(job.id),
    job_kind: normalJobKind(String(job.kind ?? 'one-off')),
    function_id: stringOrNull(job.functionId),
    schedule: stringOrNull(job.schedule),
    retry_policy: jsonb(asRecord(job.retryPolicy)),
    paused: input.jobsPaused,
    status: input.jobsPaused ? 'paused' : input.status,
    declaration: jsonb(job),
    created_at: now,
    updated_at: now,
  }))
  if (rows.length) await db.insertInto('greenfield_module_job_registrations').values(rows as any).execute()
}

async function insertUiContributions(db: ModulaWorkerDb, input: RuntimeInput, manifest: Record<string, unknown>, now: Date) {
  const rows: any[] = []
  for (const widget of versionedItems(manifest.widgetRegistry)) {
    rows.push(uiRow(input, now, String(widget.id), 'widget', widget))
  }
  for (const navigation of versionedItems(manifest.navigationRegistry)) {
    rows.push(uiRow(input, now, String(navigation.id), surfaceForNavigation(navigation), navigation))
  }
  for (const contribution of versionedItems(manifest.uiContributions)) {
    rows.push(uiRow(input, now, String(contribution.id), surfaceForUi(contribution), contribution))
  }
  if (rows.length) await db.insertInto('greenfield_module_ui_contribution_registrations').values(rows).execute()
}

function uiRow(input: RuntimeInput, now: Date, key: string, surface: string, declaration: Record<string, unknown>) {
  return {
    ui_registration_id: `module-ui:${input.installationId}:${surface}:${key}`,
    installation_id: input.installationId,
    account_id: input.accountId,
    release_id: input.releaseId,
    module_id: input.moduleId,
    contribution_key: key,
    surface,
    status: input.status,
    declaration: jsonb(declaration),
    created_at: now,
    updated_at: now,
  }
}

async function recordLifecycleTransaction(
  db: ModulaWorkerDb,
  input: {
    installationId: string
    accountId: string
    moduleId: string
    releaseId: string | null
    status: RuntimeStatus
    action?: string
  },
  stages: string[],
  now: Date,
) {
  const action = input.action ?? (input.status === 'registered' ? 'enable' : input.status === 'removed' ? 'uninstall' : 'disable')
  const transactionId = `module-runtime-lifecycle:${input.installationId}:${action}:${now.getTime()}`
  await db
    .insertInto('greenfield_module_lifecycle_transactions')
    .values({
      transaction_id: transactionId,
      installation_id: input.installationId,
      account_id: input.accountId,
      release_id: input.releaseId,
      module_id: input.moduleId,
      action,
      status: 'completed',
      idempotency_key: null,
      rollback_policy: 'preserve-data',
      data_retention_choice: null,
      metadata: jsonb({runtimeStatus: input.status}),
      started_at: now,
      completed_at: now,
      created_at: now,
      updated_at: now,
    } as any)
    .execute()
  await db
    .insertInto('greenfield_module_lifecycle_stages')
    .values(stages.map((stage, index) => ({
      stage_id: `module-runtime-lifecycle-stage:${transactionId}:${index}`,
      transaction_id: transactionId,
      stage,
      order_index: index,
      status: 'completed',
      failure_code: null,
      metadata: jsonb({deterministicOrder: index}),
      started_at: now,
      completed_at: now,
      created_at: now,
    } as any)))
    .execute()
}

type RuntimeInput = {
  installationId: string
  accountId: string
  moduleId: string
  releaseId: string
  status: RuntimeStatus
  jobsPaused: boolean
}

function lifecycleStagesFor(status: RuntimeStatus): string[] {
  if (status === 'registered') return ['before-hooks', 'permissions', 'storage', 'services', 'apis', 'jobs', 'ui', 'after-hooks']
  if (status === 'removed') return ['before-hooks', 'pause-jobs', 'unregister-services', 'unregister-ui', 'data-retention', 'after-hooks']
  return ['before-hooks', 'pause-jobs', 'disable-services', 'disable-ui', 'after-hooks']
}

function versionedItems(value: unknown): Record<string, unknown>[] {
  const record = asRecord(value)
  return arrayOfRecords(record.items)
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : []
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function quotaBytes(value: unknown): number | null {
  const record = asRecord(value)
  const parsed = Number(record.bytes ?? record.maxBytes)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function capabilityNameFromFlag(flag: string): string {
  return flag
    .replace(/^supports/, '')
    .replace(/[A-Z]/g, (match, index) => `${index === 0 ? '' : '-'}${match.toLowerCase()}`)
}

function runtimeStorageKind(kind: string): string {
  if (kind === 'structured-records') return 'records'
  if (kind === 'blob-storage' || kind === 'object-storage') return 'object-storage'
  if (kind === 'temporary-storage') return 'temporary'
  if (kind === 'encrypted-storage' || kind === 'secrets') return 'secrets'
  if (kind === 'search-index' || kind === 'ai-memory') return 'cache'
  if (kind === 'settings' || kind === 'cache' || kind === 'attachments' || kind === 'history') return kind
  return 'records'
}

function normalJobKind(kind: string): string {
  if (kind === 'health') return 'health-check'
  if (kind === 'cron') return 'recurring'
  if (kind === 'queue') return 'one-off'
  return kind
}

function surfaceForNavigation(item: Record<string, unknown>): string {
  if (item.kind === 'composer-tool') return 'composer-tools'
  if (item.kind === 'context-menu' || item.kind === 'menu-item') return 'context-menu'
  if (item.kind === 'search-provider') return 'search-provider'
  if (item.kind === 'route' || item.kind === 'tab' || item.kind === 'quick-action') return 'module-route'
  return 'settings'
}

function surfaceForUi(item: Record<string, unknown>): string {
  if (item.kind === 'board-card') return 'board'
  if (item.kind === 'profile-tab') return 'profile-tabs'
  if (item.kind === 'settings-section') return 'settings'
  if (item.kind === 'composer-action') return 'composer-tools'
  if (item.kind === 'context-menu') return 'context-menu'
  if (item.kind === 'search-provider') return 'search-provider'
  return 'widget'
}
