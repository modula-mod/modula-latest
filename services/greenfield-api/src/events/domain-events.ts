import {randomUUID} from 'node:crypto'
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
  accountId: string | null
  actorId: string | null
  requestId: string | null
  correlationId: string | null
  causationId: string | null
  idempotencyKey: string | null
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
  accountId?: string | null
  actorId?: string | null
  requestId?: string | null
  correlationId?: string | null
  causationId?: string | null
  idempotencyKey?: string | null
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
  enabled?: boolean
}

export class GreenfieldDomainEventRepository {
  constructor(private readonly db: Db) {}

  async append(input: GreenfieldDomainEventInput): Promise<GreenfieldDomainEventRecord> {
    if (input.idempotencyKey) {
      const existing = await this.findByIdempotency(input)
      if (existing) {
        await this.ensureDeliveries(existing)
        return toDomainEventRecord(existing)
      }
    }

    const now = new Date()
    try {
      const inserted = await this.db
        .insertInto('greenfield_domain_events')
        .values({
          event_id: `event-${uuidv7()}`,
          event_type: input.eventType,
          event_version: input.eventVersion ?? '1.0.0',
          aggregate_type: input.aggregateType,
          aggregate_id: input.aggregateId,
          account_id: input.accountId ?? null,
          actor_id: input.actorId ?? null,
          request_id: input.requestId ?? null,
          correlation_id: input.correlationId ?? input.requestId ?? null,
          causation_id: input.causationId ?? null,
          idempotency_key: input.idempotencyKey ?? null,
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
        enabled: input.enabled ?? true,
        created_at: now,
        updated_at: now,
      })
      .onConflict(conflict => conflict.columns(['event_type', 'subscriber_id']).doUpdateSet({
        target_type: input.targetType,
        target_key: input.targetKey,
        filters: input.filters ?? {},
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
    if (subscriptions.length === 0) return

    const now = new Date()
    await this.db
      .insertInto('greenfield_event_deliveries')
      .values(subscriptions.map(subscription => ({
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

function toDomainEventRecord(row: Database['greenfield_domain_events']): GreenfieldDomainEventRecord {
  return {
    eventId: row.event_id,
    eventType: row.event_type,
    eventVersion: row.event_version,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    accountId: row.account_id,
    actorId: row.actor_id,
    requestId: row.request_id,
    correlationId: row.correlation_id,
    causationId: row.causation_id,
    idempotencyKey: row.idempotency_key,
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
