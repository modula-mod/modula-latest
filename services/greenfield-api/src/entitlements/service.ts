import {createHash} from 'node:crypto'
import {canonicalJsonStringify} from '@modula/greenfield-protocol'
import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {GreenfieldEventBus} from '../events/domain-events.js'
import {uuidv7} from '../lib/uuidv7.js'

const OFFER_KINDS = new Set(['FREE','ONE_TIME','SUBSCRIPTION','FREEMIUM','TRIAL','BUNDLE','ENTERPRISE','PRIVATE'])
const STATES = new Set(['TRIAL','ACTIVE','GRACE','PAST_DUE','CANCELLED','EXPIRED','REVOKED'])
const METRICS = new Set(['ai.request','ai.tokens','storage.bytes','transcription.seconds','media.processing','render.time','function.invocation','job.execution','game.session'])
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  TRIAL: ['ACTIVE','EXPIRED','REVOKED'], ACTIVE: ['GRACE','PAST_DUE','CANCELLED','EXPIRED','REVOKED'],
  GRACE: ['ACTIVE','PAST_DUE','CANCELLED','EXPIRED','REVOKED'], PAST_DUE: ['ACTIVE','GRACE','CANCELLED','EXPIRED','REVOKED'],
  CANCELLED: ['EXPIRED','REVOKED'], EXPIRED: [], REVOKED: [],
}

export class GreenfieldEntitlementService {
  constructor(private readonly db: ModulaDb) {}

  async upsertOffer(actorId: string, offerId: string, input: Record<string, unknown>) {
    const productId = required(input.productId, 180, 'Product ID is required')
    const kind = String(input.kind)
    if (!OFFER_KINDS.has(kind)) invalid('Invalid offer kind')
    const capabilities = stringArray(input.capabilities, 'Offer capabilities')
    if (!capabilities.length) invalid('At least one offer capability is required')
    const state = String(input.state ?? 'DRAFT')
    if (!['DRAFT','ACTIVE','RETIRED'].includes(state)) invalid('Invalid offer state')
    const trialDuration = input.trialDurationSeconds == null ? null : boundedInteger(input.trialDurationSeconds, 60, 7_776_000)
    if (kind === 'TRIAL' && !trialDuration) invalid('Trial offers require a duration')
    const now = new Date()
    const values = {offer_id: offerId, product_id: productId, kind: kind as any, display_name: required(input.displayName, 160, 'Offer display name is required'), capabilities: json(capabilities), commercial_terms: json(objectValue(input.commercialTerms)), trial_duration_seconds: trialDuration, state: state as any, created_by_account_id: actorId, created_at: now, updated_at: now}
    return this.db.insertInto('greenfield_offers').values(values).onConflict(oc => oc.column('offer_id').doUpdateSet({product_id: values.product_id, kind: values.kind, display_name: values.display_name, capabilities: values.capabilities, commercial_terms: values.commercial_terms, trial_duration_seconds: values.trial_duration_seconds, state: values.state, updated_at: now})).returningAll().executeTakeFirstOrThrow()
  }

