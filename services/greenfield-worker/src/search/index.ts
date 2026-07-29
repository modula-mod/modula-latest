import type {GreenfieldDomainEvent} from '@modula/greenfield-contracts'
import {sql} from 'kysely'
import type {GreenfieldSearchEntityType, ModulaWorkerDb} from '../database.js'
import {PermanentJobError} from '../jobs/errors.js'
import {projectModuleRelease} from './module-release-projector.js'
import {projectModule} from './module-projector.js'
import {projectPost} from './post-projector.js'
import {projectProfile} from './profile-projector.js'
import {entityIdFromEvent, SearchProjector, type SearchProjectionContext} from './projector.js'
import {isSearchOperationalEvent, SEARCH_PROJECTOR_BY_EVENT} from './subscribers.js'
import {projectVaultNotesRecord} from './vault-notes-projector.js'

export async function handleSearchIndex(db: ModulaWorkerDb, rawPayload: unknown): Promise<void> {
  const payload = normalizePayload(rawPayload)
  if (isSearchOperationalEvent(payload.event.eventType)) return
  const mapping = SEARCH_PROJECTOR_BY_EVENT[payload.event.eventType] ?? fallbackMapping(payload)
  const projectorId = payload.projectorId ?? mapping.projectorId
  const context: SearchProjectionContext = {
    projectorId,
    event: payload.event,
    entityType: mapping.entityType,
    entityId: entityIdFromEvent(payload.event, payload.event.aggregateId),
  }
  const projector = new SearchProjector(db)
  try {
    if (mapping.entityType === 'post') await projectPost(db, projector, context)
    else if (mapping.entityType === 'profile') await projectProfile(db, projector, context)
    else if (mapping.entityType === 'module') await projectModule(db, projector, context)
    else if (mapping.entityType === 'module-release') await projectModuleRelease(db, projector, context)
    else await projectVaultNotesRecord(db, projector, context)
    await projector.recordSuccess(context)
  } catch (error) {
    await projector.recordFailure(context, error)
    throw error
  }
}

export async function handleSearchReindex(db: ModulaWorkerDb, rawPayload: unknown): Promise<void> {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload as Record<string, any> : {}
  const reindexId = typeof payload.reindexId === 'string' ? payload.reindexId : ''
  if (!reindexId) throw new PermanentJobError('VALIDATION_FAILED', 'search.reindex payload requires reindexId')
  const request = await db.selectFrom('search_reindex_requests').selectAll().where('reindex_id', '=', reindexId).executeTakeFirst()
  if (!request) throw new PermanentJobError('VALIDATION_FAILED', 'Search reindex request not found')
  if (request.cancellation_requested_at) {
    await db.updateTable('search_reindex_requests').set({state: 'cancelled', updated_at: new Date(), completed_at: new Date()}).where('reindex_id', '=', reindexId).execute()
    return
  }
  const now = new Date()
  await db.updateTable('search_reindex_requests').set({state: 'running', updated_at: now}).where('reindex_id', '=', reindexId).execute()
  const event = await ensureReindexEvent(db, request, now)
  const candidates = await reindexCandidates(db, request)
  if (!request.dry_run) {
    for (const candidate of candidates) {
      if (await cancellationRequested(db, reindexId)) {
        await db.updateTable('search_reindex_requests').set({state: 'cancelled', updated_at: new Date(), completed_at: new Date()}).where('reindex_id', '=', reindexId).execute()
        return
      }
      await handleSearchIndex(db, {
        event: syntheticReindexEvent(event, request, candidate, now),
        projectorId: projectorIdFor(candidate.entityType),
      })
    }
  }
  const completedAt = new Date()
  await db
    .updateTable('search_reindex_requests')
    .set({state: 'completed', processed_count: candidates.length, updated_at: completedAt, completed_at: completedAt})
    .where('reindex_id', '=', reindexId)
    .execute()
  await db
    .insertInto('greenfield_domain_events')
    .values({
      event_id: `event-search-reindex-completed-${reindexId}`,
      event_type: 'search.reindex-completed',
      event_version: '1.0.0',
      aggregate_type: 'searchReindex',
      aggregate_id: reindexId,
      aggregate_version: null,
      account_id: request.account_id,
      actor_id: request.requested_by_actor_id,
      request_id: request.request_id,
      correlation_id: request.correlation_id,
      causation_id: event.event_id,
      idempotency_key: `search.reindex-completed:${reindexId}`,
      visibility: 'internal',
      classification: 'internal',
      payload: {reindexId, processedCount: candidates.length, dryRun: request.dry_run},
      metadata: {source: 'greenfield.search.reindex'},
      occurred_at: completedAt,
      recorded_at: completedAt,
    })
    .onConflict(oc => oc.column('event_id').doNothing())
    .execute()
}

