import {AtpAgent} from '@atproto/api'
import {PermanentJobError, TransientJobError} from '../jobs/errors.js'
import {createSafeFetch} from './ssrf-guard.js'

export interface CreatedRecordResult {
  uri: string
  cid: string
}

/**
 * Narrow surface Modula's AT publish/update/delete handlers depend on.
 * Kept as an interface (rather than depending on `AtpAgent` directly in
 * handler code) so tests can inject a mock without any network or real
 * OAuth session material.
 */
export interface PdsPublisherClient {
  createRecord(collection: string, record: Record<string, unknown>, rkey?: string): Promise<CreatedRecordResult>
  putRecord(collection: string, rkey: string, record: Record<string, unknown>): Promise<CreatedRecordResult>
  deleteRecord(collection: string, rkey: string): Promise<void>
}

/**
 * Decrypted shape expected in `atproto_oauth_sessions.encrypted_session`.
 * This is Modula's stored-session contract for the worker; services/api's
 * official `@atproto/oauth-client-node` integration must persist session
 * material in this shape (or the worker's decrypt step will fail closed
 * with OAUTH_SESSION_UNAVAILABLE rather than publish something wrong).
 */
export type StoredPdsSession = {
  did: string
  handle?: string
  accessJwt?: string
  refreshJwt?: string
}

export type PdsClientOptions = {
  allowPrivateNetworks?: boolean
}

async function wrapPdsCall<T>(action: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (error: any) {
    const status = error?.status
    if (typeof status === 'number' && status >= 400 && status < 500) {
      throw new PermanentJobError('VALIDATION_FAILED', `PDS rejected ${action}: ${error?.message ?? status}`)
    }
    throw new TransientJobError('PDS_UNAVAILABLE', `PDS ${action} failed: ${error?.message ?? 'unknown error'}`)
  }
}

/**
 * Builds a real `PdsPublisherClient` backed by `@atproto/api`'s `AtpAgent`.
 * All outbound requests go through the SSRF-guarded fetch. Session material
 * must already have been decrypted by the caller (see session-crypto.ts).
 */
export async function createAtpAgentPublisherClient(
  pdsUrl: string,
  session: StoredPdsSession,
  options: PdsClientOptions = {},
): Promise<PdsPublisherClient> {
  if (!session.accessJwt || !session.refreshJwt) {
    throw new PermanentJobError(
      'INSUFFICIENT_OAUTH_SCOPE',
      'Stored AT Protocol session is missing access/refresh tokens',
    )
  }

  const agent = new AtpAgent({
    service: pdsUrl,
    fetch: createSafeFetch({allowPrivateNetworks: options.allowPrivateNetworks}),
  })

  await wrapPdsCall('session resume', () =>
    agent.resumeSession({
      did: session.did as `did:${string}:${string}`,
      handle: session.handle ?? session.did,
      accessJwt: session.accessJwt!,
      refreshJwt: session.refreshJwt!,
      active: true,
    }),
  )

  return {
    async createRecord(collection, record, rkey) {
      const result = await wrapPdsCall('createRecord', () =>
        agent.com.atproto.repo.createRecord({
          repo: session.did,
          collection,
          rkey,
          record: {$type: collection, ...record},
        }),
      )
      return {uri: result.data.uri, cid: result.data.cid}
    },
    async putRecord(collection, rkey, record) {
      const result = await wrapPdsCall('putRecord', () =>
        agent.com.atproto.repo.putRecord({
          repo: session.did,
          collection,
          rkey,
          record: {$type: collection, ...record},
        }),
      )
      return {uri: result.data.uri, cid: result.data.cid}
    },
    async deleteRecord(collection, rkey) {
      await wrapPdsCall('deleteRecord', () =>
        agent.com.atproto.repo.deleteRecord({repo: session.did, collection, rkey}),
      )
    },
  }
}
