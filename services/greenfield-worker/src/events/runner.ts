import type {GreenfieldDomainEvent} from '@modula/greenfield-contracts'
import type {WorkerConfig} from '../config.js'
import type {Database, ModulaWorkerDb} from '../database.js'
import {handleSearchIndex} from '../search/index.js'
import {
  claimNextEventDelivery,
  completeEventDelivery,
  deadLetterEventDelivery,
  markEventDeliveryProcessing,
  scheduleEventDeliveryRetry,
} from './claim.js'
import {
  completeInboxProcessing,
  failInboxProcessing,
  skipInboxProcessing,
  startInboxProcessing,
} from './inbox.js'
import {errorCodeFor, isPermanentFailure, messageFor, PermanentJobError} from '../jobs/errors.js'
import {computeNextAvailableAt} from '../jobs/retry.js'

export type EventSubscriberContext = {
  delivery: Database['greenfield_event_deliveries']
  event: GreenfieldDomainEvent<Record<string, unknown>>
  subscription: Database['greenfield_event_subscriptions'] | null
}

export type EventSubscriberHandler = (
  db: ModulaWorkerDb,
  context: EventSubscriberContext,
  config: WorkerConfig,
) => Promise<void>

export type EventSubscriberRegistry = Record<string, EventSubscriberHandler>

export async function processOneEventDelivery(
  db: ModulaWorkerDb,
  config: WorkerConfig,
  handlers: EventSubscriberRegistry = {},
): Promise<boolean> {
  const delivery = await claimNextEventDelivery(db, config.workerId, config.leaseDurationMs)
  if (!delivery) return false

  await markEventDeliveryProcessing(db, delivery.delivery_id)

  const eventRow = await db
    .selectFrom('greenfield_domain_events')
    .selectAll()
    .where('event_id', '=', delivery.event_id)
    .executeTakeFirst()
  if (!eventRow) {
    await deadLetterEventDelivery(db, delivery.delivery_id, 'EVENT_NOT_FOUND', 'Domain event no longer exists')
    return true
  }

  const event = toEnvelope(eventRow)
  const inboxState = await startInboxProcessing(db, delivery.subscriber_id, delivery.event_id)
  if (inboxState === 'already-completed') {
    await completeEventDelivery(db, delivery.delivery_id)
    return true
  }

  const subscription = await db
    .selectFrom('greenfield_event_subscriptions')
    .selectAll()
    .where('event_type', '=', event.eventType)
    .where('subscriber_id', '=', delivery.subscriber_id)
    .where('enabled', '=', true)
    .executeTakeFirst()

  if (subscription && !canRouteEvent(event, subscription)) {
    await skipInboxProcessing(db, delivery.subscriber_id, delivery.event_id)
    await completeEventDelivery(db, delivery.delivery_id)
    return true
  }

  try {
    const handler = resolveHandler(delivery, handlers)
    const timeoutMs = Math.min(config.eventSubscriberTimeoutMs, subscription?.subscriber_timeout_ms ?? config.eventSubscriberTimeoutMs)
    await withTimeout(handler(db, {delivery, event, subscription: subscription ?? null}, config), timeoutMs, delivery.subscriber_id)
    await completeInboxProcessing(db, delivery.subscriber_id, delivery.event_id)
    await completeEventDelivery(db, delivery.delivery_id)
  } catch (error: unknown) {
    const code = sanitizeFailureCode(errorCodeFor(error))
    const message = sanitizeFailureMessage(messageFor(error))
    await failInboxProcessing(db, delivery.subscriber_id, delivery.event_id, code)
    const permanent = isPermanentFailure(error) || delivery.attempt_count >= delivery.maximum_attempts
    if (permanent) {
      await deadLetterEventDelivery(db, delivery.delivery_id, code, message)
    } else {
      await scheduleEventDeliveryRetry(db, delivery.delivery_id, computeNextAvailableAt(delivery.attempt_count + 1), code, message)
    }
  }

  return true
}

function resolveHandler(delivery: Database['greenfield_event_deliveries'], handlers: EventSubscriberRegistry): EventSubscriberHandler {
  return (
    handlers[`${delivery.target_type}:${delivery.target_key}`] ??
    handlers[delivery.target_type] ??
    defaultHandlerFor(delivery)
  )
}

function defaultHandlerFor(delivery: Database['greenfield_event_deliveries']): EventSubscriberHandler {
  if (delivery.target_type === 'search-index') return handleSearchDelivery
  if (delivery.target_type === 'notification' || delivery.target_type === 'background-job') return enqueueBackgroundJobDelivery
  if (delivery.target_type === 'internal-subscriber') return async () => {}
  throw new PermanentJobError('UNSUPPORTED_RECORD_TYPE', `Unsupported event subscriber target ${delivery.target_type}:${delivery.target_key}`)
}

async function handleSearchDelivery(db: ModulaWorkerDb, context: EventSubscriberContext): Promise<void> {
  await handleSearchIndex(db, {
    event: context.event,
    projectorId: context.delivery.subscriber_id,
    resourceType: context.event.aggregateType,
    resourceId: context.event.aggregateId,
    eventId: context.event.eventId,
    eventType: context.event.eventType,
    sourceVersion: context.event.aggregateVersion,
    correlationId: context.event.correlationId,
  })
}

async function enqueueBackgroundJobDelivery(
  db: ModulaWorkerDb,
  context: EventSubscriberContext,
): Promise<void> {
  const now = new Date()
  const jobType = context.delivery.target_key
  const jobId = `job-event-${context.delivery.delivery_id}`
  await db
    .insertInto('background_jobs')
    .values({
      id: jobId,
      job_type: jobType,
      payload: {
        event: context.event,
        deliveryId: context.delivery.delivery_id,
        subscriberId: context.delivery.subscriber_id,
      },
      status: 'pending',
      priority: 100,
      available_at: now,
      lease_owner: null,
      lease_expires_at: null,
      attempt_count: 0,
      maximum_attempts: 5,
      last_error: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
    })
    .onConflict(conflict => conflict.column('id').doNothing())
    .execute()
}

function toEnvelope(row: Database['greenfield_domain_events']): GreenfieldDomainEvent<Record<string, unknown>> {
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

function recordFromJson(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function canRouteEvent(
  event: GreenfieldDomainEvent,
  subscription: Database['greenfield_event_subscriptions'],
): boolean {
  return subscription.permitted_visibility.includes(event.visibility) && subscription.permitted_classifications.includes(event.classification)
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, subscriberId: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(Object.assign(new Error(`Subscriber ${subscriberId} timed out`), {code: 'SUBSCRIBER_TIMEOUT'}))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

function sanitizeFailureCode(code: string): string {
  return code.replace(/[^A-Z0-9_.:-]/gi, '_').slice(0, 120) || 'UNKNOWN_ERROR'
}

function sanitizeFailureMessage(message: string): string {
  return message
    .replace(/(access|refresh|id|client)?_?token[=:\s]+[^\s,;}]+/gi, '$1_token=[redacted]')
    .replace(/(secret|password|private_key|pkce_verifier)[=:\s]+[^\s,;}]+/gi, '$1=[redacted]')
    .slice(0, 500)
}