function normalizePayload(rawPayload: unknown): {event: GreenfieldDomainEvent<Record<string, unknown>>; projectorId?: string} {
  if (!rawPayload || typeof rawPayload !== 'object' || Array.isArray(rawPayload)) {
    throw new PermanentJobError('VALIDATION_FAILED', 'search.index payload must be an object')
  }
  const raw = rawPayload as Record<string, any>
  if (raw.event && typeof raw.event === 'object') return {event: raw.event, projectorId: raw.projectorId}
  const resourceType = typeof raw.resourceType === 'string' ? raw.resourceType : 'post'
  const resourceId = typeof raw.resourceId === 'string' ? raw.resourceId : 'unknown'
  const eventType = typeof raw.eventType === 'string' ? raw.eventType : `search.index.${resourceType}`
  const now = new Date().toISOString()
  return {
    event: {
      eventId: typeof raw.eventId === 'string' ? raw.eventId : `legacy-search-${resourceType}-${resourceId}`,
      eventType,
      eventVersion: '1.0.0',
      aggregateType: resourceType,
      aggregateId: resourceId,
      aggregateVersion: typeof raw.sourceVersion === 'number' ? raw.sourceVersion : undefined,
      accountId: typeof raw.accountId === 'string' ? raw.accountId : undefined,
      actorId: typeof raw.actorId === 'string' ? raw.actorId : undefined,
      requestId: typeof raw.requestId === 'string' ? raw.requestId : `req-${resourceId}`,
      correlationId: typeof raw.correlationId === 'string' ? raw.correlationId : `corr-${resourceId}`,
      occurredAt: now,
      recordedAt: now,
      visibility: 'internal',
      classification: 'internal',
      payload: raw,
      metadata: {source: 'legacy-search-job'},
    },
  }
}

function fallbackMapping(payload: {event: GreenfieldDomainEvent<Record<string, unknown>>}) {
  if (payload.event.aggregateType === 'profile' || payload.event.eventType.endsWith('.profile')) {
    return {projectorId: 'search.profile-projector', entityType: 'profile' as const}
  }
  if (payload.event.aggregateType === 'moduleRelease' || payload.event.aggregateType === 'module-release') {
    return {projectorId: 'search.module-release-projector', entityType: 'module-release' as const}
  }
  if (payload.event.aggregateType === 'module') {
    return {projectorId: 'search.module-projector', entityType: 'module' as const}
  }
  return {projectorId: 'search.post-projector', entityType: 'post' as const}
}

type ReindexCandidate = {entityType: GreenfieldSearchEntityType; entityId: string}