  async grant(actorId: string, input: Record<string, unknown>) {
    const offerId = required(input.offerId, 180, 'Offer ID is required')
    const offer = await this.db.selectFrom('greenfield_offers').selectAll().where('offer_id', '=', offerId).where('state', '=', 'ACTIVE').executeTakeFirst()
    if (!offer) notFound('Active offer not found')
    const accountId = optional(input.accountId, 160)
    const organisationId = optional(input.organisationId, 160)
    if ((accountId ? 1 : 0) + (organisationId ? 1 : 0) !== 1) invalid('Exactly one entitlement owner is required')
    if (accountId && !(await this.db.selectFrom('greenfield_accounts').select('account_id').where('account_id', '=', accountId).executeTakeFirst())) notFound('Account not found')
    if (organisationId && !(await this.db.selectFrom('greenfield_developer_organisations').select('organisation_id').where('organisation_id', '=', organisationId).executeTakeFirst())) notFound('Organisation not found')
    const source = String(input.source ?? (offer.kind === 'TRIAL' ? 'TRIAL' : offer.kind === 'FREE' ? 'FREE' : 'ADMIN'))
    if (!['FREE','TRIAL','ENTERPRISE','ADMIN','APPLE','GOOGLE','WEB'].includes(source)) invalid('Invalid entitlement source')
    const receiptId = optional(input.externalReceiptId, 180)
    if (['APPLE','GOOGLE','WEB'].includes(source)) {
      const receipt = receiptId ? await this.db.selectFrom('greenfield_external_billing_receipts').selectAll().where('receipt_id', '=', receiptId).where('state', '=', 'VERIFIED').where('product_id', '=', offer.product_id).where('offer_id', '=', offerId).executeTakeFirst() : null
      if (!receipt) forbidden(`${source}_PROVIDER_NOT_CONFIGURED_OR_RECEIPT_UNVERIFIED`)
    }
    const now = new Date()
    const startedAt = dateValue(input.startedAt) ?? now
    const expiresAt = dateValue(input.expiresAt) ?? (offer.trial_duration_seconds ? new Date(startedAt.getTime() + offer.trial_duration_seconds * 1_000) : null)
    const state = source === 'TRIAL' || offer.kind === 'TRIAL' ? 'TRIAL' : 'ACTIVE'
    const entitlementId = uuidv7()
    const provenance = required(input.provenanceReference, 1_000, 'Entitlement provenance is required')
    const capabilities = stringArray(offer.capabilities, 'Offer capabilities')
    await this.db.transaction().execute(async trx => {
      const entitlementEventId = uuidv7()
      await trx.insertInto('greenfield_entitlements').values({entitlement_id: entitlementId, owner_type: accountId ? 'ACCOUNT' : 'ORGANISATION', owner_account_id: accountId || null, owner_organisation_id: organisationId || null, product_id: offer.product_id, offer_id: offerId, source: source as any, state, external_receipt_id: receiptId || null, provenance_reference: provenance, started_at: startedAt, expires_at: expiresAt, created_at: now, updated_at: now}).execute()
      await trx.insertInto('greenfield_entitlement_capabilities').values(capabilities.map(capability => ({entitlement_id: entitlementId, capability, created_at: now}))).execute()
      await trx.insertInto('greenfield_entitlement_events').values({entitlement_event_id: entitlementEventId, entitlement_id: entitlementId, event_type: 'GRANTED', previous_state: null, state, actor_type: 'ACCOUNT', actor_id: actorId, reason_code: 'ADMIN_GRANT', provenance_reference: provenance, occurred_at: now}).execute()
      await new GreenfieldEventBus(trx).publish({eventType: 'entitlement.changed.v1', eventVersion: '1.0.0', aggregateType: 'entitlement', aggregateId: entitlementId, accountId: accountId || null, producerKind: 'service', producerId: 'engine.entitlements', productId: offer.product_id, visibility: accountId ? 'account' : 'internal', classification: 'internal', idempotencyKey: `entitlement-event:${entitlementEventId}`, payload: {entitlementId, offerId, previousState: null, state, capabilities}, metadata: {source: 'greenfield.entitlements', actorAccountId: actorId}})
      await new AuditRepository(trx).append('entitlement.granted', {productId: offer.product_id, offerId, source, state}, {type: 'entitlement', id: entitlementId})
    })
    return this.get(entitlementId)
  }

