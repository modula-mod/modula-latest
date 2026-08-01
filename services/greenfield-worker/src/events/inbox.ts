import type {ModulaWorkerDb} from '../database.js'

export type EventInboxStartResult = 'started' | 'already-completed'

export async function startInboxProcessing(
  db: ModulaWorkerDb,
  subscriberId: string,
  eventId: string,
  now: Date = new Date(),
): Promise<EventInboxStartResult> {
  const existing = await db
    .selectFrom('greenfield_event_inbox')
    .select(['processing_state'])
    .where('subscriber_id', '=', subscriberId)
    .where('event_id', '=', eventId)
    .executeTakeFirst()

  if (existing?.processing_state === 'completed') return 'already-completed'

  if (!existing) {
    await db
      .insertInto('greenfield_event_inbox')
      .values({
        subscriber_id: subscriberId,
        event_id: eventId,
        processing_state: 'processing',
        first_received_at: now,
        last_attempted_at: now,
        completed_at: null,
        attempt_count: 1,
        failure_code: null,
      })
      .execute()
    return 'started'
  }

  await db
    .updateTable('greenfield_event_inbox')
    .set(eb => ({
      processing_state: 'processing',
      last_attempted_at: now,
      attempt_count: eb('attempt_count', '+', 1),
      failure_code: null,
    }))
    .where('subscriber_id', '=', subscriberId)
    .where('event_id', '=', eventId)
    .execute()

  return 'started'
}

export async function completeInboxProcessing(
  db: ModulaWorkerDb,
  subscriberId: string,
  eventId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_inbox')
    .set({
      processing_state: 'completed',
      completed_at: now,
      last_attempted_at: now,
      failure_code: null,
    })
    .where('subscriber_id', '=', subscriberId)
    .where('event_id', '=', eventId)
    .execute()
}

export async function skipInboxProcessing(
  db: ModulaWorkerDb,
  subscriberId: string,
  eventId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_inbox')
    .set({
      processing_state: 'skipped',
      completed_at: now,
      last_attempted_at: now,
      failure_code: null,
    })
    .where('subscriber_id', '=', subscriberId)
    .where('event_id', '=', eventId)
    .execute()
}

export async function failInboxProcessing(
  db: ModulaWorkerDb,
  subscriberId: string,
  eventId: string,
  failureCode: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .updateTable('greenfield_event_inbox')
    .set({
      processing_state: 'failed',
      last_attempted_at: now,
      failure_code: failureCode,
    })
    .where('subscriber_id', '=', subscriberId)
    .where('event_id', '=', eventId)
    .execute()
}
