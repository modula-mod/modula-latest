import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {GreenfieldDomainEvent, GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {GreenfieldSearchEntityType, ModulaWorkerDb} from '../database.js'

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type SearchProjectionContext = {
  projectorId: string
  event: GreenfieldDomainEvent<Record<string, unknown>>
  entityType: GreenfieldSearchEntityType
  entityId: string
}

export class SearchProjector {
  constructor(private readonly db: ModulaWorkerDb) {}

  async upsert(context: SearchProjectionContext, document: GreenfieldSearchDocument): Promise<'applied' | 'idempotent' | 'stale'> {
    const existing = await this.db
      .selectFrom('search_documents')
      .select(['document_id', 'source_version'])
      .where('entity_type', '=', document.entityType)
      .where('entity_id', '=', document.entityId)
      .executeTakeFirst()
    if (existing && Number(existing.source_version) > document.sourceVersion) return 'stale'

    const result = await sql<{document_id: string}>`
      INSERT INTO search_documents (
        document_id,
        schema_version,
        entity_type,
        entity_id,
        source_version,
        account_id,
        owner_id,
        title,
        body,
        summary,
        keywords,
        tags,
        visibility,
        status,
        language,
        metadata,
        created_at,
        updated_at,
        indexed_at,
        search_vector
      )
      VALUES (
        ${document.documentId},
        ${document.schemaVersion},
        ${document.entityType},
        ${document.entityId},
        ${document.sourceVersion},
        ${document.accountId ?? null},
        ${document.ownerId ?? null},
        ${document.title ?? null},
        ${document.body ?? null},
        ${document.summary ?? null},
        ${document.keywords},
        ${document.tags},
        ${document.visibility},
        ${document.status},
        ${document.language ?? null},
        ${jsonb(document.metadata)},
        ${new Date(document.createdAt)},
        ${new Date(document.updatedAt)},
        ${new Date(document.indexedAt)},
        ${searchVector(document)}
      )
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        document_id = EXCLUDED.document_id,
        schema_version = EXCLUDED.schema_version,
        source_version = EXCLUDED.source_version,
        account_id = EXCLUDED.account_id,
        owner_id = EXCLUDED.owner_id,
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        summary = EXCLUDED.summary,
        keywords = EXCLUDED.keywords,
        tags = EXCLUDED.tags,
        visibility = EXCLUDED.visibility,
        status = EXCLUDED.status,
        language = EXCLUDED.language,
        metadata = EXCLUDED.metadata,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        indexed_at = EXCLUDED.indexed_at,
        search_vector = EXCLUDED.search_vector
      WHERE search_documents.source_version <= EXCLUDED.source_version
      RETURNING document_id
    `.execute(this.db)
    if (result.rows.length === 0) return 'stale'
    const status = existing?.source_version === document.sourceVersion ? 'idempotent' : 'applied'
    if (status === 'applied') {
      await this.emitOperationalEvent('search.document-indexed', document.documentId, context, {
        documentId: document.documentId,
        entityType: document.entityType,
        entityId: document.entityId,
        sourceVersion: document.sourceVersion,
      })
    }
    return status
  }

  async tombstone(
    context: SearchProjectionContext,
    input: {
      sourceVersion: number
      accountId?: string | null
      ownerId?: string | null
      visibility?: GreenfieldSearchDocument['visibility']
      status?: GreenfieldSearchDocument['status']
      updatedAt?: Date
    },
  ): Promise<'applied' | 'idempotent' | 'stale'> {
    const now = new Date()
    const status = await this.upsert(context, {
      documentId: `${context.entityType}:${context.entityId}`,
      schemaVersion: '1.0.0',
      entityType: context.entityType,
      entityId: context.entityId,
      sourceVersion: input.sourceVersion,
      accountId: input.accountId ?? undefined,
      ownerId: input.ownerId ?? undefined,
      keywords: [],
      tags: [],
      visibility: input.visibility ?? 'private',
      status: input.status ?? 'deleted',
      createdAt: (input.updatedAt ?? now).toISOString(),
      updatedAt: (input.updatedAt ?? now).toISOString(),
      indexedAt: now.toISOString(),
      metadata: {tombstone: true},
    })
    if (status === 'applied') {
      await this.emitOperationalEvent('search.document-deleted', `${context.entityType}:${context.entityId}`, context, {
        entityType: context.entityType,
        entityId: context.entityId,
        sourceVersion: input.sourceVersion,
      })
    }
    return status
  }

  async recordSuccess(context: SearchProjectionContext): Promise<void> {
    const now = new Date()
    const lagSeconds = Math.max(0, Math.floor((now.getTime() - new Date(context.event.recordedAt).getTime()) / 1000))
    await this.db
      .insertInto('search_projection_state')
      .values({
        projector_id: context.projectorId,
        entity_type: context.entityType,
        last_event_id: context.event.eventId,
        last_processed_at: now,
        last_success_at: now,
        last_failure_at: null,
        last_failure_code: null,
        processed_count: 1,
        failed_count: 0,
        lag_seconds: lagSeconds,
      })
      .onConflict(oc => oc.column('projector_id').doUpdateSet(eb => ({
        entity_type: context.entityType,
        last_event_id: context.event.eventId,
        last_processed_at: now,
        last_success_at: now,
        last_failure_code: null,
        processed_count: eb('search_projection_state.processed_count', '+', 1),
        lag_seconds: lagSeconds,
      })))
      .execute()
    await this.db
      .updateTable('search_projection_failures')
      .set({resolved_at: now})
      .where('projector_id', '=', context.projectorId)
      .where('event_id', '=', context.event.eventId)
      .where('resolved_at', 'is', null)
      .execute()
  }

  async recordFailure(context: SearchProjectionContext, error: unknown): Promise<void> {
    const now = new Date()
    const code = failureCode(error)
    await this.db
      .insertInto('search_projection_state')
      .values({
        projector_id: context.projectorId,
        entity_type: context.entityType,
        last_event_id: context.event.eventId,
        last_processed_at: now,
        last_success_at: null,
        last_failure_at: now,
        last_failure_code: code,
        processed_count: 0,
        failed_count: 1,
        lag_seconds: Math.max(0, Math.floor((now.getTime() - new Date(context.event.recordedAt).getTime()) / 1000)),
      })
      .onConflict(oc => oc.column('projector_id').doUpdateSet(eb => ({
        entity_type: context.entityType,
        last_event_id: context.event.eventId,
        last_processed_at: now,
        last_failure_at: now,
        last_failure_code: code,
        failed_count: eb('search_projection_state.failed_count', '+', 1),
      })))
      .execute()
    await this.db
      .insertInto('search_projection_failures')
      .values({
        failure_id: `search-failure-${randomUUID()}`,
        projector_id: context.projectorId,
        event_id: context.event.eventId,
        entity_type: context.entityType,
        entity_id: context.entityId,
        failure_code: code,
        attempt_count: 1,
        first_failed_at: now,
        last_failed_at: now,
        resolved_at: null,
        sanitised_details: jsonb({
          message: failureMessage(error),
          eventType: context.event.eventType,
          aggregateType: context.event.aggregateType,
        }),
      })
      .onConflict(oc => oc.columns(['projector_id', 'event_id']).doUpdateSet(eb => ({
        failure_code: code,
        attempt_count: eb('search_projection_failures.attempt_count', '+', 1),
        last_failed_at: now,
        resolved_at: null,
        sanitised_details: jsonb({
          message: failureMessage(error),
          eventType: context.event.eventType,
          aggregateType: context.event.aggregateType,
        }),
      })))
      .execute()
    await this.emitOperationalEvent('search.projection-failed', context.event.eventId, context, {
      entityType: context.entityType,
      entityId: context.entityId,
      failureCode: code,
    })
  }

  sourceVersionFor(context: SearchProjectionContext, fallback: number): number {
    const fromPayload = context.event.payload?.sourceVersion
    if (typeof context.event.aggregateVersion === 'number') return context.event.aggregateVersion
    if (typeof fromPayload === 'number' && Number.isSafeInteger(fromPayload) && fromPayload >= 0) return fromPayload
    return fallback
  }

  private async emitOperationalEvent(
    eventType: string,
    aggregateId: string,
    context: SearchProjectionContext,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const now = new Date()
    await this.db
      .insertInto('greenfield_domain_events')
      .values({
        event_id: `event-search-${randomUUID()}`,
        event_type: eventType,
        event_version: '1.0.0',
        aggregate_type: eventType.includes('failed') ? 'searchProjectionFailure' : 'searchDocument',
        aggregate_id: aggregateId,
        aggregate_version: null,
        account_id: context.event.accountId ?? null,
        actor_id: context.event.actorId ?? null,
        request_id: context.event.requestId,
        correlation_id: context.event.correlationId,
        causation_id: context.event.eventId,
        idempotency_key: null,
        visibility: 'internal',
        classification: 'internal',
        payload,
        metadata: {source: 'greenfield.search.projector'},
        occurred_at: now,
        recorded_at: now,
      })
      .execute()
  }
}

export function entityIdFromEvent(event: GreenfieldDomainEvent<Record<string, unknown>>, fallback: string): string {
  const payload = event.payload ?? {}
  for (const key of ['entityId', 'postId', 'profileId', 'moduleId', 'releaseId']) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function searchVector(document: GreenfieldSearchDocument) {
  return sql<unknown>`
    setweight(to_tsvector('english', coalesce(${document.title ?? ''}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${document.summary ?? ''}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${document.body ?? ''}, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(${document.keywords.join(' ')}, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(${document.tags.join(' ')}, '')), 'A')
  `
}

function failureCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string') {
    return (error as any).code.replace(/[^A-Z0-9_.:-]/gi, '_').slice(0, 120)
  }
  return 'SEARCH_PROJECTION_FAILED'
}

function failureMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/(body|text|content|note|prompt)[=:\s]+[^\s,;}]+/gi, '$1=[redacted]')
    .replace(/(access|refresh|id|client)?_?token[=:\s]+[^\s,;}]+/gi, '$1_token=[redacted]')
    .replace(/(secret|password|private_key|credential)[=:\s]+[^\s,;}]+/gi, '$1=[redacted]')
    .slice(0, 300)
}
