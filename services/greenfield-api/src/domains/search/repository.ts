import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'
import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database, GreenfieldSearchEntityType} from '../../database/types.js'
import type {ParsedSearchRequest, SearchActorContext, SearchCursor, SearchDocumentRow, SearchLimits, SearchReindexInput} from './contracts.js'
import {decodeSearchCursor, encodeSearchCursor, filtersForPersistence} from './query-parser.js'
import {entityRankingWeight} from './ranking.js'

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

type SearchRows = {
  document_id: string
  entity_type: GreenfieldSearchEntityType
  entity_id: string
  source_version: number
  account_id: string | null
  owner_id: string | null
  title: string | null
  body: string | null
  summary: string | null
  keywords: string[]
  tags: string[]
  visibility: Database['search_documents']['visibility']
  status: Database['search_documents']['status']
  language: string | null
  metadata: unknown
  created_at: Date
  updated_at: Date
  indexed_at: Date
  score: string | number | null
}

export class SearchRepository {
  constructor(private readonly db: ModulaDb) {}

  async upsertDocument(document: GreenfieldSearchDocument): Promise<'applied' | 'idempotent' | 'stale'> {
    const existing = await this.db
      .selectFrom('search_documents')
      .select(['document_id', 'source_version'])
      .where('entity_type', '=', document.entityType)
      .where('entity_id', '=', document.entityId)
      .executeTakeFirst()
    if (existing && existing.source_version > document.sourceVersion) return 'stale'

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
    return existing?.source_version === document.sourceVersion ? 'idempotent' : 'applied'
  }

  async tombstone(input: {
    entityType: GreenfieldSearchEntityType
    entityId: string
    sourceVersion: number
    accountId?: string | null
    ownerId?: string | null
    visibility?: Database['search_documents']['visibility']
    updatedAt?: Date
    indexedAt?: Date
    status?: Database['search_documents']['status']
  }): Promise<'applied' | 'idempotent' | 'stale'> {
    const now = input.indexedAt ?? new Date()
    return this.upsertDocument({
      documentId: `${input.entityType}:${input.entityId}`,
      schemaVersion: '1.0.0',
      entityType: input.entityType,
      entityId: input.entityId,
      sourceVersion: input.sourceVersion,
      accountId: input.accountId ?? undefined,
      ownerId: input.ownerId ?? undefined,
      title: undefined,
      body: undefined,
      summary: undefined,
      keywords: [],
      tags: [],
      visibility: input.visibility ?? 'private',
      status: input.status ?? 'deleted',
      createdAt: (input.updatedAt ?? now).toISOString(),
      updatedAt: (input.updatedAt ?? now).toISOString(),
      indexedAt: now.toISOString(),
      metadata: {tombstone: true},
    })
  }

  async search(input: ParsedSearchRequest, actor: SearchActorContext, limits: SearchLimits): Promise<{rows: SearchDocumentRow[]; nextCursor?: string}> {
    const cursor = decodeSearchCursor(input.cursor)
    return this.db.transaction().execute(async trx => {
      await sql`SET LOCAL statement_timeout = ${sql.raw(String(limits.timeoutMs))}`.execute(trx)
      const offset = cursor?.offset ?? 0
      const rows = await this.searchRows(input, actor, offset, input.limit + 1, trx as ModulaDb)
      const visibleRows = rows.map(toSearchDocumentRow)
      const page = visibleRows.slice(0, input.limit)
      const nextCursor = visibleRows.length > input.limit ? cursorFor(offset + input.limit, input.sort) : undefined
      return {rows: page, nextCursor}
    })
  }