  async transition(actorId: string, entitlementId: string, input: Record<string, unknown>) {
    const target = String(input.state)
    if (!STATES.has(target)) invalid('Invalid entitlement state')
    const reason = required(input.reasonCode, 120, 'Reason code is required')
    const provenance = required(input.provenanceReference, 1_000, 'Transition provenance is required')
    return this.db.transaction().execute(async trx => {
      const current = await trx.selectFrom('greenfield_entitlements').selectAll().where('entitlement_id', '=', entitlementId).forUpdate().executeTakeFirst()
      if (!current) notFound('Entitlement not found')
      if (!ALLOWED_TRANSITIONS[current.state]?.includes(target)) conflict(`Invalid entitlement transition ${current.state} -> ${target}`)
      const now = new Date()
      const entitlementEventId = uuidv7()
      await trx.updateTable('greenfield_entitlements').set({state: target as any, updated_at: now}).where('entitlement_id', '=', entitlementId).execute()
      await trx.insertInto('greenfield_entitlement_events').values({entitlement_event_id: entitlementEventId, entitlement_id: entitlementId, event_type: target === 'REVOKED' ? 'REVOKED' : target === 'EXPIRED' ? 'EXPIRED' : 'STATE_CHANGED', previous_state: current.state, state: target as any, actor_type: 'ACCOUNT', actor_id: actorId, reason_code: reason, provenance_reference: provenance, occurred_at: now}).execute()
      await new GreenfieldEventBus(trx).publish({eventType: 'entitlement.changed.v1', eventVersion: '1.0.0', aggregateType: 'entitlement', aggregateId: entitlementId, accountId: current.owner_account_id, producerKind: 'service', producerId: 'engine.entitlements', productId: current.product_id, visibility: current.owner_account_id ? 'account' : 'internal', classification: 'internal', idempotencyKey: `entitlement-event:${entitlementEventId}`, payload: {entitlementId, offerId: current.offer_id, previousState: current.state, state: target, reasonCode: reason}, metadata: {source: 'greenfield.entitlements', actorAccountId: actorId}})
      await new AuditRepository(trx).append('entitlement.state.changed', {previousState: current.state, state: target, reason}, {type: 'entitlement', id: entitlementId})
      return this.get(entitlementId, trx)
    })
  }

  async listAccount(accountId: string, productId?: string) {
    let query = this.db.selectFrom('greenfield_entitlements').select('entitlement_id').where('owner_account_id', '=', accountId)
    if (productId) query = query.where('product_id', '=', productId)
    const ids = await query.orderBy('created_at', 'desc').limit(200).execute()
    return {items: await Promise.all(ids.map(row => this.get(row.entitlement_id))), nextCursor: null}
  }

  async check(accountId: string, productId: string, capability: string) {
    const now = new Date()
    const row = await this.db.selectFrom('greenfield_entitlements as e').innerJoin('greenfield_entitlement_capabilities as c', 'c.entitlement_id', 'e.entitlement_id').select('e.entitlement_id')
      .where('e.owner_account_id', '=', accountId).where('e.product_id', '=', productId).where('c.capability', '=', capability).where('e.state', 'in', ['TRIAL','ACTIVE','GRACE']).where('e.started_at', '<=', now).where(({eb, or}) => or([eb('e.expires_at', 'is', null), eb('e.expires_at', '>', now)])).orderBy('e.created_at', 'desc').executeTakeFirst()
    return {entitled: Boolean(row), entitlement: row ? await this.get(row.entitlement_id) : null}
  }

  async upsertQuota(actorId: string, quotaPolicyId: string, input: Record<string, unknown>) {
    const scopeType = String(input.scopeType)
    if (!['ACCOUNT','ORGANISATION','PRODUCT','ENTITLEMENT','CAPABILITY'].includes(scopeType)) invalid('Invalid quota scope')
    const metric = String(input.metric)
    if (!METRICS.has(metric)) invalid('Invalid usage metric')
    const state = String(input.state ?? 'ACTIVE')
    if (!['ACTIVE','DISABLED','RETIRED'].includes(state)) invalid('Invalid quota state')
    const now = new Date()
    const values = {quota_policy_id: quotaPolicyId, scope_type: scopeType as any, scope_id: required(input.scopeId, 300, 'Quota scope ID is required'), metric: metric as any, limit_quantity: boundedInteger(input.limitQuantity, 1, Number.MAX_SAFE_INTEGER), window_seconds: boundedInteger(input.windowSeconds, 60, 31_536_000), state: state as any, created_by_account_id: actorId, created_at: now, updated_at: now}
    return this.db.insertInto('greenfield_quota_policies').values(values).onConflict(oc => oc.column('quota_policy_id').doUpdateSet({scope_type: values.scope_type, scope_id: values.scope_id, metric: values.metric, limit_quantity: values.limit_quantity, window_seconds: values.window_seconds, state: values.state, updated_at: now})).returningAll().executeTakeFirstOrThrow()
  }

