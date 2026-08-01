import {randomUUID} from 'node:crypto'
import type {EventDataClassification, EventVisibility, GreenfieldDomainEvent} from '@modula/greenfield-contracts'
import {getEventSchema} from '@modula/greenfield-schema-registry'
import type {Kysely, Transaction} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database, GreenfieldEventDeliveryTargetType} from '../database/types.js'
import {uuidv7} from '../lib/uuidv7.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

export type GreenfieldDomainEventRecord = {
  eventId: string
  eventType: string
  eventVersion: string
  aggregateType: string
  aggregateId: string
  aggregateVersion: number | null
  accountId: string | null
  actorId: string | null
  requestId: string
  correlationId: string
  causationId: string | null
  idempotencyKey: string | null
  visibility: EventVisibility
  classification: EventDataClassification
  payload: Record<string, unknown>
  metadata: Record<string, unknown>
  occurredAt: Date
  recordedAt: Date
}

export type GreenfieldDomainEventInput = {
  eventType: string
  eventVersion?: string
  aggregateType: string
  aggregateId: string
  aggregateVersion?: number | null
  accountId?: string | null
  actorId?: string | null
  requestId?: string | null
  correlationId?: string | null
  causationId?: string | null
  idempotencyKey?: string | null
  visibility?: EventVisibility
  classification?: EventDataClassification
  payload?: Record<string, unknown>
  metadata?: Record<string, unknown>
  occurredAt?: Date
}

export type GreenfieldEventSubscriptionInput = {
  subscriptionId?: string
  eventType: string
  subscriberId: string
  targetType: GreenfieldEventDeliveryTargetType
  targetKey: string
  filters?: Record<string, unknown>
  permittedVisibility?: EventVisibility[]
  permittedClassifications?: EventDataClassification[]
  subscriberTimeoutMs?: number
  maxConcurrency?: number
  enabled?: boolean
}

export class GreenfieldDomainEventRepository {
  constructor(private readonly db: Db) {}

  async append(input: GreenfieldDomainEventInput): Promise<GreenfieldDomainEventRecord> {
    const eventVersion = input.eventVersion ?? '1.0.0'
    const schema = getEventSchema(input.eventType, eventVersion)
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotency(input)
      if (existing) {
        await this.ensureDeliveries(existing)
        return toDomainEventRecord(existing)
      }
    }

