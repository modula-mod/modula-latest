import {ATPROTO_INGEST_COLLECTIONS} from '@modula/atproto-lexicons'
import type {WorkerConfig} from '../../config.js'
import type {ModulaWorkerDb} from '../../database.js'
import {TransientJobError} from '../../jobs/errors.js'
import {isLexiconDisabled, isOperationalFlagSet} from './session.js'
import {createSafeFetch} from './ssrf-guard.js'
import {validateIngestedRecord} from './validate-record.js'

interface ListRecordsResponse {
  cursor?: string
  records?: Array<{uri: string; cid: string; value: Record<string, unknown>}>
}

function checkpointSource(connectionId: string, collection: string): string {
  return `connection:${connectionId}:${collection}`
}

/**
 * Selective ingestion of a connected actor's *own* public repo — not a
 * Relay or AppView crawl of the network. Only Modula's experimental
 * lexicons plus `app.bsky.feed.post` (for the read-only "atmosphere" view)
 * are ever pulled, and only for actors who connected an AT Protocol
 * account. `com.atproto.repo.listRecords` is a public, unauthenticated
 * endpoint, so this does not need to decrypt any OAuth session material.
 */
export async function ingestConnection(
  db: ModulaWorkerDb,
  config: WorkerConfig,
  connectionId: string,
): Promise<{ingested: number}> {
  if (await isOperationalFlagSet(db, 'atproto.ingest.paused', false)) return {ingested: 0}

  const connection = await db
    .selectFrom('atproto_connections')
    .selectAll()
    .where('id', '=', connectionId)
    .where('deleted_at', 'is', null)
    .executeTakeFirst()
  if (!connection || connection.status !== 'connected') return {ingested: 0}

  const safeFetch = createSafeFetch({allowPrivateNetworks: config.ssrfAllowPrivateNetworks})
  let ingested = 0

  for (const collection of ATPROTO_INGEST_COLLECTIONS) {
    if (await isLexiconDisabled(db, collection)) continue
    const source = checkpointSource(connectionId, collection)
    const checkpoint = await db.selectFrom('atproto_sync_checkpoints').selectAll().where('source', '=', source).executeTakeFirst()
    let cursor = checkpoint?.cursor || undefined

    // Bounded pages per run so one slow/huge collection can't starve the others.
    for (let page = 0; page < 5; page++) {
      const url = new URL('/xrpc/com.atproto.repo.listRecords', connection.pds_url)
      url.searchParams.set('repo', connection.did)
      url.searchParams.set('collection', collection)
      url.searchParams.set('limit', '50')
      if (cursor) url.searchParams.set('cursor', cursor)

      let response: Response
      try {
        response = await safeFetch(url.toString())
      } catch (error) {
        throw new TransientJobError('PDS_UNAVAILABLE', `listRecords request failed: ${error instanceof Error ? error.message : String(error)}`)
      }

      if (!response.ok) {
        if (response.status >= 500) {
          throw new TransientJobError('PDS_UNAVAILABLE', `listRecords returned ${response.status} for ${collection}`)
        }
        break // 4xx (e.g. collection absent on this PDS) — move to the next collection
      }

      const body = (await response.json()) as ListRecordsResponse
      const records = body.records ?? []
      const now = new Date()

      for (const record of records) {
        const rkey = record.uri.split('/').pop() ?? ''
        if (!rkey) continue
        const validated = validateIngestedRecord(collection, record.value)
        if (!validated.ok) continue // upstream data we choose not to mirror; not a job failure

        await db
          .insertInto('atproto_records')
          .values({
            did: connection.did,
            collection,
            rkey,
            uri: record.uri,
            cid: record.cid,
            record_json: record.value,
            indexed_at: now,
            deleted_at: null,
            source_cursor: body.cursor ?? null,
            created_at: now,
            updated_at: now,
          })
          .onConflict(oc =>
            oc.columns(['did', 'collection', 'rkey']).doUpdateSet({
              uri: record.uri,
              cid: record.cid,
              record_json: record.value,
              indexed_at: now,
              source_cursor: body.cursor ?? null,
              updated_at: now,
              deleted_at: null,
            }),
          )
          .execute()
        ingested += 1
      }

      cursor = body.cursor
      const checkpointNow = new Date()
      await db
        .insertInto('atproto_sync_checkpoints')
        .values({source, cursor: cursor ?? '', updated_at: checkpointNow, last_success_at: checkpointNow})
        .onConflict(oc => oc.column('source').doUpdateSet({cursor: cursor ?? '', updated_at: checkpointNow, last_success_at: checkpointNow}))
        .execute()

      if (!cursor || records.length === 0) break
    }
  }

  return {ingested}
}

/** Iterates all connected actors and ingests each in turn; used by the periodic ingest loop. */
export async function ingestAllConnections(db: ModulaWorkerDb, config: WorkerConfig): Promise<{ingested: number; connections: number}> {
  if (await isOperationalFlagSet(db, 'atproto.ingest.paused', false)) {
    return {ingested: 0, connections: 0}
  }

  const connections = await db
    .selectFrom('atproto_connections')
    .select('id')
    .where('status', '=', 'connected')
    .where('deleted_at', 'is', null)
    .execute()

  let ingested = 0
  for (const {id} of connections) {
    const result = await ingestConnection(db, config, id)
    ingested += result.ingested
  }
  return {ingested, connections: connections.length}
}
