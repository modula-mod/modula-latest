import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {AuditRepository} from '../audit/repository.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import type {SearchActorContext, SearchReindexInput} from './contracts.js'
import {filtersForPersistence, normalizeSearchQuery, parseSearchRequest, searchLimitsFromConfig, searchValidation} from './query-parser.js'
import {excerptFor, matchedFieldsFor} from './ranking.js'
import {SearchRepository} from './repository.js'
import {resourceTypeForSearch, toSearchResult} from './visibility.js'

export class GreenfieldSearchService {
  private readonly repository: SearchRepository
  private readonly policy: GreenfieldPolicyEngine
  private readonly audit: AuditRepository

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.repository = new SearchRepository(db)
    this.policy = new GreenfieldPolicyEngine(db)
    this.audit = new AuditRepository(db)
  }

  async search(raw: Record<string, unknown>, actor: SearchActorContext) {
    const limits = searchLimitsFromConfig(this.config)
    const parsed = parseSearchRequest(raw, limits)
    this.assertAccountScope(parsed.accountId, actor.accountId)

    const started = Date.now()
    const page = await this.repository.search(parsed, actor, limits)
    const results = []
    for (const row of page.rows) {
      const decision = await this.policy.evaluateAndAudit({
        actorId: actor.actorId,
        accountId: actor.accountId ?? undefined,
        action: 'search.result.read',
        resource: {
          type: resourceTypeForSearch(row.entityType),
          id: row.entityId,
          ownerActorId: row.ownerId ?? undefined,
          ownerAccountId: row.accountId ?? undefined,
          visibility: row.visibility,
        },
        requestContext: {requestId: actor.requestId, correlationId: actor.correlationId},
      })
      if (!decision.allowed) continue
      const matchedFields = matchedFieldsFor(row, parsed.normalizedQuery, parsed.tags)
      results.push(toSearchResult(row, matchedFields, excerptFor(row, parsed.normalizedQuery)))
    }
    const tookMs = Date.now() - started
    await this.repository.recordMetric({
      requestId: actor.requestId,
      actorId: actor.actorId,
      accountId: actor.accountId,
      entityTypes: parsed.entityTypes,
      tookMs,
      resultCount: results.length,
    })
    if (actor.accountId) await this.repository.recordRecent(actor.accountId, parsed, limits)
    return {
      results,
      nextCursor: page.nextCursor,
      requestId: actor.requestId,
      tookMs,
    }
  }

  async suggestions(raw: Record<string, unknown>, actor: SearchActorContext) {
    const limits = searchLimitsFromConfig(this.config)
    const query = normalizeSearchQuery(String(raw.query ?? raw.q ?? ''), limits)
    const limit = Math.min(Number(raw.limit ?? 10) || 10, 20)
    return {
      suggestions: await this.repository.suggestions({query, accountId: actor.accountId, limit}),
      requestId: actor.requestId,
    }
  }

  async listRecent(actor: SearchActorContext, raw: Record<string, unknown>) {
    const accountId = requireAccount(actor)
    const limits = searchLimitsFromConfig(this.config)
    const limit = Math.min(Number(raw.limit ?? limits.recentLimit) || limits.recentLimit, limits.recentLimit)
    return {items: await this.repository.listRecent(accountId, limit)}
  }

  async recordRecent(actor: SearchActorContext, body: Record<string, unknown>) {
    const accountId = requireAccount(actor)
    const limits = searchLimitsFromConfig(this.config)
    const parsed = parseSearchRequest(body, limits)
    await this.repository.recordRecent(accountId, parsed, limits)
    return {stored: true}
  }

  async deleteRecent(actor: SearchActorContext, raw: Record<string, unknown>) {
    const accountId = requireAccount(actor)
    const query = typeof raw.query === 'string' ? raw.query : undefined
    const recentSearchId = typeof raw.recentSearchId === 'string' ? raw.recentSearchId : undefined
    const deleted = await this.repository.deleteRecent(accountId, {
      recentSearchId,
      query: query ? normalizeSearchQuery(query, searchLimitsFromConfig(this.config)) : undefined,
    })
    return {deleted}
  }

  async listSaved(actor: SearchActorContext) {
    return {items: await this.repository.listSaved(requireAccount(actor))}
  }

  async createSaved(actor: SearchActorContext, body: Record<string, unknown>) {
    const accountId = requireAccount(actor)
    const limits = searchLimitsFromConfig(this.config)
    const name = textField(body.name, 120)
    if (!name) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Saved search name is required')
    const parsed = parseSearchRequest(body, limits)
    return this.repository.createSaved(accountId, {name, query: parsed.query, filters: filtersForPersistence(parsed)})
  }

  async patchSaved(actor: SearchActorContext, savedSearchId: string, body: Record<string, unknown>) {
    const accountId = requireAccount(actor)
    const patch: {name?: string; query?: string; filters?: Record<string, unknown>} = {}
    const name = textField(body.name, 120)
    if (name) patch.name = name
    if (body.query || body.q) {
      const parsed = parseSearchRequest(body, searchLimitsFromConfig(this.config))
      patch.query = parsed.query
      patch.filters = filtersForPersistence(parsed)
    }
    if (Object.keys(patch).length === 0) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Saved search patch is empty')
    return this.repository.patchSaved(accountId, savedSearchId, patch)
  }

  async deleteSaved(actor: SearchActorContext, savedSearchId: string) {
    const deleted = await this.repository.deleteSaved(requireAccount(actor), savedSearchId)
    if (!deleted) throw Object.assign(new Error('Saved search not found'), {code: 'NOT_FOUND'})
    return {deleted: true}
  }

  async health() {
    const diagnostics = await this.repository.diagnostics()
    const unhealthy = diagnostics.projectionFailures > 0 || diagnostics.projectionLag.some(item => item.lastFailureCode)
    return {
      status: unhealthy ? 'degraded' : 'healthy',
      diagnostics,
    }
  }

  diagnostics() {
    return this.repository.diagnostics()
  }

  projectionStates() {
    return this.repository.listProjectionStates()
  }

  projectionFailures() {
    return this.repository.listProjectionFailures()
  }

  async requestReindex(actor: SearchActorContext, body: Record<string, unknown>) {
    if (!actor.capabilities.includes('admin:ops')) {
      throw Object.assign(new Error('Operator access required'), {code: 'FORBIDDEN'})
    }
    const input = parseReindex(body)
    const result = await this.repository.requestReindex(input, actor)
    await this.audit.append(
      'search.reindex.requested',
      {reindexId: result.reindexId, ...input},
      {type: 'searchReindex', id: result.reindexId, actorId: actor.actorId},
      {accountId: actor.accountId, requestId: actor.requestId, correlationId: actor.correlationId},
    )
    await new GreenfieldEventBus(this.db).publish({
      eventType: 'search.reindex-requested',
      aggregateType: 'searchReindex',
      aggregateId: result.reindexId,
      actorId: actor.actorId,
      accountId: actor.accountId,
      requestId: actor.requestId,
      correlationId: actor.correlationId,
      idempotencyKey: `search.reindex-requested:${result.reindexId}`,
      visibility: 'internal',
      classification: 'internal',
      payload: {reindexId: result.reindexId, mode: input.mode, entityType: input.entityType, dryRun: input.dryRun},
      metadata: {reason: input.reason},
    })
    return result
  }

  async retryFailure(actor: SearchActorContext, failureId: string) {
    if (!actor.capabilities.includes('admin:ops')) {
      throw Object.assign(new Error('Operator access required'), {code: 'FORBIDDEN'})
    }
    const retried = await this.repository.retryFailure(failureId)
    if (!retried) throw Object.assign(new Error('Projection failure not found'), {code: 'NOT_FOUND'})
    await this.audit.append(
      'search.projection.failure.retry_requested',
      {failureId},
      {type: 'searchProjectionFailure', id: failureId, actorId: actor.actorId},
      {accountId: actor.accountId, requestId: actor.requestId, correlationId: actor.correlationId},
    )
    return {retried: true}
  }

  private assertAccountScope(requestedAccountId: string | undefined, actorAccountId: string | null): void {
    if (!requestedAccountId) return
    if (!actorAccountId) throw Object.assign(new Error('Account scope requires authentication'), {code: 'FORBIDDEN', searchCode: 'ACCOUNT_SCOPE_REQUIRED'})
    if (requestedAccountId !== actorAccountId) throw Object.assign(new Error('Account scope is not visible'), {code: 'FORBIDDEN', searchCode: 'RESOURCE_NOT_VISIBLE'})
  }
}