    const now = new Date()
    const eventId = `event-${uuidv7()}`
    const requestId = input.requestId ?? eventId
    const correlationId = input.correlationId ?? requestId
    try {
      const inserted = await this.db
        .insertInto('greenfield_domain_events')
        .values({
          event_id: eventId,
          event_type: input.eventType,
          event_version: eventVersion,
          aggregate_type: input.aggregateType,
          aggregate_id: input.aggregateId,
          aggregate_version: input.aggregateVersion ?? null,
          account_id: input.accountId ?? null,
          actor_id: input.actorId ?? null,
          request_id: requestId,
          correlation_id: correlationId,
          causation_id: input.causationId ?? null,
          idempotency_key: input.idempotencyKey ?? null,
          visibility: input.visibility ?? 'internal',
          classification: input.classification ?? schema?.dataClassification ?? 'internal',
          payload: input.payload ?? {},
          metadata: input.metadata ?? {},
          occurred_at: input.occurredAt ?? now,
          recorded_at: now,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      await this.ensureDeliveries(inserted)
      return toDomainEventRecord(inserted)
    } catch (error: unknown) {
      if (!input.idempotencyKey || !isUniqueViolation(error)) throw error
      const existing = await this.findByIdempotency(input)
      if (!existing) throw error
      await this.ensureDeliveries(existing)
      return toDomainEventRecord(existing)
    }
  }

  async registerSubscription(input: GreenfieldEventSubscriptionInput) {
    const now = new Date()
    return this.db
      .insertInto('greenfield_event_subscriptions')
      .values({
        subscription_id: input.subscriptionId ?? `subscription-${randomUUID()}`,
        event_type: input.eventType,
        subscriber_id: input.subscriberId,
        target_type: input.targetType,
        target_key: input.targetKey,
        filters: input.filters ?? {},
        permitted_visibility: input.permittedVisibility ?? ['public', 'account', 'actor', 'internal'],
        permitted_classifications: input.permittedClassifications ?? ['public', 'internal'],
        subscriber_timeout_ms: input.subscriberTimeoutMs ?? 30_000,
        max_concurrency: input.maxConcurrency ?? 4,
        enabled: input.enabled ?? true,
        created_at: now,
        updated_at: now,
      })
      .onConflict(conflict => conflict.columns(['event_type', 'subscriber_id']).doUpdateSet({
        target_type: input.targetType,
        target_key: input.targetKey,
        filters: input.filters ?? {},
        permitted_visibility: input.permittedVisibility ?? ['public', 'account', 'actor', 'internal'],
        permitted_classifications: input.permittedClassifications ?? ['public', 'internal'],
        subscriber_timeout_ms: input.subscriberTimeoutMs ?? 30_000,
        max_concurrency: input.maxConcurrency ?? 4,
        enabled: input.enabled ?? true,
        updated_at: now,
      }))
      .returningAll()
      .executeTakeFirstOrThrow()
  }

  private async findByIdempotency(input: GreenfieldDomainEventInput) {
    if (!input.idempotencyKey) return null
    return this.db
      .selectFrom('greenfield_domain_events')
      .selectAll()
      .where('event_type', '=', input.eventType)
      .where('aggregate_type', '=', input.aggregateType)
      .where('aggregate_id', '=', input.aggregateId)
      .where('idempotency_key', '=', input.idempotencyKey)
      .executeTakeFirst()
  }

  private async ensureDeliveries(event: Database['greenfield_domain_events']): Promise<void> {
    const subscriptions = await this.db
      .selectFrom('greenfield_event_subscriptions')
      .selectAll()
      .where('event_type', '=', event.event_type)
      .where('enabled', '=', true)
      .execute()
    const permitted = subscriptions.filter(subscription => canRouteEvent(event, subscription))
    if (permitted.length === 0) return

    const now = new Date()
    await this.db
      .insertInto('greenfield_event_deliveries')
      .values(permitted.map(subscription => ({
        delivery_id: `delivery-${uuidv7()}`,
        event_id: event.event_id,
        subscriber_id: subscription.subscriber_id,
        target_type: subscription.target_type,
        target_key: subscription.target_key,
        status: 'pending',
        payload: {
          eventId: event.event_id,
          eventType: event.event_type,
          aggregateType: event.aggregate_type,
          aggregateId: event.aggregate_id,
          requestId: event.request_id,
          correlationId: event.correlation_id,
          visibility: event.visibility,
          classification: event.classification,
        },
        available_at: now,
        lease_owner: null,
        lease_expires_at: null,
        attempt_count: 0,
        maximum_attempts: 5,
        failure_code: null,
        failure_message: null,
        delivered_at: null,
        created_at: now,
        updated_at: now,
      })))
      .onConflict(conflict => conflict.columns(['event_id', 'subscriber_id']).doNothing())
      .execute()
  }
}

export class GreenfieldEventBus {
  constructor(private readonly db: Db) {}

  publish(input: GreenfieldDomainEventInput): Promise<GreenfieldDomainEventRecord> {
    return new GreenfieldDomainEventRepository(this.db).append(input)
  }
}

export function toGreenfieldDomainEventEnvelope(row: Database['greenfield_domain_events']): GreenfieldDomainEvent<Record<string, unknown>> {
  const envelope: GreenfieldDomainEvent<Record<string, unknown>> = {
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    requestId: row.request_id,
    correlationId: row.correlation_id,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
    visibility: row.visibility,
    classification: row.classification,
    payload: recordFromJson(row.payload),
    metadata: recordFromJson(row.metadata),
  }
  if (row.aggregate_version !== null) envelope.aggregateVersion = row.aggregate_version
  if (row.account_id !== null) envelope.accountId = row.account_id
  if (row.actor_id !== null) envelope.actorId = row.actor_id
  if (row.causation_id !== null) envelope.causationId = row.causation_id
  return envelope
}

function toDomainEventRecord(row: Database['greenfield_domain_events']): GreenfieldDomainEventRecord {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    aggregateVersion: row.aggregate_version,
    accountId: row.account_id,
    actorId: row.actor_id,
    requestId: row.request_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    idempotencyKey: row.idempotency_key,
    visibility: row.visibility,
    classification: row.classification,
    payload: recordFromJson(row.payload),
    metadata: recordFromJson(row.metadata),
    occurredAt: row.occurred_at,
    recordedAt: row.recorded_at,
  }
}

function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as {code?: unknown}).code === '23505')
}

function canRouteEvent(
  event: Database['greenfield_domain_events'],
  subscription: Database['greenfield_event_subscriptions'],
): boolean {
  return subscription.permitted_visibility.includes(event.visibility) && subscription.permitted_classifications.includes(event.classification)
}
