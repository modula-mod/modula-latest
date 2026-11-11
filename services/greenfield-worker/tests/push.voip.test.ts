import {createCipheriv, randomBytes, randomUUID} from 'node:crypto'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {apnsHeaders, type ApnsRequest, type ApnsResponse, type PushSender} from '../src/push/apns.js'
import {buildVoipPayload, decryptVoipToken, loadVoipTokenKey, runVoipPass} from '../src/push/voip.js'

const key = randomBytes(32)
function encrypt(token: string): Buffer {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), body])
}

class FakeSender implements PushSender {
  sent: ApnsRequest[] = []
  constructor(public respond: (request: ApnsRequest) => ApnsResponse = () => ({status: 200, apnsId: 'apns-1'})) {}
  async send(request: ApnsRequest) { this.sent.push(request); return this.respond(request) }
  close() {}
}

describe('VoIP push lane (unit)', () => {
  it('uses the voip topic, priority 10 and expiration 0', () => {
    const headers = apnsHeaders({token: 't', environment: 'development', payload: {}, pushType: 'voip', topic: 'digital.modula.app.native.voip', expiration: 0}, 'digital.modula.app.native', 1_700_000_000)
    expect(headers).toEqual({
      'apns-topic': 'digital.modula.app.native.voip', 'apns-push-type': 'voip', 'apns-priority': '10', 'apns-expiration': '0',
    })
  })

  it('keeps ordinary alert pushes on the bundle topic with a one-day expiry', () => {
    const headers = apnsHeaders({token: 't', environment: 'production', payload: {}}, 'digital.modula.app.native', 1_700_000_000)
    expect(headers['apns-topic']).toBe('digital.modula.app.native')
    expect(headers['apns-push-type']).toBe('alert')
    expect(headers['apns-expiration']).toBe(String(1_700_000_000 + 86_400))
  })

  it('builds a call-only payload with no credentials', () => {
    const payload = buildVoipPayload({
      callId: '01900000-0000-7000-8000-000000000001', conversationId: 'c1', mediaKind: 'video',
      ringDeadlineAt: new Date('2026-11-11T00:00:30Z'), caller: {actorId: 'a1', handle: 'sam', displayName: ''},
    }) as any
    expect(payload.aps).toEqual({})
    expect(payload.modula).toEqual({
      type: 'call.incoming', callId: '01900000-0000-7000-8000-000000000001', conversationId: 'c1', mediaKind: 'video',
      ringDeadlineAt: '2026-11-11T00:00:30.000Z', caller: {actorId: 'a1', handle: 'sam', displayName: '@sam'},
    })
    expect(JSON.stringify(payload)).not.toMatch(/ticket|credential|token|sdp/i)
  })

  it('round-trips the API token encryption layout and rejects bad keys', () => {
    expect(decryptVoipToken(encrypt('ab'.repeat(32)), key)).toBe('ab'.repeat(32))
    expect(() => decryptVoipToken(encrypt('ab'.repeat(32)), randomBytes(32))).toThrow()
    expect(loadVoipTokenKey({MODULA_CALLS_VOIP_TOKEN_KEY: key.toString('base64')})?.equals(key)).toBe(true)
    expect(loadVoipTokenKey({MODULA_CALLS_VOIP_TOKEN_KEY: 'c2hvcnQ='})).toBeNull()
    expect(loadVoipTokenKey({})).toBeNull()
  })
})

const testDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeLive = testDatabaseUrl ? describe : describe.skip

