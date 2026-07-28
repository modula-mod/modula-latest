import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {
  GreenfieldRuntimeReasonCode,
  GreenfieldRuntimeResolutionResult,
  GreenfieldRuntimeSession,
  GreenfieldRuntimeSessionState,
} from '@modula/greenfield-module-engine-contracts'
import type {
  GreenfieldRuntimeSessionPatch,
  GreenfieldRuntimeSessionStore,
} from '@modula/greenfield-runtime'
import type {ModulaDb} from '../database/client.js'
import type {Database} from '../database/types.js'

type RuntimeSessionRow = Database['greenfield_runtime_sessions']

const FORBIDDEN_PERSISTED_REFERENCE_KEYS = new Set([
  'providerHandle',
  'implementationRef',
  'adapterRef',
  'functionPointer',
])

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export class GreenfieldRuntimeSessionRepository implements GreenfieldRuntimeSessionStore {
  constructor(private readonly db: ModulaDb) {}

  async create(session: GreenfieldRuntimeSession): Promise<GreenfieldRuntimeSession> {
    assertPersistableSession(session)
    await this.db
      .insertInto('greenfield_runtime_sessions')
      .values({
        session_id: session.sessionId,
        session_kind: session.sessionKind,
        account_id: session.accountId,
        module_id: session.moduleId ?? null,
        installation_id: session.installationId ?? null,
        release_id: session.releaseId ?? null,
        provider_ids: jsonb(session.providerIds),
        state: session.state,
        compatibility: session.resolution?.compatibility ?? null,
        launch_permission: session.resolution?.launchPermission ?? null,
        resolution: jsonb(session.resolution ?? {}),
        reason_codes: jsonb(session.reasonCodes),
        metadata: jsonb(session.metadata),
        failure_code: session.failureCode ?? null,
        failure_message: session.failureMessage ?? null,
        created_at: new Date(session.createdAt),
        updated_at: new Date(session.updatedAt),
        started_at: session.startedAt ? new Date(session.startedAt) : null,
        terminated_at: session.terminatedAt ? new Date(session.terminatedAt) : null,
      })
      .execute()
    await this.appendEvent(session.sessionId, session.accountId, {
      eventType: 'runtime.session.created',
      toState: session.state,
      reasonCodes: session.reasonCodes,
      metadata: {},
    })
    return this.requireSession(session.sessionId)
  }

  async get(sessionId: string): Promise<GreenfieldRuntimeSession | null> {
    const row = await this.db
      .selectFrom('greenfield_runtime_sessions')
      .selectAll()
      .where('session_id', '=', sessionId)
      .executeTakeFirst()
    return row ? mapSession(row) : null
  }

  async listForAccount(accountId: string): Promise<GreenfieldRuntimeSession[]> {
    const rows = await this.db
      .selectFrom('greenfield_runtime_sessions')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('updated_at', 'desc')
      .execute()
    return rows.map(mapSession)
  }

  async update(sessionId: string, patch: GreenfieldRuntimeSessionPatch & {updatedAt: string}): Promise<GreenfieldRuntimeSession> {
    assertPersistablePatch(patch)
    const current = await this.requireSession(sessionId)
    const reasonCodes = mergeReasonCodes(current.reasonCodes, patch.reasonCodes)
    const metadata = {...current.metadata, ...patch.metadata}
    const resolution = patch.resolution ?? current.resolution
    const state = patch.state ?? current.state
    const updates: Partial<RuntimeSessionRow> & Record<string, unknown> = {
      updated_at: new Date(patch.updatedAt),
      reason_codes: jsonb(reasonCodes),
      metadata: jsonb(metadata),
    }
    if (patch.providerIds) updates.provider_ids = jsonb(patch.providerIds)
    if (patch.state) updates.state = patch.state
    if (patch.resolution) {
      updates.resolution = jsonb(patch.resolution)
      updates.compatibility = patch.resolution.compatibility
      updates.launch_permission = patch.resolution.launchPermission
    }
    if (patch.startedAt) updates.started_at = new Date(patch.startedAt)
    if (patch.terminatedAt) updates.terminated_at = new Date(patch.terminatedAt)
    if (patch.failureCode) updates.failure_code = patch.failureCode
    if (patch.failureMessage) updates.failure_message = patch.failureMessage

    await this.db
      .updateTable('greenfield_runtime_sessions')
      .set(updates)
      .where('session_id', '=', sessionId)
      .executeTakeFirstOrThrow()

    if (patch.state || patch.reasonCodes || patch.resolution) {
      await this.appendEvent(sessionId, current.accountId, {
        eventType: eventTypeForPatch(patch),
        fromState: current.state,
        toState: state,
        reasonCodes,
        metadata: resolution
          ? {
              compatibility: resolution.compatibility,
              launchPermission: resolution.launchPermission,
            }
          : {},
      })
    }
    return this.requireSession(sessionId)
  }

  private async requireSession(sessionId: string): Promise<GreenfieldRuntimeSession> {
    const session = await this.get(sessionId)
    if (!session) throw new Error(`Runtime session not found: ${sessionId}`)
    return session
  }

  private async appendEvent(
    sessionId: string,
    accountId: string,
    input: {
      eventType: string
      fromState?: GreenfieldRuntimeSessionState
      toState?: GreenfieldRuntimeSessionState
      reasonCodes: GreenfieldRuntimeReasonCode[]
      metadata: Record<string, string | number | boolean | null>
    },
  ): Promise<void> {
    await this.db
      .insertInto('greenfield_runtime_session_events')
      .values({
        event_id: `runtime-event-${randomUUID()}`,
        session_id: sessionId,
        account_id: accountId,
        event_type: input.eventType,
        from_state: input.fromState ?? null,
        to_state: input.toState ?? null,
        reason_codes: jsonb(input.reasonCodes),
        metadata: jsonb(input.metadata),
        created_at: new Date(),
      })
      .execute()
  }
}