  async suggestions(input: {query: string; accountId: string | null; limit: number}): Promise<Array<{query: string; label: string; entityType?: GreenfieldSearchEntityType; entityId?: string; source: 'profile-handle' | 'module-name' | 'recent-search'}>> {
    const pattern = `${escapeLike(input.query.toLowerCase())}%`
    const documents = await this.db
      .selectFrom('search_documents')
      .select(['entity_type', 'entity_id', 'title', 'metadata'])
      .where('status', '=', 'active')
      .where('visibility', '=', 'public')
      .where('entity_type', 'in', ['profile', 'module'])
      .where(({eb, or}) =>
        or([
          eb(sql`lower(coalesce(title, ''))`, 'like', pattern),
          eb(sql`lower(coalesce(metadata->>'handle', ''))`, 'like', pattern),
        ]),
      )
      .orderBy('updated_at', 'desc')
      .limit(input.limit)
      .execute()

    const recent = input.accountId
      ? await this.db
        .selectFrom('recent_searches')
        .select(['query'])
        .where('account_id', '=', input.accountId)
        .where(sql<boolean>`lower(query) LIKE ${pattern}`)
        .orderBy('searched_at', 'desc')
        .limit(input.limit)
        .execute()
      : []

    const suggestions = [
      ...documents.map(row => {
        const metadata = recordFromJson(row.metadata)
        const handle = typeof metadata.handle === 'string' ? metadata.handle : undefined
        return {
          query: row.entity_type === 'profile' && handle ? `@${handle}` : row.title ?? '',
          label: row.title ?? handle ?? '',
          entityType: row.entity_type as GreenfieldSearchEntityType,
          entityId: row.entity_id,
          source: row.entity_type === 'profile' ? 'profile-handle' as const : 'module-name' as const,
        }
      }),
      ...recent.map(row => ({query: row.query, label: row.query, source: 'recent-search' as const})),
    ].filter(item => item.query && item.label)

    const deduped = new Map<string, (typeof suggestions)[number]>()
    for (const suggestion of suggestions) {
      if (!deduped.has(suggestion.query.toLowerCase())) deduped.set(suggestion.query.toLowerCase(), suggestion)
      if (deduped.size >= input.limit) break
    }
    return Array.from(deduped.values())
  }

  async recordMetric(input: {requestId: string; actorId: string | null; accountId: string | null; entityTypes: GreenfieldSearchEntityType[]; tookMs: number; resultCount: number}): Promise<void> {
    await this.db
      .insertInto('search_query_metrics')
      .values({
        request_id: input.requestId,
        actor_id: input.actorId,
        account_id: input.accountId,
        entity_types: input.entityTypes,
        took_ms: input.tookMs,
        result_count: input.resultCount,
        created_at: new Date(),
      })
      .onConflict(oc => oc.column('request_id').doNothing())
      .execute()
  }

  async recordRecent(accountId: string, input: ParsedSearchRequest, limits: SearchLimits): Promise<void> {
    const now = new Date()
    await this.db
      .insertInto('recent_searches')
      .values({
        recent_search_id: `recent-search-${randomUUID()}`,
        account_id: accountId,
        query: input.query,
        normalized_query: input.normalizedQuery,
        filters: jsonb(filtersForPersistence(input)),
        searched_at: now,
        created_at: now,
      })
      .onConflict(oc => oc.columns(['account_id', 'normalized_query']).doUpdateSet({
        query: input.query,
        filters: jsonb(filtersForPersistence(input)),
        searched_at: now,
      }))
      .execute()
    await sql`
      DELETE FROM recent_searches
      WHERE account_id = ${accountId}
      AND recent_search_id NOT IN (
        SELECT recent_search_id
        FROM recent_searches
        WHERE account_id = ${accountId}
        ORDER BY searched_at DESC
        LIMIT ${limits.recentLimit}
      )
    `.execute(this.db)
  }

  async listRecent(accountId: string, limit: number) {
    const rows = await this.db
      .selectFrom('recent_searches')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('searched_at', 'desc')
      .limit(limit)
      .execute()
    return rows.map(row => ({
      recentSearchId: row.recent_search_id,
      accountId: row.account_id,
      query: row.query,
      filters: recordFromJson(row.filters),
      searchedAt: row.searched_at.toISOString(),
    }))
  }

  async deleteRecent(accountId: string, input: {recentSearchId?: string; query?: string}): Promise<number> {
    let query = this.db.deleteFrom('recent_searches').where('account_id', '=', accountId)
    if (input.recentSearchId) query = query.where('recent_search_id', '=', input.recentSearchId)
    else if (input.query) query = query.where('normalized_query', '=', input.query.toLowerCase())
    const result = await query.executeTakeFirst()
    return Number(result.numDeletedRows ?? 0)
  }

  async createSaved(accountId: string, input: {name: string; query: string; filters: Record<string, unknown>}) {
    const now = new Date()
    const row = await this.db
      .insertInto('saved_searches')
      .values({
        saved_search_id: `saved-search-${randomUUID()}`,
        account_id: accountId,
        name: input.name,
        query: input.query,
        filters: jsonb(input.filters),
        created_at: now,
        updated_at: now,
      })
      .returningAll()
      .executeTakeFirstOrThrow()
    return savedSearch(row)
  }

