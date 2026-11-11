import {createDecipheriv} from 'node:crypto'
import {sql} from 'kysely'
import type {ModulaWorkerDb} from '../database.js'
import {classifyApnsResponse, type PushSender} from './apns.js'

/**
 * PushKit VoIP lane for incoming calls. Deliberately separate from the
 * ordinary alert queue (dispatch.ts):
 *
 * - no quiet-hours deferral (CallKit and Focus govern presentation);
 * - `apns-expiration: 0` and priority 10: deliver now or never;
 * - retries only while the call is still ringing and inside its ring
 *   deadline, with a short fixed backoff instead of the 6-attempt ladder;
 * - an invalid VoIP token disables only that VoIP registration, never the
 *   ordinary alert token.
 */

export const VOIP_RETRY_MS = 2_000
export const VOIP_MAX_ATTEMPTS = 4
const LEASE_MS = 10_000

export function loadVoipTokenKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.MODULA_CALLS_VOIP_TOKEN_KEY?.trim()
  if (!raw) return null
  const key = Buffer.from(raw, 'base64')
  return key.length === 32 ? key : null
}

/** Inverse of the API's encryptWithKey: iv(12) || authTag(16) || ciphertext. */
export function decryptVoipToken(blob: Buffer, key: Buffer): string {
  const iv = blob.subarray(0, 12)
  const tag = blob.subarray(12, 28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(blob.subarray(28)), decipher.final()]).toString('utf8')
}

/** Call-only payload: no access, signalling or TURN credential ever rides in a push. */
export function buildVoipPayload(input: {
  callId: string
  conversationId: string
  mediaKind: 'audio' | 'video'
  ringDeadlineAt: Date
  caller: {actorId: string; handle: string | null; displayName: string | null}
}): Record<string, unknown> {
  return {
    aps: {},
    modula: {
      type: 'call.incoming',
      callId: input.callId,
      conversationId: input.conversationId,
      mediaKind: input.mediaKind,
      ringDeadlineAt: input.ringDeadlineAt.toISOString(),
      caller: {
        actorId: input.caller.actorId,
        handle: input.caller.handle,
        displayName: (input.caller.displayName || (input.caller.handle ? `@${input.caller.handle}` : 'Modula')).slice(0, 80),
      },
    },
  }
}

export type VoipPassResult = {claimed: number; sent: number; retried: number; failed: number; cancelled: number; prunedTokens: number}

