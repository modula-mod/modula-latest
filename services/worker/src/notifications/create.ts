import {randomUUID} from 'node:crypto'
import type {WorkerDb} from '../database.js'

export async function handleNotificationCreate(db: WorkerDb, payload: Record<string, unknown>) {
  const recipientActorId = String(payload.recipientActorId ?? '')
  const actorId = String(payload.actorId ?? '')
  const allowed = new Set(['follow', 'like', 'repost', 'reply', 'mention', 'module_event'] as const)
  const rawType = String(payload.type ?? 'module_event')
  const type = (allowed.has(rawType as any) ? rawType : 'module_event') as
    | 'follow'
    | 'like'
    | 'repost'
    | 'reply'
    | 'mention'
    | 'module_event'
  if (!recipientActorId || recipientActorId === actorId) return
  const body =
    type === 'follow'
      ? 'started following you'
      : type === 'like'
        ? 'liked your post'
        : type === 'repost'
          ? 'reposted your post'
          : 'sent a notification'
  await db
    .insertInto('notifications')
    .values({
      id: randomUUID(),
      recipient_actor_id: recipientActorId,
      actor_id: actorId || null,
      type,
      resource_type: (payload.resourceType as string) ?? null,
      resource_id: (payload.resourceId as string) ?? null,
      body,
      read_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      version: 1,
    })
    .execute()
}
