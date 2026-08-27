import {createHash} from 'node:crypto'
import type {ModulaWorkerDb} from '../database.js'

type DispatchPayload = {
  event?: {eventId?: string; eventType?: string; accountId?: string; requestId?: string; traceId?: string; payload?: Record<string, unknown>}
  subscriberId?: string
}

/** Routes a redacted domain-event envelope into an account-scoped extension job. */
export async function handleExtensionEventDispatch(db: ModulaWorkerDb, payload: unknown): Promise<void> {
  const input = (payload ?? {}) as DispatchPayload
  const event = input.event
  if (!event?.eventId || !event.eventType || !event.accountId || !input.subscriberId) {
    throw Object.assign(new Error('Invalid extension.event.dispatch payload'), {code: 'VALIDATION_FAILED'})
  }
  const extensionDb = db as any
  const subscription = await extensionDb
    .selectFrom('greenfield_extension_event_subscriptions')
    .selectAll()
    .where('subscription_id', '=', input.subscriberId)
    .where('account_id', '=', event.accountId)
    .where('event_type', '=', event.eventType)
    .where('status', '=', 'enabled')
    .executeTakeFirst()
  if (!subscription || event.payload?.moduleId !== subscription.target_product_id) return
  const projection = await extensionDb
    .selectFrom('greenfield_extension_runtime_projection')
    .selectAll()
    .where('account_id', '=', event.accountId)
    .where('installation_id', '=', subscription.installation_id)
    .where('state', '=', 'ENABLED')
    .executeTakeFirst()
  if (!projection) return
  const grant = await extensionDb
    .selectFrom('greenfield_extension_capability_grants')
    .select('grant_id')
    .where('account_id', '=', event.accountId)
    .where('consumer_installation_id', '=', subscription.installation_id)
    .where('capability', '=', subscription.required_capability)
    .where('state', '=', 'granted')
    .executeTakeFirst()
  if (!grant) return

  const executionId = `extension-event-job:${sha256(`${event.eventId}:${input.subscriberId}`).slice(0, 40)}`
  const now = new Date()
  await extensionDb.transaction().execute(async (trx: any) => {
    await trx
      .insertInto('greenfield_extension_job_executions')
      .values({
        execution_id: executionId,
        job_registration_id: null,
        account_id: event.accountId,
        owner_installation_id: subscription.installation_id,
        extension_product_id: subscription.extension_product_id,
        target_product_id: subscription.target_product_id,
        action_id: `event:${event.eventType}`,
        status: 'QUEUED',
        attempt_count: 0,
        maximum_attempts: 3,
        idempotency_key: event.eventId,
        request_id: event.requestId ?? event.eventId,
        failure_code: null,
        input_hash: sha256(JSON.stringify({eventId: event.eventId, eventType: event.eventType})),
        redacted_metadata: {eventId: event.eventId, eventType: event.eventType},
        available_at: now,
        started_at: null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc: any) => oc.columns(['owner_installation_id', 'idempotency_key']).doNothing())
      .execute()
    await trx
      .insertInto('background_jobs')
      .values({
        id: `job-${executionId}`,
        job_type: 'extension.job.execute',
        payload: {executionId, accountId: event.accountId, extensionProductId: subscription.extension_product_id, requestId: event.requestId ?? event.eventId},
        status: 'QUEUED',
        action: 'extension.job.execute',
        trace_id: event.traceId ?? event.requestId ?? event.eventId,
        priority: 100,
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
      .onConflict((oc: any) => oc.column('id').doNothing())
      .execute()
    await trx
      .updateTable('greenfield_extension_event_subscriptions')
      .set({last_delivery_at: now, updated_at: now})
      .where('subscription_id', '=', input.subscriberId)
      .where('account_id', '=', event.accountId)
      .execute()
  })
}

function sha256(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}
