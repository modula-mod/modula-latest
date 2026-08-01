import type {Kysely} from 'kysely'
import type {ModulaDb} from '../database/client.js'
import type {Database, EventDataClassification, EventVisibility} from '../database/types.js'
import {AuditRepository} from '../domains/audit/repository.js'
import {uuidv7} from '../lib/uuidv7.js'

type Db = ModulaDb | Kysely<Database>

export type EventReplayMode = 'event' | 'event_type' | 'date_range' | 'aggregate' | 'dead_letters'

export type GreenfieldEventReplayInput = {
  eventId?: string
  eventType?: string
  aggregateType?: string
  aggregateId?: string
  subscriberId?: string
  occurredFrom?: Date
  occurredTo?: Date
  deadLetteredOnly?: boolean
  dryRun?: boolean
  reason: string
  requestedByActorId?: string | null
  requestId: string
  correlationId?: string | null
}

export type GreenfieldEventReplayResult = {
  replayId: string | null
  dryRun: boolean
  mode: EventReplayMode
  plannedCount: number
  replayedCount: number
  cancelled: boolean
}

export class GreenfieldEventReplayService {
  constructor(private readonly db: Db) {}

  async replay(input: GreenfieldEventReplayInput): Promise<GreenfieldEventReplayResult> {
    const mode = replayModeFor(input)
    const events = await this.selectEvents(input)
    const plan = await this.planDeliveries(events, input.subscriberId)

    if (input.dryRun) {
      return {replayId: null, dryRun: true, mode, plannedCount: plan.length, replayedCount: 0, cancelled: false}
    }

    const now = new Date()
    const replayId = `replay-${uuidv7()}`
    const selector = selectorFor(input)
    const correlationId = input.correlationId ?? input.requestId

    const replayedCount = await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('greenfield_event_replay_requests')
        .values({
          replay_id: replayId,
          mode,
          requested_by_actor_id: input.requestedByActorId ?? null,
          reason: input.reason,
          request_id: input.requestId,
          correlation_id: correlationId,
          selector,
          dry_run: false,
          state: 'running',
          planned_count: plan.length,
          replayed_count: 0,
          failure_code: null,
          created_at: now,
          updated_at: now,
          completed_at: null,
        })
        .execute()

      let replayed = 0
      for (const item of plan) {
        if (await replayCancelled(trx, replayId)) break
        const deliveryId = `delivery-${uuidv7()}`
        await trx
          .insertInto('greenfield_event_deliveries')
          .values({
            delivery_id: deliveryId,
            event_id: item.event.event_id,
            subscriber_id: item.subscription.subscriber_id,
            target_type: item.subscription.target_type,
            target_key: item.subscription.target_key,
            status: 'pending',
            payload: {
              eventId: item.event.event_id,
              eventType: item.event.event_type,
              aggregateType: item.event.aggregate_type,
              aggregateId: item.event.aggregate_id,
              requestId: item.event.request_id,
              correlationId: correlationId,
              replayId,
              visibility: item.event.visibility,
              classification: item.event.classification,
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
          })
          .onConflict(conflict => conflict.columns(['event_id', 'subscriber_id']).doUpdateSet({
            status: 'pending',
            available_at: now,
            lease_owner: null,
            lease_expires_at: null,
            failure_code: null,
            failure_message: null,
            updated_at: now,
          }))
          .execute()
        replayed += 1
      }

      const cancelled = await replayCancelled(trx, replayId)
      await trx
        .updateTable('greenfield_event_replay_requests')
        .set({
          state: cancelled ? 'cancelled' : 'completed',
          replayed_count: replayed,
          updated_at: now,
          completed_at: now,
        })
        .where('replay_id', '=', replayId)
        .execute()
      await new AuditRepository(trx).append('admin.events.replay.completed', {replayId, mode, plannedCount: plan.length, replayedCount: replayed, cancelled}, {
        type: 'eventReplay',
        id: replayId,
        actorId: input.requestedByActorId ?? null,
      })
      return replayed
    })

