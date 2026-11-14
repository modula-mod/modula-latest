import {randomUUID} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import type {WorkerConfig} from '../src/config.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {claimNextEventDelivery, reapExpiredEventDeliveryLeases} from '../src/events/claim.js'
import {processOneEventDelivery, type EventSubscriberRegistry} from '../src/events/runner.js'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'

describe('Phase 7E event delivery worker source', () => {
  it('uses database leasing and inbox idempotency markers', () => {
    const claim = readFileSync(new URL('../src/events/claim.ts', import.meta.url), 'utf8')
    const runner = readFileSync(new URL('../src/events/runner.ts', import.meta.url), 'utf8')
    expect(claim).toContain('FOR UPDATE SKIP LOCKED')
    expect(claim).toContain("status = 'leased'")
    expect(claim).toContain("status: 'dead_lettered'")
    expect(runner).toContain('startInboxProcessing')
    expect(runner).toContain('already-completed')
    expect(runner).toContain('withTimeout')
  })
})

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('Phase 7E event delivery worker (live database)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID()
  const eventIds: string[] = []
  const deliveryIds: string[] = []
  const subscriberIds: string[] = []

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
  })

  afterAll(async () => {
    if (db) {
      if (deliveryIds.length > 0) {
        await db.deleteFrom('greenfield_event_deliveries').where('delivery_id', 'in', deliveryIds).execute()
      }
      if (subscriberIds.length > 0) {
        await db.deleteFrom('greenfield_event_subscriptions').where('subscriber_id', 'in', subscriberIds).execute()
      }
      if (eventIds.length > 0) {
        await db.deleteFrom('greenfield_domain_events').where('event_id', 'in', eventIds).execute()
      }
      await db.destroy()
    }
  })

  it('leases one delivery, completes the inbox once, retries failures, reaps expired leases and dead-letters exhausted deliveries', async () => {
    const config = workerConfig()

    const effect = await seedDelivery('phase7e.effect', {sequence: 'effect'})
    await db
      .updateTable('greenfield_event_deliveries')
      .set({available_at: new Date(0), created_at: new Date(0)})
      .where('delivery_id', '=', effect.deliveryId)
      .execute()
    let effectCount = 0
    const effectHandlers: EventSubscriberRegistry = {
      'internal-subscriber:phase7e.effect': async () => {
        effectCount += 1
      },
    }

    const claimed = await claimNextEventDelivery(db, 'phase7e-claimer-a', 60_000)
    expect(claimed?.delivery_id).toBe(effect.deliveryId)
    await db
      .updateTable('greenfield_event_deliveries')
      .set({status: 'pending', lease_owner: null, lease_expires_at: null, attempt_count: 0})
      .where('delivery_id', '=', effect.deliveryId)
      .execute()

    await processOneEventDelivery(db, config, effectHandlers)
    expect(effectCount).toBe(1)
    await expectDelivery(effect.deliveryId, 'completed')
    await expectInbox(effect.subscriberId, effect.eventId, 'completed')

    await db
      .updateTable('greenfield_event_deliveries')
      .set({status: 'pending', delivered_at: null, lease_owner: null, lease_expires_at: null, available_at: new Date(0)})
      .where('delivery_id', '=', effect.deliveryId)
      .execute()
    await processOneEventDelivery(db, config, effectHandlers)
    expect(effectCount).toBe(1)
    await expectDelivery(effect.deliveryId, 'completed')

    const retry = await seedDelivery('phase7e.fail-once', {sequence: 'retry'})
    let retryAttempts = 0
    const retryHandlers: EventSubscriberRegistry = {
      'internal-subscriber:phase7e.fail-once': async () => {
        retryAttempts += 1
        if (retryAttempts === 1) throw Object.assign(new Error('transient retry probe'), {code: 'TRANSIENT_PROBE'})
      },
    }
    await processOneEventDelivery(db, config, retryHandlers)
    await expectDelivery(retry.deliveryId, 'retrying')
    await expectInbox(retry.subscriberId, retry.eventId, 'failed')
    await db
      .updateTable('greenfield_event_deliveries')
      .set({available_at: new Date(0)})
      .where('delivery_id', '=', retry.deliveryId)
      .execute()
    await processOneEventDelivery(db, config, retryHandlers)
    expect(retryAttempts).toBe(2)
    await expectDelivery(retry.deliveryId, 'completed')
    await expectInbox(retry.subscriberId, retry.eventId, 'completed')

    const expired = await seedDelivery('phase7e.expired', {sequence: 'lease'})
    await db
      .updateTable('greenfield_event_deliveries')
      .set({
        status: 'processing',
        lease_owner: 'stale-worker',
        lease_expires_at: new Date(Date.now() - 1000),
      })
      .where('delivery_id', '=', expired.deliveryId)
      .execute()
    expect(await reapExpiredEventDeliveryLeases(db)).toBeGreaterThanOrEqual(1)
    await expectDelivery(expired.deliveryId, 'retrying')
    await db
      .updateTable('greenfield_event_deliveries')
      .set({status: 'cancelled'})
      .where('delivery_id', '=', expired.deliveryId)
      .execute()

    const dead = await seedDelivery('phase7e.always-fails', {sequence: 'dead'}, 1)
    const deadHandlers: EventSubscriberRegistry = {
      'internal-subscriber:phase7e.always-fails': async () => {
        throw Object.assign(new Error('subscriber failed with access_token=secret'), {code: 'TRANSIENT_PROBE'})
      },
    }
    await processOneEventDelivery(db, config, deadHandlers)
    await expectDelivery(dead.deliveryId, 'dead_lettered')
    const deadLetter = await db
      .selectFrom('greenfield_event_deliveries')
      .select(['failure_code', 'failure_message'])
      .where('delivery_id', '=', dead.deliveryId)
      .executeTakeFirstOrThrow()
    expect(deadLetter.failure_code).toBe('TRANSIENT_PROBE')
    expect(deadLetter.failure_message).not.toContain('secret')
  })

  async function seedDelivery(targetKey: string, payload: Record<string, unknown>, maximumAttempts = 3) {
    const eventId = `event-phase7e-${suffix}-${randomUUID()}`
    const subscriberId = `subscriber-phase7e-${suffix}-${targetKey}`
    const deliveryId = `delivery-phase7e-${suffix}-${randomUUID()}`
    const now = new Date()
    const queueTime = new Date(0)
    eventIds.push(eventId)
    deliveryIds.push(deliveryId)
    subscriberIds.push(subscriberId)

    await db
      .insertInto('greenfield_domain_events')
      .values({
        event_id: eventId,
        event_type: 'post.created',
        event_version: '1.0.0',
        aggregate_type: 'post',
        aggregate_id: `post-${eventId}`,
        aggregate_version: 1,
        account_id: null,
        actor_id: null,
        producer_kind: 'service',
        producer_id: 'service.greenfield-worker.test',
        product_id: null,
        installation_id: null,
        release_id: null,
        trace_id: `corr-${eventId}`,
        request_id: `req-${eventId}`,
        correlation_id: `corr-${eventId}`,
        causation_id: null,
        idempotency_key: null,
        visibility: 'internal',
        classification: 'internal',
        payload,
        metadata: {test: 'phase7e'},
        occurred_at: now,
        recorded_at: now,
      })
      .execute()

    await db
      .insertInto('greenfield_event_subscriptions')
      .values({
        subscription_id: `subscription-${subscriberId}`,
        event_type: 'post.created',
        subscriber_id: subscriberId,
        target_type: 'internal-subscriber',
        target_key: targetKey,
        filters: {},
        enabled: true,
        permitted_visibility: ['internal'],
        permitted_classifications: ['internal'],
        subscriber_timeout_ms: 1000,
        max_concurrency: 1,
        created_at: now,
        updated_at: now,
      })
      .execute()

    await db
      .insertInto('greenfield_event_deliveries')
      .values({
        delivery_id: deliveryId,
        event_id: eventId,
        subscriber_id: subscriberId,
        target_type: 'internal-subscriber',
        target_key: targetKey,
        status: 'pending',
        payload: {eventId, targetKey},
        available_at: queueTime,
        lease_owner: null,
        lease_expires_at: null,
        attempt_count: 0,
        maximum_attempts: maximumAttempts,
        failure_code: null,
        failure_message: null,
        delivered_at: null,
        created_at: queueTime,
        updated_at: queueTime,
      })
      .execute()

    return {eventId, subscriberId, deliveryId}
  }

  async function expectDelivery(deliveryId: string, status: string): Promise<void> {
    const row = await db
      .selectFrom('greenfield_event_deliveries')
      .select('status')
      .where('delivery_id', '=', deliveryId)
      .executeTakeFirstOrThrow()
    expect(row.status).toBe(status)
  }

  async function expectInbox(subscriberId: string, eventId: string, state: string): Promise<void> {
    const row = await db
      .selectFrom('greenfield_event_inbox')
      .select('processing_state')
      .where('subscriber_id', '=', subscriberId)
      .where('event_id', '=', eventId)
      .executeTakeFirstOrThrow()
    expect(row.processing_state).toBe(state)
  }
})

function workerConfig(): WorkerConfig {
  return {
    nodeEnv: 'test',
    environment: 'development',
    workerId: `worker-phase7e-${randomUUID()}`,
    logLevel: 'silent',
    databaseUrl: testDatabaseUrl as string,
    pollIntervalMs: 1,
    emptyPollBackoffMs: 1,
    leaseDurationMs: 60_000,
    leaseReapIntervalMs: 30_000,
    leaseRenewIntervalMs: 20_000,
    heartbeatIntervalMs: 15_000,
    outboxDrainIntervalMs: 1000,
    outboxBatchSize: 10,
    eventSubscriberTimeoutMs: 1000,
    ingestIntervalMs: 60_000,
    ingestEnabled: false,
    encryptionKeysByVersion: new Map([[1, Buffer.alloc(32, 7)]]),
    encryptionKeyIsEphemeral: true,
    ssrfAllowPrivateNetworks: false,
    moduleRemoteFunctionsEnabled: false,
    moduleCommunityExecutionEnabled: false,
    moduleAllowUntrustedDevelopmentReleases: true,
    moduleGithubSyncEnabled: false,
  }
}