  async recordUsage(serviceId: string, expectedAccountId: string, expectedProductId: string, expectedInstallationId: string | null, input: Record<string, unknown>) {
    const accountId = required(input.accountId, 160, 'Account ID is required')
    const productId = required(input.productId, 180, 'Product ID is required')
    if (accountId !== expectedAccountId || productId !== expectedProductId) forbidden('Usage scope is outside the service assertion')
    const installationId = optional(input.installationId, 180) || null
    if (installationId !== expectedInstallationId) forbidden('Usage installation is outside the service assertion')
    if (input.organisationId != null) forbidden('Organisation usage requires an organisation-scoped service assertion')
    const metric = String(input.metric)
    if (!METRICS.has(metric)) invalid('Invalid usage metric')
    const quantity = boundedInteger(input.quantity, 1, Number.MAX_SAFE_INTEGER)
    const occurredAt = dateValue(input.occurredAt)
    if (!occurredAt || occurredAt.getTime() > Date.now() + 300_000 || occurredAt.getTime() < Date.now() - 90 * 86_400_000) invalid('Usage timestamp is outside the accepted window')
    const eventId = required(input.usageEventId, 180, 'Usage event ID is required')
    const idempotencyKey = required(input.idempotencyKey, 200, 'Usage idempotency key is required')
    const organisationId = optional(input.organisationId, 160) || null
    const entitlementId = optional(input.entitlementId, 180) || null
    const capability = required(input.capability, 240, 'Usage capability is required')
    const payloadHash = sha256(canonicalJsonStringify(input))
    return this.db.transaction().execute(async trx => {
      const inserted = await trx.insertInto('greenfield_usage_events').values({usage_event_id: eventId, account_id: accountId, organisation_id: organisationId, product_id: productId, installation_id: installationId, entitlement_id: entitlementId, capability, metric: metric as any, quantity, unit: required(input.unit, 80, 'Usage unit is required'), producer_service_id: serviceId, idempotency_key: idempotencyKey, payload_hash: payloadHash, trace_id: required(input.traceId, 180, 'Trace ID is required'), occurred_at: occurredAt, recorded_at: new Date()}).onConflict(oc => oc.columns(['producer_service_id', 'idempotency_key']).doNothing()).returning('usage_event_id').executeTakeFirst()
      if (!inserted) {
        const previous = await trx.selectFrom('greenfield_usage_events').select(['usage_event_id','payload_hash']).where('producer_service_id', '=', serviceId).where('idempotency_key', '=', idempotencyKey).executeTakeFirstOrThrow()
        if (previous.payload_hash !== payloadHash) conflict('Usage idempotency key was reused with a different payload')
        return {accepted: true as const, usageEventId: previous.usage_event_id, replay: true}
      }
      const entitlementIds = entitlementId ? [entitlementId] : (await trx.selectFrom('greenfield_entitlements').select('entitlement_id').where('owner_account_id', '=', accountId).where('product_id', '=', productId).where('state', 'in', ['TRIAL','ACTIVE','GRACE']).execute()).map(row => row.entitlement_id)
      const policies = await trx.selectFrom('greenfield_quota_policies').selectAll().where('metric', '=', metric as any).where('state', '=', 'ACTIVE').execute()
      const scopes = new Set([`ACCOUNT:${accountId}`, `PRODUCT:${productId}`, `CAPABILITY:${productId}:${capability}`, ...(organisationId ? [`ORGANISATION:${organisationId}`] : []), ...entitlementIds.map(id => `ENTITLEMENT:${id}`)])
      for (const policy of policies.filter(value => scopes.has(`${value.scope_type}:${value.scope_id}`))) {
        const startMs = Math.floor(occurredAt.getTime() / (policy.window_seconds * 1_000)) * policy.window_seconds * 1_000
        const bucketStart = new Date(startMs)
        const counter = await trx.insertInto('greenfield_quota_counters').values({quota_policy_id: policy.quota_policy_id, bucket_start: bucketStart, bucket_end: new Date(startMs + policy.window_seconds * 1_000), consumed_quantity: quantity, updated_at: new Date()}).onConflict(oc => oc.columns(['quota_policy_id','bucket_start']).doUpdateSet({consumed_quantity: sql<number>`greenfield_quota_counters.consumed_quantity + excluded.consumed_quantity`, updated_at: new Date()})).returning('consumed_quantity').executeTakeFirstOrThrow()
        if (Number(counter.consumed_quantity) > Number(policy.limit_quantity)) throw Object.assign(new Error(`Quota exceeded for ${policy.quota_policy_id}`), {code: 'FORBIDDEN'})
      }
      return {accepted: true as const, usageEventId: eventId, replay: false}
    })
  }