export async function runVoipPass(
  db: ModulaWorkerDb,
  sender: PushSender,
  options: {key: Buffer; now?: () => Date; batchSize?: number; onAuthError?: () => void},
): Promise<VoipPassResult> {
  const now = options.now ?? (() => new Date())
  const result: VoipPassResult = {claimed: 0, sent: 0, retried: 0, failed: 0, cancelled: 0, prunedTokens: 0}
  const start = now()

  // Anything past its ring deadline or no longer ringing never goes out.
  const stale = await db.updateTable('greenfield_call_device_invitations')
    .set({status: 'expired', updated_at: start, leased_until: null})
    .where('status', 'in', ['queued', 'sending'])
    .where(eb => eb.or([
      eb('deadline_at', '<=', start),
      eb.not(eb.exists(eb.selectFrom('greenfield_calls as c').select('c.call_id')
        .whereRef('c.call_id', '=', 'greenfield_call_device_invitations.call_id').where('c.state', '=', 'ringing'))),
    ]))
    .executeTakeFirst()
  result.cancelled += Number(stale.numUpdatedRows ?? 0)

  const claimed = await db.transaction().execute(async trx => {
    const rows = await trx.selectFrom('greenfield_call_device_invitations as i')
      .innerJoin('greenfield_calls as c', 'c.call_id', 'i.call_id')
      .innerJoin('greenfield_call_push_tokens as t', 't.registration_id', 'i.registration_id')
      .select([
        'i.invitation_id', 'i.call_id', 'i.attempts', 'i.deadline_at', 'i.registration_id',
        'c.conversation_id', 'c.media_kind', 'c.initiator_actor_id', 'c.ring_deadline_at',
        't.token_ciphertext', 't.environment', 't.topic', 't.disabled_at',
      ])
      .where('i.status', '=', 'queued')
      .where('i.next_attempt_at', '<=', start)
      .where('i.deadline_at', '>', start)
      .where('c.state', '=', 'ringing')
      .orderBy('i.next_attempt_at')
      .limit(options.batchSize ?? 25)
      .forUpdate('i').skipLocked()
      .execute()
    if (rows.length > 0) {
      await trx.updateTable('greenfield_call_device_invitations')
        .set({status: 'sending', leased_until: new Date(start.getTime() + LEASE_MS), attempts: sql<number>`attempts + 1`, updated_at: start})
        .where('invitation_id', 'in', rows.map(r => r.invitation_id))
        .execute()
    }
    return rows
  })
  result.claimed = claimed.length

  const finish = (id: string, patch: Record<string, unknown>) =>
    db.updateTable('greenfield_call_device_invitations').set({...patch, leased_until: null, updated_at: now()} as any)
      .where('invitation_id', '=', id).where('status', '=', 'sending').execute()

  for (const row of claimed) {
    if (row.disabled_at) {
      await finish(row.invitation_id, {status: 'cancelled', last_error: 'registration disabled'})
      result.cancelled++
      continue
    }
    // Re-check the call immediately before sending: cancel/accept may have raced the claim.
    const live = await db.selectFrom('greenfield_calls').select('state').where('call_id', '=', row.call_id).executeTakeFirst()
    if (live?.state !== 'ringing' || row.deadline_at.getTime() <= now().getTime()) {
      await finish(row.invitation_id, {status: 'cancelled'})
      result.cancelled++
      continue
    }
    let token: string
    try {
      token = decryptVoipToken(row.token_ciphertext, options.key)
    } catch {
      await finish(row.invitation_id, {status: 'failed', last_error: 'token decryption failed'})
      result.failed++
      continue
    }
    const caller = await db.selectFrom('profiles').select(['handle', 'display_name'])
      .where('actor_id', '=', row.initiator_actor_id).executeTakeFirst()
    const payload = buildVoipPayload({
      callId: row.call_id, conversationId: row.conversation_id, mediaKind: row.media_kind, ringDeadlineAt: row.ring_deadline_at,
      caller: {actorId: row.initiator_actor_id, handle: caller?.handle ?? null, displayName: (caller as any)?.display_name ?? null},
    })
    const response = await sender.send({
      token, environment: row.environment, payload, pushType: 'voip', topic: row.topic, expiration: 0, collapseId: row.call_id,
    })
    const outcome = classifyApnsResponse(response)
    if (outcome === 'sent') {
      await finish(row.invitation_id, {status: 'sent', apns_id: response.apnsId ?? null, last_error: null})
      result.sent++
    } else if (outcome === 'invalid-token') {
      await db.updateTable('greenfield_call_push_tokens')
        .set({disabled_at: now(), disabled_reason: (response.reason ?? `HTTP ${response.status}`).slice(0, 200), updated_at: now()})
        .where('registration_id', '=', row.registration_id).execute()
      await finish(row.invitation_id, {status: 'failed', last_error: (response.reason ?? `HTTP ${response.status}`).slice(0, 500)})
      result.prunedTokens++
      result.failed++
    } else if ((outcome === 'retry' || outcome === 'auth-error') && row.attempts + 1 < VOIP_MAX_ATTEMPTS
      && now().getTime() + VOIP_RETRY_MS < row.deadline_at.getTime()) {
      if (outcome === 'auth-error') options.onAuthError?.()
      await finish(row.invitation_id, {
        status: 'queued', next_attempt_at: new Date(now().getTime() + VOIP_RETRY_MS),
        last_error: `${response.status}:${response.reason ?? ''}`.slice(0, 500),
      })
      result.retried++
    } else {
      if (outcome === 'auth-error') options.onAuthError?.()
      await finish(row.invitation_id, {status: 'failed', last_error: `${response.status}:${response.reason ?? ''}`.slice(0, 500)})
      result.failed++
    }
  }
  return result
}
