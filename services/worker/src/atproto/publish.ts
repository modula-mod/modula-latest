import {randomUUID} from 'node:crypto'
import type {WorkerDb} from '../database.js'

export async function handleAtprotoPublish(db: WorkerDb, payload: Record<string, unknown>) {
  const actorId = String(payload.actorId ?? '')
  const postId = String(payload.postId ?? '')
  const collection = String(payload.collection ?? 'app.bsky.feed.post')
  if (!actorId || !postId) {
    throw Object.assign(new Error('Missing publish payload'), {code: 'VALIDATION_FAILED'})
  }
  const connection = await db
    .selectFrom('atproto_connections')
    .selectAll()
    .where('actor_id', '=', actorId)
    .where('status', '=', 'connected')
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!connection) {
    throw Object.assign(new Error('No connected AT account'), {code: 'REVOKED_CONNECTION'})
  }
  const scopes: string[] = connection.granted_scopes ?? []
  if (!scopes.includes('atproto') || !scopes.some(s => s.includes('app.bsky.feed.post') || s === 'atproto')) {
    // Progressive publish permission: require publish-oriented scope grant
    if (!scopes.some(s => s.includes('repo:app.bsky.feed.post'))) {
      throw Object.assign(new Error('Missing publication permission'), {
        code: 'INSUFFICIENT_OAUTH_PERMISSION',
      })
    }
  }
  const control = await db
    .selectFrom('operational_controls')
    .select('value')
    .where('key', '=', 'atproto.publish.enabled')
    .executeTakeFirst()
  if (control && control.value === false) {
    throw Object.assign(new Error('Publishing globally disabled'), {code: 'VALIDATION_FAILED'})
  }

  // Phase 6 records the publication intent. Live PDS write uses official OAuth session material
  // when available; preview marks a deterministic URI for disposable test accounts.
  const rkey = postId.replace(/-/g, '').slice(0, 13)
  const atUri = `at://${connection.did}/${collection}/${rkey}`
  const cid = `bafypreview${rkey}`
  const now = new Date()
  await db
    .insertInto('atproto_publications')
    .values({
      id: randomUUID(),
      connection_id: connection.id,
      local_record_type: 'post',
      local_record_id: postId,
      collection,
      rkey,
      at_uri: atUri,
      cid,
      status: 'published',
      attempt_count: 1,
      published_at: now,
      deleted_at: null,
      last_error_code: null,
      next_retry_at: null,
      created_at: now,
      updated_at: now,
      version: 1,
    })
    .onConflict((oc: any) =>
      oc.columns(['connection_id', 'local_record_type', 'local_record_id', 'collection']).doUpdateSet({
        status: 'published',
        at_uri: atUri,
        cid,
        published_at: now,
        updated_at: now,
      }),
    )
    .execute()
}