  async adapterStatus() { return this.db.selectFrom('greenfield_billing_adapter_registrations').select(['adapter','state','last_verified_at']).orderBy('adapter').execute() }

  private async get(entitlementId: string, database = this.db) {
    const row = await database.selectFrom('greenfield_entitlements').selectAll().where('entitlement_id', '=', entitlementId).executeTakeFirst()
    if (!row) notFound('Entitlement not found')
    const capabilities = (await database.selectFrom('greenfield_entitlement_capabilities').select('capability').where('entitlement_id', '=', entitlementId).orderBy('capability').execute()).map(value => value.capability)
    return {entitlementId: row.entitlement_id, owner: row.owner_account_id ? {accountId: row.owner_account_id} : {organisationId: row.owner_organisation_id!}, productId: row.product_id, offerId: row.offer_id, capabilities, source: row.source.toLowerCase(), state: row.state, startedAt: row.started_at.toISOString(), expiresAt: row.expires_at?.toISOString() ?? null, provenance: row.provenance_reference}
  }
}

function json(value: unknown) { return sql<unknown>`${JSON.stringify(value)}::jsonb` }
function sha256(value: string) { return createHash('sha256').update(value).digest('hex') }
function objectValue(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {} }
function stringArray(value: unknown, name: string) { if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !item.trim())) invalid(`${name} must be a string array`); return Array.from(new Set(value.map(item => String(item).trim()))).sort() }
function required(value: unknown, max: number, message: string) { const text = typeof value === 'string' ? value.trim() : ''; if (!text || text.length > max) invalid(message); return text }
function optional(value: unknown, max: number) { const text = typeof value === 'string' ? value.trim() : ''; if (text.length > max) invalid('Text value is too long'); return text }
function boundedInteger(value: unknown, min: number, max: number) { const number = Number(value); if (!Number.isSafeInteger(number) || number < min || number > max) invalid('Invalid integer value'); return number }
function dateValue(value: unknown) { if (typeof value !== 'string' || !value) return null; const date = new Date(value); return Number.isNaN(date.getTime()) ? null : date }
function invalid(message: string): never { throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'}) }
function forbidden(message: string): never { throw Object.assign(new Error(message), {code: 'FORBIDDEN'}) }
function conflict(message: string): never { throw Object.assign(new Error(message), {code: 'CONFLICT'}) }
function notFound(message: string): never { throw Object.assign(new Error(message), {code: 'NOT_FOUND'}) }