function mapSession(row: RuntimeSessionRow): GreenfieldRuntimeSession {
  const resolution = objectOrEmpty(row.resolution)
  return {
    sessionId: row.session_id,
    sessionKind: row.session_kind,
    accountId: row.account_id,
    moduleId: row.module_id ?? undefined,
    installationId: row.installation_id ?? undefined,
    releaseId: row.release_id ?? undefined,
    providerIds: arrayOfStrings(row.provider_ids),
    state: row.state,
    resolution: Object.keys(resolution).length ? resolution as GreenfieldRuntimeResolutionResult : undefined,
    reasonCodes: arrayOfStrings(row.reason_codes) as GreenfieldRuntimeReasonCode[],
    metadata: scalarMetadata(row.metadata),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    startedAt: row.started_at?.toISOString(),
    terminatedAt: row.terminated_at?.toISOString(),
    failureCode: row.failure_code as GreenfieldRuntimeReasonCode | undefined,
    failureMessage: row.failure_message ?? undefined,
  }
}

function eventTypeForPatch(patch: GreenfieldRuntimeSessionPatch): string {
  if (patch.state === 'failed') return 'runtime.session.failed'
  if (patch.state === 'active') return 'runtime.session.started'
  if (patch.state === 'terminated') return 'runtime.session.terminated'
  if (patch.resolution) return 'runtime.session.resolved'
  return 'runtime.session.transitioned'
}

function mergeReasonCodes(
  current: GreenfieldRuntimeReasonCode[],
  incoming?: GreenfieldRuntimeReasonCode[],
): GreenfieldRuntimeReasonCode[] {
  if (!incoming) return current
  return [...new Set([...current, ...incoming])]
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function objectOrEmpty(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function scalarMetadata(value: unknown): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(objectOrEmpty(value))
      .filter((entry): entry is [string, string | number | boolean | null] => {
        const item = entry[1]
        return item === null || ['string', 'number', 'boolean'].includes(typeof item)
      }),
  )
}

function assertPersistableSession(session: GreenfieldRuntimeSession): void {
  assertNoPersistedImplementationReferences(session.metadata)
  assertNoPersistedImplementationReferences(session.resolution ?? {})
}

function assertPersistablePatch(patch: GreenfieldRuntimeSessionPatch): void {
  assertNoPersistedImplementationReferences(patch.metadata ?? {})
  assertNoPersistedImplementationReferences(patch.resolution ?? {})
}

function assertNoPersistedImplementationReferences(value: unknown, path: string[] = []): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPersistedImplementationReferences(item, [...path, String(index)]))
    return
  }
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PERSISTED_REFERENCE_KEYS.has(key)) {
      throw new Error(`Runtime session persistence rejected provider implementation reference: ${[...path, key].join('.')}`)
    }
    assertNoPersistedImplementationReferences(nested, [...path, key])
  }
}
