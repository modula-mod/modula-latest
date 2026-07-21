import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'
import {OutboxRepository} from '../outbox/repository.js'

const MENTION = /(^|[^\w])@([a-z0-9][a-z0-9.-]{1,62})\b/gi
export class MentionService {
  constructor(private readonly db: ModulaDb) {}
  async extractMentions(text: string): Promise<string[]> {
    return [...new Set(Array.from(text.matchAll(MENTION), match => match[2]?.toLowerCase()).filter((handle): handle is string => Boolean(handle)))]
  }
  async storeMentions(actorId: string, sourceType: 'post' | 'comment', sourceId: string, text: string) {
    const handles = await this.extractMentions(text)
    if (handles.length > 25) throw Object.assign(new Error('Too many mentions'), {code: 'VALIDATION_FAILED'})
    if (handles.length === 0) return []
    const recent = await this.db.selectFrom('greenfield_mentions').select('mention_id').where('source_type', '=', sourceType).where('source_id', '=', sourceId).execute()
    if (recent.length) return []
    const identities = await this.db.selectFrom('greenfield_handles').selectAll().where('handle', 'in', handles).where('status', '=', 'active').execute()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      for (const identity of identities) {
        const actor = await trx.selectFrom('actors').select('id').where('account_id', '=', identity.account_id).where('deleted_at', 'is', null).executeTakeFirst()
        await trx.insertInto('greenfield_mentions').values({mention_id: randomUUID(), source_type: sourceType, source_id: sourceId, mentioned_account_id: identity.account_id, mentioned_actor_id: actor?.id ?? null, handle_at_mention: identity.handle, created_at: now}).execute()
        if (actor && actor.id !== actorId) await new OutboxRepository(trx).enqueue(trx, {eventType: 'notification.mention', aggregateType: sourceType, aggregateId: sourceId, payload: {actorId, recipientActorId: actor.id, resourceType: sourceType, resourceId: sourceId}})
      }
    })
    return identities.map(row => row.handle)
  }
}