async function reindexCandidates(db: ModulaWorkerDb, request: {mode: string; entity_type: GreenfieldSearchEntityType | null; entity_id: string | null; account_id: string | null}): Promise<ReindexCandidate[]> {
  if (request.mode === 'single-entity') {
    if (!request.entity_type || !request.entity_id) throw new PermanentJobError('VALIDATION_FAILED', 'single-entity reindex requires entity type and id')
    return [{entityType: request.entity_type, entityId: request.entity_id}]
  }
  if (request.mode === 'entity-type') {
    if (!request.entity_type) throw new PermanentJobError('VALIDATION_FAILED', 'entity-type reindex requires entity type')
    return idsForEntityType(db, request.entity_type)
  }
  if (request.mode === 'account-scope') {
    if (!request.account_id) throw new PermanentJobError('VALIDATION_FAILED', 'account-scope reindex requires account id')
    const rows = await sql<{entity_type: GreenfieldSearchEntityType; entity_id: string}>`
      SELECT 'post'::text AS entity_type, posts.id AS entity_id
      FROM posts
      INNER JOIN actors ON actors.id = posts.author_actor_id
      WHERE actors.account_id = ${request.account_id}
      UNION ALL
      SELECT 'profile'::text AS entity_type, profiles.id AS entity_id
      FROM profiles
      INNER JOIN actors ON actors.id = profiles.actor_id
      WHERE actors.account_id = ${request.account_id}
      UNION ALL
      SELECT 'note'::text AS entity_type, record_id AS entity_id
      FROM greenfield_module_records
      WHERE account_id = ${request.account_id}
        AND module_id = 'modula.vault-notes'
        AND collection = 'note'
      UNION ALL
      SELECT 'vault-folder'::text AS entity_type, record_id AS entity_id
      FROM greenfield_module_records
      WHERE account_id = ${request.account_id}
        AND module_id = 'modula.vault-notes'
        AND collection = 'folder'
      LIMIT 100
    `.execute(db)
    return rows.rows.map(row => ({entityType: row.entity_type, entityId: row.entity_id}))
  }
  const rows = await sql<{entity_type: GreenfieldSearchEntityType; entity_id: string}>`
    SELECT 'post'::text AS entity_type, id AS entity_id FROM posts
    UNION ALL SELECT 'profile'::text AS entity_type, id AS entity_id FROM profiles
    UNION ALL SELECT 'module'::text AS entity_type, slug AS entity_id FROM greenfield_extension_catalogue WHERE kind = 'module'
    UNION ALL SELECT 'module-release'::text AS entity_type, release_id AS entity_id FROM greenfield_module_releases
    UNION ALL SELECT 'note'::text AS entity_type, record_id AS entity_id FROM greenfield_module_records WHERE module_id = 'modula.vault-notes' AND collection = 'note'
    UNION ALL SELECT 'vault-folder'::text AS entity_type, record_id AS entity_id FROM greenfield_module_records WHERE module_id = 'modula.vault-notes' AND collection = 'folder'
    LIMIT 100
  `.execute(db)
  return rows.rows.map(row => ({entityType: row.entity_type, entityId: row.entity_id}))
}

async function idsForEntityType(db: ModulaWorkerDb, entityType: GreenfieldSearchEntityType): Promise<ReindexCandidate[]> {
  if (entityType === 'post') {
    return (await db.selectFrom('posts').select('id').limit(100).execute()).map(row => ({entityType, entityId: row.id}))
  }
  if (entityType === 'profile') {
    return (await db.selectFrom('profiles').select('id').limit(100).execute()).map(row => ({entityType, entityId: row.id}))
  }
  if (entityType === 'module') {
    return (await db.selectFrom('greenfield_extension_catalogue').select('slug').where('kind', '=', 'module').limit(100).execute()).map(row => ({entityType, entityId: row.slug}))
  }
  if (entityType === 'note') {
    return (await db.selectFrom('greenfield_module_records').select('record_id').where('module_id', '=', 'modula.vault-notes').where('collection', '=', 'note').limit(100).execute()).map(row => ({entityType, entityId: row.record_id}))
  }
  if (entityType === 'vault-folder') {
    return (await db.selectFrom('greenfield_module_records').select('record_id').where('module_id', '=', 'modula.vault-notes').where('collection', '=', 'folder').limit(100).execute()).map(row => ({entityType, entityId: row.record_id}))
  }
  return (await db.selectFrom('greenfield_module_releases').select('release_id').limit(100).execute()).map(row => ({entityType, entityId: row.release_id}))
}

