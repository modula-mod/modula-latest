import type {WorkerDb} from '../database.js'

export async function handleAtprotoDelete(db: WorkerDb, payload: Record<string, unknown>) {
  const postId = String(payload.postId ?? '')
  if (!postId) throw Object.assign(new Error('Missing postId'), {code: 'VALIDATION_FAILED'})
  await db
    .updateTable('atproto_publications')
    .set({status: 'deleted', deleted_at: new Date(), updated_at: new Date()})
    .where('local_record_id', '=', postId)
    .where('local_record_type', '=', 'post')
    .execute()
}