describeLive('VoIP push lane (live Postgres)', () => {
  let db: ModulaWorkerDb
  const suffix = randomUUID().slice(0, 8)
  const caller = `voip-caller-${suffix}`
  const callee = `voip-callee-${suffix}`
  const conversation = `voip-conv-${suffix}`
  const deviceId = `voip-dev-${suffix}`
  const registrationId = `voip-reg-${suffix}`
  const goodToken = 'c'.repeat(64)

  async function call(state: string, deadlineOffsetMs = 30_000): Promise<string> {
    const callId = randomUUID()
    const now = new Date()
    await db.deleteFrom('greenfield_calls').where('conversation_id', '=', conversation).execute()
    await db.insertInto('greenfield_calls').values({
      call_id: callId, conversation_id: conversation, initiator_actor_id: caller, recipient_actor_id: callee, media_kind: 'audio',
      state, revision: 1, ring_deadline_at: new Date(now.getTime() + deadlineOffsetMs), state_deadline_at: new Date(now.getTime() + deadlineOffsetMs),
      idempotency_key: `idem-${randomUUID()}`, created_at: now, updated_at: now,
      ...(state === 'ringing' ? {} : {ended_at: now, terminal_reason: 'cancelled'}),
    } as any).execute()
    await db.insertInto('greenfield_call_device_invitations').values({
      invitation_id: randomUUID(), call_id: callId, actor_id: callee, registration_id: registrationId, status: 'queued', attempts: 0,
      next_attempt_at: now, deadline_at: new Date(now.getTime() + deadlineOffsetMs), created_at: now, updated_at: now,
    } as any).execute()
    return callId
  }

  const invitation = (callId: string) => db.selectFrom('greenfield_call_device_invitations').selectAll().where('call_id', '=', callId).executeTakeFirstOrThrow()

  beforeAll(async () => {
    await migrateUp(testDatabaseUrl as string)
    db = createDb(testDatabaseUrl as string)
    await db.deleteFrom('greenfield_call_device_invitations').execute()
    const now = new Date()
    for (const actor of [caller, callee]) {
      await db.insertInto('greenfield_accounts').values({account_id: `acct-${actor}`, primary_handle: `h${randomUUID().replace(/-/g, '').slice(0, 20)}`, status: 'active', created_at: now, updated_at: now} as any).execute()
      await db.insertInto('actors').values({id: actor, account_id: `acct-${actor}`, kind: 'person', created_at: now, updated_at: now, deleted_at: null, version: 1} as any).execute()
    }
    await db.insertInto('greenfield_conversations' as any).values({
      conversation_id: conversation, kind: 'direct', subject: null, title: null, description: null, direct_key: `dk-${suffix}`,
      created_by_actor_id: caller, created_at: now, updated_at: now, last_message_at: now,
    } as any).execute()
    await db.insertInto('push_device_tokens').values({
      id: deviceId, account_id: `acct-${callee}`, actor_id: callee, token: 'd'.repeat(64), platform: 'ios', environment: 'development',
      bundle_id: 'digital.modula.app.native', created_at: now, updated_at: now, last_seen_at: now,
    } as any).execute()
    await db.insertInto('greenfield_call_push_tokens').values({
      registration_id: registrationId, account_id: `acct-${callee}`, actor_id: callee, device_id: deviceId,
      token_hash: 'e'.repeat(64), token_ciphertext: encrypt(goodToken), key_version: 1, environment: 'development',
      topic: 'digital.modula.app.native.voip', created_at: now, updated_at: now, last_seen_at: now,
    } as any).execute()
  })

  afterAll(async () => {
    if (!db) return
    await db.deleteFrom('greenfield_calls').where('conversation_id', '=', conversation).execute()
    await db.deleteFrom('greenfield_call_push_tokens').where('registration_id', '=', registrationId).execute()
    await db.deleteFrom('push_device_tokens').where('id', '=', deviceId).execute()
    await db.deleteFrom('greenfield_conversations' as any).where('conversation_id' as any, '=', conversation).execute()
    await db.deleteFrom('actors').where('id', 'in', [caller, callee]).execute()
    await db.deleteFrom('greenfield_accounts').where('account_id', 'in', [`acct-${caller}`, `acct-${callee}`]).execute()
    await db.destroy()
  })

  it('sends one VoIP push for a ringing call on the voip topic with expiration 0', async () => {
    const callId = await call('ringing')
    const apns = new FakeSender()
    const result = await runVoipPass(db, apns, {key})
    expect(result).toMatchObject({sent: 1})
    expect(apns.sent).toHaveLength(1)
    expect(apns.sent[0]).toMatchObject({token: goodToken, pushType: 'voip', topic: 'digital.modula.app.native.voip', expiration: 0, collapseId: callId})
    expect((await invitation(callId)).status).toBe('sent')
    expect((await runVoipPass(db, apns, {key})).claimed).toBe(0)
  })

  it('never sends for a call that has stopped ringing', async () => {
    const callId = await call('cancelled')
    const apns = new FakeSender()
    await runVoipPass(db, apns, {key})
    expect(apns.sent).toHaveLength(0)
    expect((await invitation(callId)).status).toBe('expired')
  })

  it('retries briefly inside the ring window, then gives up at the deadline', async () => {
    const callId = await call('ringing', 3_000)
    const apns = new FakeSender(() => ({status: 503, reason: 'ServiceUnavailable'}))
    const result = await runVoipPass(db, apns, {key})
    // 2 s retry would land within 1 s of the 3 s deadline: allowed once.
    expect(result.retried + result.failed).toBe(1)
    const later = () => new Date(Date.now() + 10_000)
    await runVoipPass(db, apns, {key, now: later})
    expect(['expired', 'failed']).toContain((await invitation(callId)).status)
  })

  it('disables only the VoIP registration on an invalid token', async () => {
    const callId = await call('ringing')
    const apns = new FakeSender(() => ({status: 410, reason: 'Unregistered'}))
    const result = await runVoipPass(db, apns, {key})
    expect(result.prunedTokens).toBe(1)
    const registration = await db.selectFrom('greenfield_call_push_tokens').selectAll().where('registration_id', '=', registrationId).executeTakeFirstOrThrow()
    expect(registration.disabled_at).not.toBeNull()
    const alert = await db.selectFrom('push_device_tokens').selectAll().where('id', '=', deviceId).executeTakeFirstOrThrow()
    expect(alert.disabled_at).toBeNull()
    expect((await invitation(callId)).status).toBe('failed')
  })
})