function syntheticReindexEvent(
  row: {event_id: string},
  request: {reindex_id: string; account_id: string | null; requested_by_actor_id: string | null; request_id: string; correlation_id: string},
  candidate: ReindexCandidate,
  now: Date,
): GreenfieldDomainEvent<Record<string, unknown>> {
  const eventType = candidate.entityType === 'post'
    ? 'post.updated'
    : candidate.entityType === 'profile'
      ? 'profile.updated'
      : candidate.entityType === 'module'
        ? 'module.discovered'
        : candidate.entityType === 'module-release'
          ? 'module.release.published'
          : candidate.entityType === 'note'
            ? 'vault-notes.note.updated'
            : 'vault-notes.folder.updated'
  return {
    eventId: row.event_id,
    eventType,
    eventVersion: '1.0.0',
    aggregateType: candidate.entityType === 'module-release' ? 'moduleRelease' : candidate.entityType,
    aggregateId: candidate.entityId,
    aggregateVersion: now.getTime(),
    accountId: request.account_id ?? undefined,
    actorId: request.requested_by_actor_id ?? undefined,
    requestId: request.request_id,
    correlationId: request.correlation_id,
    occurredAt: now.toISOString(),
    recordedAt: now.toISOString(),
    visibility: 'internal',
    classification: 'internal',
    payload: {entityId: candidate.entityId, sourceVersion: now.getTime()},
    metadata: {source: 'greenfield.search.reindex', reindexId: request.reindex_id},
  }
}

async function ensureReindexEvent(db: ModulaWorkerDb, request: {reindex_id: string; account_id: string | null; requested_by_actor_id: string | null; request_id: string; correlation_id: string; mode: string; entity_type: GreenfieldSearchEntityType | null; dry_run: boolean}, now: Date): Promise<{event_id: string}> {
  const existing = await db
    .selectFrom('greenfield_domain_events')
    .select('event_id')
    .where('event_type', '=', 'search.reindex-requested')
    .where('aggregate_id', '=', request.reindex_id)
    .orderBy('recorded_at', 'desc')
    .executeTakeFirst()
  if (existing) return existing
  const eventId = `event-search-reindex-requested-${request.reindex_id}`
  await db
    .insertInto('greenfield_domain_events')
    .values({
      event_id: eventId,
      event_type: 'search.reindex-requested',
      event_version: '1.0.0',
      aggregate_type: 'searchReindex',
      aggregate_id: request.reindex_id,
      aggregate_version: null,
      account_id: request.account_id,
      actor_id: request.requested_by_actor_id,
      request_id: request.request_id,
      correlation_id: request.correlation_id,
      causation_id: null,
      idempotency_key: `search.reindex-requested:${request.reindex_id}`,
      visibility: 'internal',
      classification: 'internal',
      payload: {reindexId: request.reindex_id, mode: request.mode, entityType: request.entity_type, dryRun: request.dry_run},
      metadata: {source: 'greenfield.search.reindex'},
      occurred_at: now,
      recorded_at: now,
    })
    .onConflict(oc => oc.column('event_id').doNothing())
    .execute()
  return {event_id: eventId}
}

function projectorIdFor(entityType: GreenfieldSearchEntityType): string {
  if (entityType === 'post') return 'search.post-projector'
  if (entityType === 'profile') return 'search.profile-projector'
  if (entityType === 'module') return 'search.module-projector'
  if (entityType === 'module-release') return 'search.module-release-projector'
  return 'search.vault-notes-projector'
}

async function cancellationRequested(db: ModulaWorkerDb, reindexId: string): Promise<boolean> {
  const row = await db.selectFrom('search_reindex_requests').select('cancellation_requested_at').where('reindex_id', '=', reindexId).executeTakeFirst()
  return Boolean(row?.cancellation_requested_at)
}