    return {replayId, dryRun: false, mode, plannedCount: plan.length, replayedCount, cancelled: replayedCount < plan.length}
  }

  async retryDeadLetters(input: Omit<GreenfieldEventReplayInput, 'deadLetteredOnly'>): Promise<GreenfieldEventReplayResult> {
    return this.replay({...input, deadLetteredOnly: true})
  }

  async inspectSubscriberFailures(subscriberId?: string): Promise<Array<{
    deliveryId: string
    eventId: string
    eventType: string
    subscriberId: string
    status: string
    attemptCount: number
    failureCode: string | null
    updatedAt: string
  }>> {
    let query = this.db
      .selectFrom('greenfield_event_deliveries as delivery')
      .innerJoin('greenfield_domain_events as event', 'event.event_id', 'delivery.event_id')
      .select([
        'delivery.delivery_id as deliveryId',
        'delivery.event_id as eventId',
        'event.event_type as eventType',
        'delivery.subscriber_id as subscriberId',
        'delivery.status as status',
        'delivery.attempt_count as attemptCount',
        'delivery.failure_code as failureCode',
        'delivery.updated_at as updatedAt',
      ])
      .where('delivery.status', 'in', ['retrying', 'dead_lettered'])
      .orderBy('delivery.updated_at', 'desc')
      .limit(100)

    if (subscriberId) query = query.where('delivery.subscriber_id', '=', subscriberId)
    const rows = await query.execute()
    return rows.map(row => ({
      deliveryId: row.deliveryId,
      eventId: row.eventId,
      eventType: row.eventType,
      subscriberId: row.subscriberId,
      status: row.status,
      attemptCount: row.attemptCount,
      failureCode: row.failureCode,
      updatedAt: row.updatedAt.toISOString(),
    }))
  }

  async cancelReplay(replayId: string, actorId: string | null, reason: string): Promise<boolean> {
    const now = new Date()
    const result = await this.db.transaction().execute(async trx => {
      const updated = await trx
        .updateTable('greenfield_event_replay_requests')
        .set({state: 'cancelled', failure_code: 'OPERATOR_CANCELLED', updated_at: now, completed_at: now})
        .where('replay_id', '=', replayId)
        .where('state', 'in', ['planned', 'running'])
        .executeTakeFirst()
      await trx
        .updateTable('greenfield_event_deliveries')
        .set({status: 'cancelled', updated_at: now, lease_owner: null, lease_expires_at: null})
        .where('payload', '@>', {replayId} as never)
        .where('status', 'in', ['pending', 'retrying', 'leased', 'processing'])
        .execute()
      await new AuditRepository(trx).append('admin.events.replay.cancelled', {replayId, reason}, {type: 'eventReplay', id: replayId, actorId})
      return Number(updated.numUpdatedRows ?? 0n) > 0
    })
    return result
  }

  private async selectEvents(input: GreenfieldEventReplayInput): Promise<Database['greenfield_domain_events'][]> {
    let query = this.db.selectFrom('greenfield_domain_events').selectAll().orderBy('occurred_at', 'asc').limit(500)
    if (input.eventId) query = query.where('event_id', '=', input.eventId)
    if (input.eventType) query = query.where('event_type', '=', input.eventType)
    if (input.aggregateType) query = query.where('aggregate_type', '=', input.aggregateType)
    if (input.aggregateId) query = query.where('aggregate_id', '=', input.aggregateId)
    if (input.occurredFrom) query = query.where('occurred_at', '>=', input.occurredFrom)
    if (input.occurredTo) query = query.where('occurred_at', '<=', input.occurredTo)
    if (input.deadLetteredOnly) {
      query = query.where(({exists, selectFrom, ref}) =>
        exists(
          selectFrom('greenfield_event_deliveries')
            .select('delivery_id')
            .whereRef('event_id', '=', ref('greenfield_domain_events.event_id'))
            .where('status', '=', 'dead_lettered'),
        ),
      )
    }
    return query.execute()
  }

  private async planDeliveries(
    events: Database['greenfield_domain_events'][],
    subscriberId?: string,
  ): Promise<Array<{event: Database['greenfield_domain_events']; subscription: Database['greenfield_event_subscriptions']}>> {
    const plan: Array<{event: Database['greenfield_domain_events']; subscription: Database['greenfield_event_subscriptions']}> = []
    for (const event of events) {
      let query = this.db
        .selectFrom('greenfield_event_subscriptions')
        .selectAll()
        .where('event_type', '=', event.event_type)
        .where('enabled', '=', true)
      if (subscriberId) query = query.where('subscriber_id', '=', subscriberId)
      const subscriptions = await query.execute()
      for (const subscription of subscriptions) {
        if (canRouteEvent(event, subscription)) plan.push({event, subscription})
      }
    }
    return plan
  }
}

function replayModeFor(input: GreenfieldEventReplayInput): EventReplayMode {
  if (input.deadLetteredOnly) return 'dead_letters'
  if (input.eventId) return 'event'
  if (input.aggregateType || input.aggregateId) return 'aggregate'
  if (input.occurredFrom || input.occurredTo) return 'date_range'
  return 'event_type'
}

function selectorFor(input: GreenfieldEventReplayInput): Record<string, unknown> {
  return {
    eventId: input.eventId,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    subscriberId: input.subscriberId,
    occurredFrom: input.occurredFrom?.toISOString(),
    occurredTo: input.occurredTo?.toISOString(),
    deadLetteredOnly: Boolean(input.deadLetteredOnly),
  }
}

async function replayCancelled(db: Db, replayId: string): Promise<boolean> {
  const row = await db
    .selectFrom('greenfield_event_replay_requests')
    .select('state')
    .where('replay_id', '=', replayId)
    .executeTakeFirst()
  return row?.state === 'cancelled'
}

function canRouteEvent(
  event: {visibility: EventVisibility; classification: EventDataClassification},
  subscription: Database['greenfield_event_subscriptions'],
): boolean {
  return subscription.permitted_visibility.includes(event.visibility) && subscription.permitted_classifications.includes(event.classification)
}