  async listSaved(accountId: string) {
    const rows = await this.db.selectFrom('saved_searches').selectAll().where('account_id', '=', accountId).orderBy('updated_at', 'desc').execute()
    return rows.map(savedSearch)
  }

  async patchSaved(accountId: string, savedSearchId: string, input: {name?: string; query?: string; filters?: Record<string, unknown>}) {
    const row = await this.db
      .updateTable('saved_searches')
      .set({
        ...(input.name ? {name: input.name} : {}),
        ...(input.query ? {query: input.query} : {}),
        ...(input.filters ? {filters: jsonb(input.filters)} : {}),
        updated_at: new Date(),
      })
      .where('account_id', '=', accountId)
      .where('saved_search_id', '=', savedSearchId)
      .returningAll()
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Saved search not found'), {code: 'NOT_FOUND'})
    return savedSearch(row)
  }

  async deleteSaved(accountId: string, savedSearchId: string): Promise<boolean> {
    const result = await this.db
      .deleteFrom('saved_searches')
      .where('account_id', '=', accountId)
      .where('saved_search_id', '=', savedSearchId)
      .executeTakeFirst()
    return Number(result.numDeletedRows ?? 0) > 0
  }

  async diagnostics() {
    const [byEntity, byStatus, projectionLag, oldestPending, failures, stale, tombstones, metrics] = await Promise.all([
      this.db.selectFrom('search_documents').select(['entity_type', sql<number>`count(*)::int`.as('count')]).groupBy('entity_type').execute(),
      this.db.selectFrom('search_documents').select(['status', sql<number>`count(*)::int`.as('count')]).groupBy('status').execute(),
      this.db.selectFrom('search_projection_state').selectAll().orderBy('projector_id').execute(),
      this.db
        .selectFrom('greenfield_event_deliveries')
        .select(sql<Date>`min(created_at)`.as('oldest'))
        .where('target_type', '=', 'search-index')
        .where('status', 'in', ['pending', 'retrying'])
        .executeTakeFirst(),
      this.db.selectFrom('search_projection_failures').select(sql<number>`count(*)::int`.as('count')).where('resolved_at', 'is', null).executeTakeFirst(),
      this.db
        .selectFrom('search_documents')
        .select(sql<number>`count(*)::int`.as('count'))
        .where(sql<boolean>`indexed_at < updated_at - interval '5 minutes'`)
        .executeTakeFirst(),
      this.db.selectFrom('search_documents').select(sql<number>`count(*)::int`.as('count')).where('status', '=', 'deleted').executeTakeFirst(),
      sql<{avg_ms: number | null; p95_ms: number | null}>`
        SELECT
          avg(took_ms)::int AS avg_ms,
          percentile_cont(0.95) WITHIN GROUP (ORDER BY took_ms)::int AS p95_ms
        FROM search_query_metrics
        WHERE created_at > NOW() - interval '1 day'
      `.execute(this.db),
    ])

    return {
      documentsByEntityType: Object.fromEntries(byEntity.map(row => [row.entity_type, Number(row.count)])),
      documentsByStatus: Object.fromEntries(byStatus.map(row => [row.status, Number(row.count)])),
      projectionLag: projectionLag.map(row => ({
        projectorId: row.projector_id,
        entityType: row.entity_type,
        lastEventId: row.last_event_id ?? undefined,
        lastProcessedAt: row.last_processed_at?.toISOString(),
        lastSuccessAt: row.last_success_at?.toISOString(),
        lastFailureAt: row.last_failure_at?.toISOString(),
        lastFailureCode: row.last_failure_code ?? undefined,
        processedCount: row.processed_count,
        failedCount: row.failed_count,
        lagSeconds: row.lag_seconds,
      })),
      oldestPendingEvent: oldestPending?.oldest?.toISOString(),
      lastSuccessfulProjection: projectionLag
        .map(row => row.last_success_at)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString(),
      projectionFailures: Number(failures?.count ?? 0),
      staleDocumentCount: Number(stale?.count ?? 0),
      deletedTombstoneCount: Number(tombstones?.count ?? 0),
      averageSearchLatencyMs: metrics.rows[0]?.avg_ms ?? undefined,
      p95SearchLatencyMs: metrics.rows[0]?.p95_ms ?? undefined,
    }
  }