function requireAccount(actor: SearchActorContext): string {
  if (!actor.accountId) throw Object.assign(new Error('Account authentication required'), {code: 'UNAUTHENTICATED'})
  return actor.accountId
}

function parseReindex(body: Record<string, unknown>): SearchReindexInput {
  const mode = textField(body.mode, 40)
  if (!mode || !['single-entity', 'entity-type', 'account-scope', 'full-index'].includes(mode)) {
    throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Invalid reindex mode')
  }
  const reason = textField(body.reason, 500)
  if (!reason || reason.length < 5) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Reindex reason is required')
  const entityType = textField(body.entityType, 40) as SearchReindexInput['entityType']
  const entityId = textField(body.entityId, 200)
  const accountId = textField(body.accountId, 200)
  if (mode === 'single-entity' && (!entityType || !entityId)) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Single-entity reindex requires entityType and entityId')
  if (mode === 'entity-type' && !entityType) throw searchValidation('SEARCH_FILTER_NOT_ALLOWED', 'Entity-type reindex requires entityType')
  if (mode === 'account-scope' && !accountId) throw searchValidation('ACCOUNT_SCOPE_REQUIRED', 'Account-scope reindex requires accountId')
  return {mode: mode as SearchReindexInput['mode'], entityType, entityId, accountId, dryRun: Boolean(body.dryRun), reason}
}

function textField(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.normalize('NFKC').trim()
  if (!text || text.length > max) return undefined
  return text
}