  async listProjectionStates() {
    return this.db.selectFrom('search_projection_state').selectAll().orderBy('projector_id').execute()
  }

  async listProjectionFailures() {
    return this.db
      .selectFrom('search_projection_failures')
      .select(['failure_id', 'projector_id', 'event_id', 'entity_type', 'entity_id', 'failure_code', 'attempt_count', 'first_failed_at', 'last_failed_at', 'resolved_at', 'sanitised_details'])
      .orderBy('last_failed_at', 'desc')
      .limit(100)
      .execute()
  }

  async requestReindex(input: SearchReindexInput, actor: SearchActorContext) {
    const now = new Date()
    const reindexId = `search-reindex-${randomUUID()}`
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('search_reindex_requests')
        .values({
          reindex_id: reindexId,
          mode: input.mode,
          entity_type: input.entityType ?? null,
          entity_id: input.entityId ?? null,
          account_id: input.accountId ?? null,
          dry_run: input.dryRun,
          reason: input.reason,
          requested_by_actor_id: actor.actorId,
          request_id: actor.requestId,
          correlation_id: actor.correlationId,
          state: 'queued',
          processed_count: 0,
          failure_code: null,
          cancellation_requested_at: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
        })
        .execute()
      await trx
        .insertInto('background_jobs')
        .values({
          id: `job-${reindexId}`,
          job_type: 'search.reindex',
          payload: jsonb({reindexId, ...input, requestedByActorId: actor.actorId}),
          status: 'pending',
          priority: input.mode === 'full-index' ? 20 : 80,
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          attempt_count: 0,
          maximum_attempts: 3,
          last_error: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
        })
        .execute()
    })
    return {reindexId, state: 'queued' as const, dryRun: input.dryRun}
  }

  async retryFailure(failureId: string): Promise<boolean> {
    const failure = await this.db.selectFrom('search_projection_failures').selectAll().where('failure_id', '=', failureId).executeTakeFirst()
    if (!failure) return false
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('search_projection_failures').set({resolved_at: now}).where('failure_id', '=', failureId).execute()
      await trx
        .updateTable('greenfield_event_deliveries')
        .set({status: 'retrying', available_at: now, failure_code: null, failure_message: null, updated_at: now})
        .where('event_id', '=', failure.event_id)
        .where('subscriber_id', '=', failure.projector_id)
        .where('status', 'in', ['dead_lettered', 'retrying'])
        .execute()
    })
    return true
  }

  private async searchRows(
    input: ParsedSearchRequest,
    actor: SearchActorContext,
    offset: number,
    limit: number,
    db: ModulaDb,
  ): Promise<SearchRows[]> {
    const tagFilter = input.tags.length > 0 ? input.tags : ['__no_tag_filter__']
    const rankWeights = {
      post: entityRankingWeight('post'),
      profile: entityRankingWeight('profile'),
      module: entityRankingWeight('module'),
      release: entityRankingWeight('module-release'),
      note: entityRankingWeight('note'),
      folder: entityRankingWeight('vault-folder'),
    }
    const orderBy = orderBySql(input.sort)
    const createdAfter = input.createdAfter ? new Date(input.createdAfter) : null
    const createdBefore = input.createdBefore ? new Date(input.createdBefore) : null
    const updatedAfter = input.updatedAfter ? new Date(input.updatedAfter) : null
    const updatedBefore = input.updatedBefore ? new Date(input.updatedBefore) : null
    const handleQuery = input.normalizedQuery.replace(/^@/, '')
    const likePattern = `%${escapeLike(input.normalizedQuery)}%`

    const result = await sql<SearchRows>`
      WITH ranked AS (
        SELECT
          document_id,
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
          (
            ts_rank_cd(search_vector, websearch_to_tsquery('english', ${input.query})) * 100
            + (CASE WHEN lower(coalesce(metadata->>'handle', '')) = ${handleQuery} THEN 90 ELSE 0 END)::float
            + (CASE WHEN lower(coalesce(metadata->>'handle', '')) LIKE ${`${escapeLike(handleQuery)}%`} THEN 45 ELSE 0 END)::float
            + (CASE WHEN lower(coalesce(title, '')) = ${input.normalizedQuery} THEN 70 ELSE 0 END)::float
            + (CASE WHEN lower(coalesce(title, '')) LIKE ${`${escapeLike(input.normalizedQuery)}%`} THEN 35 ELSE 0 END)::float
            + (CASE WHEN tags && ${tagFilter}::text[] THEN 20 ELSE 0 END)::float
            + CASE entity_type
              WHEN 'profile' THEN ${rankWeights.profile}::float
              WHEN 'module' THEN ${rankWeights.module}::float
              WHEN 'module-release' THEN ${rankWeights.release}::float
              WHEN 'note' THEN ${rankWeights.note}::float
              WHEN 'vault-folder' THEN ${rankWeights.folder}::float
              ELSE ${rankWeights.post}::float
            END
            + LEAST(10, GREATEST(0, 10 - EXTRACT(EPOCH FROM (NOW() - updated_at)) / 86400 / 14))::float
            + (CASE
              WHEN entity_type IN ('module','module-release') AND metadata->>'trustState' = 'firstParty' THEN 8
              WHEN entity_type IN ('module','module-release') AND metadata->>'trustState' = 'verifiedPublisher' THEN 4
              ELSE 0
            END)::float
          )::float AS score
        FROM search_documents
        WHERE status = 'active'
          AND entity_type = ANY(${input.entityTypes}::text[])
          AND (${input.ownerId ?? null}::text IS NULL OR owner_id = ${input.ownerId ?? null})
          AND (${input.accountId ?? null}::text IS NULL OR account_id = ${input.accountId ?? null})
          AND (${createdAfter}::timestamptz IS NULL OR created_at >= ${createdAfter})
          AND (${createdBefore}::timestamptz IS NULL OR created_at <= ${createdBefore})
          AND (${updatedAfter}::timestamptz IS NULL OR updated_at >= ${updatedAfter})
          AND (${updatedBefore}::timestamptz IS NULL OR updated_at <= ${updatedBefore})
          AND (${input.tags.length === 0} OR tags && ${tagFilter}::text[])
          AND (
            search_vector @@ websearch_to_tsquery('english', ${input.query})
            OR lower(coalesce(title, '')) LIKE ${likePattern}
            OR lower(coalesce(summary, '')) LIKE ${likePattern}
            OR lower(coalesce(body, '')) LIKE ${likePattern}
            OR lower(coalesce(metadata->>'handle', '')) LIKE ${likePattern}
            OR tags && ${tagFilter}::text[]
          )
          AND (
            visibility = 'public'
            OR (${actor.actorId}::text IS NOT NULL AND owner_id = ${actor.actorId})
            OR (${actor.accountId}::text IS NOT NULL AND account_id = ${actor.accountId})
            OR (
              visibility = 'followers'
              AND ${actor.actorId}::text IS NOT NULL
              AND owner_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM follows
                WHERE follows.follower_actor_id = ${actor.actorId}
                  AND follows.followed_actor_id = search_documents.owner_id
                  AND follows.deleted_at IS NULL
              )
            )
          )
      )
      SELECT *
      FROM ranked
      ORDER BY ${orderBy}
      OFFSET ${offset}
      LIMIT ${limit}
    `.execute(db)
    return result.rows
  }
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

function orderBySql(sort: ParsedSearchRequest['sort']) {
  if (sort === 'recent') return sql`updated_at DESC, document_id DESC`
  if (sort === 'oldest') return sql`updated_at ASC, document_id ASC`
  return sql`score DESC, updated_at DESC, document_id DESC`
}

function cursorFor(offset: number, sort: ParsedSearchRequest['sort']): string | undefined {
  return encodeSearchCursor({sort, offset})
}

function toSearchDocumentRow(row: SearchRows): SearchDocumentRow {
  return {
    documentId: row.document_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    sourceVersion: Number(row.source_version),
    accountId: row.account_id,
    ownerId: row.owner_id,
    title: row.title,
    body: row.body,
    summary: row.summary,
    keywords: row.keywords ?? [],
    tags: row.tags ?? [],
    visibility: row.visibility,
    status: row.status,
    language: row.language,
    metadata: recordFromJson(row.metadata),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: row.indexed_at.toISOString(),
    score: Number(row.score ?? 0),
  }
}

function savedSearch(row: Database['saved_searches']) {
  return {
    savedSearchId: row.saved_search_id,
    accountId: row.account_id,
    name: row.name,
    query: row.query,
    filters: recordFromJson(row.filters),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}
