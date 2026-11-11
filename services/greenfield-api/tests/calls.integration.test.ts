import {createHmac, randomBytes} from 'node:crypto'
import net from 'node:net'
import type {AddressInfo} from 'node:net'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {createServer} from '../src/app/create-server.js'
import {migrateUp} from '../src/database/migrate.js'

const databaseUrl = process.env.MODULA_TEST_DATABASE_URL
const describeIfDb = databaseUrl ? describe : describe.skip
const TURN_SECRET = 'turn-secret-for-tests-only-0123456789abcdef'

describeIfDb('Calls v1: lifecycle, policy, TURN, VoIP registration and ticket-authenticated signalling', () => {
  let app: Awaited<ReturnType<typeof createServer>>['app']
  let db: Awaited<ReturnType<typeof createServer>>['db']
  let runSuffix = ''
  let counter = 0
  let keyCounter = 0
  let port = 0

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_API_HOST = '127.0.0.1'
    process.env.MODULA_API_PORT = '4033'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4033'
    process.env.MODULA_DATABASE_URL = databaseUrl!
    process.env.MODULA_DATABASE_MIGRATOR_URL = databaseUrl!
    process.env.MODULA_ALLOWED_ORIGINS = 'https://modula.digital,http://localhost:8081'
    process.env.MODULA_PREVIEW_WRITES_ENABLED = 'true'
    process.env.MODULA_INVITE_ONLY = 'true'
    process.env.MODULA_REGISTRATION_INVITE_CODES = 'test-invite'
    process.env.MODULA_ATPROTO_ENABLED = 'false'
    process.env.MODULA_RATE_LIMIT_ENABLED = 'false'
    process.env.MODULA_MEDIA_ROOT = `/tmp/modula-calls-${process.pid}`
    process.env.MODULA_CALLS_ENABLED = 'true'
    process.env.MODULA_CALLS_STUN_URLS = 'stun:turn.example.test:3478'
    process.env.MODULA_CALLS_TURN_URLS = 'turn:turn.example.test:3478?transport=udp,turns:turn.example.test:5349?transport=tcp'
    process.env.MODULA_CALLS_TURN_SECRET = TURN_SECRET
    process.env.MODULA_CALLS_TICKET_PEPPER = 'ticket-pepper-for-tests-only-0123456789abcdef'
    process.env.MODULA_CALLS_VOIP_TOKEN_KEY = randomBytes(32).toString('base64')
    await migrateUp(databaseUrl!)
    const created = await createServer(loadConfig())
    app = created.app
    db = created.db
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    await app.listen({host: '127.0.0.1', port: 0})
    port = (app.server.address() as AddressInfo).port
    runSuffix = Date.now().toString(36).slice(-6)
  })

  afterAll(async () => {
    for (const key of Object.keys(process.env)) if (key.startsWith('MODULA_CALLS_')) delete process.env[key]
    await app.close()
    await db.destroy()
  })

  it('requires authentication on every calls route and advertises the calls capability', async () => {
    const id = '01900000-0000-7000-8000-000000000000'
    const routes: Array<[string, string]> = [
      ['POST', '/v1/conversations/c1/calls'], ['GET', `/v1/calls/${id}`], ['GET', '/v1/me/calls'],
      ['POST', `/v1/calls/${id}/accept`], ['POST', `/v1/calls/${id}/decline`], ['POST', `/v1/calls/${id}/cancel`], ['POST', `/v1/calls/${id}/end`],
      ['POST', `/v1/calls/${id}/signalling-ticket`], ['POST', `/v1/calls/${id}/media-credentials`],
      ['GET', '/v1/me/call-settings'], ['PATCH', '/v1/me/call-settings'],
      ['POST', '/v1/push/voip-devices'], ['GET', '/v1/push/voip-devices'], ['DELETE', '/v1/push/voip-devices/r1'],
    ]
    for (const [method, url] of routes) {
      const res = await app.inject({method: method as any, url, payload: method === 'GET' || method === 'DELETE' ? undefined : {}})
      expect(res.statusCode, `${method} ${url}`).toBe(401)
    }
    const u = await user('cap')
    const caps = (await authed(u.accessToken, 'GET', '/v1/messaging/capabilities')).json().data
    expect(caps.calls).toMatchObject({enabled: true, audio: true, video: true, voipPush: true, maxParticipants: 2, ringTimeoutMs: 30_000, signallingProtocolVersion: 1})
  })

  it('runs ring, accept and end with idempotent commands, role checks and history', async () => {
    const [a, b, outsider] = [await user('lca'), await user('lcb'), await user('lco')]
    const convo = await directChat(a, b)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio'})).statusCode).toBe(400)
    const startKey = idem()
    const started = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'video'}, startKey)
    expect(started.statusCode, started.body).toBe(201)
    const call = started.json().data.call
    expect(call).toMatchObject({state: 'ringing', revision: 1, mediaKind: 'video', direction: 'outgoing', initiatorActorId: a.actorId, recipientActorId: b.actorId})
    expect(call.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const replay = await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'video'}, startKey)
    expect(replay.statusCode).toBe(200)
    expect(replay.json().data).toMatchObject({replay: true, call: {id: call.id}})
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio'}, startKey)).statusCode).toBe(409)
    expect((await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio', extra: 1}, idem())).statusCode).toBe(400)

    expect((await authed(outsider.accessToken, 'GET', `/v1/calls/${call.id}`)).statusCode).toBe(404)
    expect((await authed(outsider.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {}, idem())).statusCode).toBe(404)
    expect((await authed(b.accessToken, 'GET', `/v1/calls/${call.id}`)).json().data.call).toMatchObject({direction: 'incoming', other: {id: a.actorId}})
    expect((await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {}, idem())).statusCode).toBe(403)
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {})).statusCode).toBe(400)
    const stale = await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {expectedRevision: 9}, idem())
    expect(stale.statusCode).toBe(409)
    expect(stale.json().error).toMatchObject({code: 'REVISION_CONFLICT', details: {reason: 'CALL_REVISION_CONFLICT', revision: 1}})

    const acceptKey = idem()
    const accepted = await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {expectedRevision: 1}, acceptKey)
    expect(accepted.statusCode, accepted.body).toBe(200)
    expect(accepted.json().data.call).toMatchObject({state: 'connecting', revision: 2, answeredHere: true})
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {}, acceptKey)).json().data.replay).toBe(true)
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/decline`, {}, idem())).statusCode).toBe(409)

    const ended = await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/end`, {reason: 'user_action'}, idem())
    expect(ended.json().data.call).toMatchObject({state: 'ended', terminalReason: 'user_action'})
    const after = await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/end`, {}, idem())
    expect(after.statusCode).toBe(409)
    expect(after.json().error.details.reason).toBe('CALL_ALREADY_TERMINAL')
    expect((await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/end`, {reason: 'because I said so'}, idem())).statusCode).toBe(400)

    const history = (await authed(b.accessToken, 'GET', `/v1/me/calls?conversationId=${convo}`)).json().data
    expect(history.items[0]).toMatchObject({id: call.id, direction: 'incoming', state: 'ended', mediaKind: 'video'})
    expect(JSON.stringify(history)).not.toMatch(/sdp|candidate|credential|ticket/i)
    expect((await authed(outsider.accessToken, 'GET', `/v1/me/calls?conversationId=${convo}`)).statusCode).toBe(404)

    const events = await db.selectFrom('greenfield_call_events').select(['revision', 'event_type', 'to_state']).where('call_id', '=', call.id).orderBy('revision').execute()
    expect(events.map(e => e.event_type)).toEqual(['started', 'accepted', 'ended'])
    const live = await db.selectFrom('greenfield_call_participants').select('live').where('call_id', '=', call.id).execute()
    expect(live.every(p => !p.live)).toBe(true)
  })

  it('enforces accepted DMs, blocks, privacy, one live call per user, glare and timeouts', async () => {
    const [a, b, c, d, stranger] = [await user('pla'), await user('plb'), await user('plc'), await user('pld'), await user('pls')]
    // Message request only (stranger never followed a): no calling.
    const pending = (await authed(a.accessToken, 'POST', '/v1/conversations', {handle: stranger.handle, text: 'hi'})).json().data.conversation.id
    expectReason(await authed(a.accessToken, 'POST', `/v1/conversations/${pending}/calls`, {mediaKind: 'audio'}, idem()), 403, 'CALL_NOT_ALLOWED')

    const ab = await directChat(a, b)
    const ac = await directChat(a, c)
    const bc = await directChat(b, c)
    const cd = await directChat(c, d)

    // Privacy: video off, then nobody.
    const settings = (await authed(b.accessToken, 'GET', '/v1/me/call-settings')).json().data.settings
    expect(settings).toMatchObject({incomingCalls: 'accepted_directs', allowVideo: true, relayOnly: false, version: 0})
    expect((await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {allowVideo: false})).statusCode).toBe(400)
    expect((await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {allowVideo: false, expectedVersion: 0, sneaky: true})).statusCode).toBe(400)
    expect((await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {allowVideo: false, expectedVersion: 0})).json().data.settings.version).toBe(1)
    expect((await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {allowVideo: true, expectedVersion: 0})).statusCode).toBe(409)
    expectReason(await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'video'}, idem()), 403, 'CALL_NOT_ALLOWED')
    await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {incomingCalls: 'nobody', expectedVersion: 1})
    expectReason(await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'audio'}, idem()), 403, 'CALL_NOT_ALLOWED')
    await authed(b.accessToken, 'PATCH', '/v1/me/call-settings', {incomingCalls: 'accepted_directs', allowVideo: true, expectedVersion: 2})

    // Busy: a rings b; c cannot call a or b; d cannot reach c's conversation partner while c is free.
    const ring = (await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    expectReason(await authed(c.accessToken, 'POST', `/v1/conversations/${ac}/calls`, {mediaKind: 'audio'}, idem()), 409, 'CALL_BUSY')
    expectReason(await authed(c.accessToken, 'POST', `/v1/conversations/${bc}/calls`, {mediaKind: 'audio'}, idem()), 409, 'CALL_BUSY')
    // Glare: b presses call back while a's call is ringing and gets a's call to answer.
    const glare = await authed(b.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'audio'}, idem())
    expect(glare.statusCode).toBe(200)
    expect(glare.json().data).toMatchObject({glare: true, call: {id: ring.id, direction: 'incoming'}})

    // Ring timeout: the deadline passes; reads expire it to missed and accept gets CALL_RING_EXPIRED.
    await db.updateTable('greenfield_calls').set({state_deadline_at: new Date(Date.now() - 1000)}).where('call_id', '=', ring.id).execute()
    expectReason(await authed(b.accessToken, 'POST', `/v1/calls/${ring.id}/accept`, {}, idem()), 409, 'CALL_RING_EXPIRED')
    expect((await authed(a.accessToken, 'GET', `/v1/calls/${ring.id}`)).json().data.call).toMatchObject({state: 'missed', terminalReason: 'no_answer'})

    // Negotiation timeout: accepted but media never connects.
    const second = (await authed(c.accessToken, 'POST', `/v1/conversations/${cd}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    await authed(d.accessToken, 'POST', `/v1/calls/${second.id}/accept`, {}, idem())
    await db.updateTable('greenfield_calls').set({state_deadline_at: new Date(Date.now() - 1000)}).where('call_id', '=', second.id).execute()
    expect((await authed(c.accessToken, 'GET', `/v1/calls/${second.id}`)).json().data.call).toMatchObject({state: 'failed', terminalReason: 'negotiation_timeout'})

    // Blocks in either direction stop new calls and end live ones.
    const third = (await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    const profile = await db.selectFrom('profiles').select('id').where('actor_id', '=', a.actorId).executeTakeFirstOrThrow()
    expect((await authed(b.accessToken, 'POST', `/v1/profiles/${profile.id}/block`, {})).statusCode).toBe(200)
    expect((await authed(a.accessToken, 'GET', `/v1/calls/${third.id}`)).json().data.call).toMatchObject({state: 'failed', terminalReason: 'blocked'})
    expectReason(await authed(a.accessToken, 'POST', `/v1/conversations/${ab}/calls`, {mediaKind: 'audio'}, idem()), 403, 'CALL_NOT_ALLOWED')
  })

  it('issues TURN credentials only to authorized participants, with coturn REST HMAC and a budget', async () => {
    const [a, b, outsider] = [await user('tna'), await user('tnb'), await user('tno')]
    const convo = await directChat(a, b)
    const call = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    expect((await authed(outsider.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})).statusCode).toBe(404)
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})).statusCode).toBe(409)
    const res = await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})
    expect(res.statusCode, res.body).toBe(200)
    expect(res.headers['cache-control']).toBe('no-store')
    const creds = res.json().data
    expect(creds).toMatchObject({iceTransportPolicy: 'all', credentialVersion: 1, ttlSeconds: 600})
    const turn = creds.iceServers.find((s: any) => s.username)
    expect(creds.iceServers[0]).toEqual({urls: ['stun:turn.example.test:3478']})
    expect(turn.urls).toEqual(['turn:turn.example.test:3478?transport=udp', 'turns:turn.example.test:5349?transport=tcp'])
    const [expiry, pseudonym] = turn.username.split(':')
    expect(Number(expiry) * 1000).toBeGreaterThan(Date.now() + 500_000)
    expect(pseudonym).toMatch(/^[0-9a-f]{24}$/)
    expect(turn.username).not.toContain(a.actorId)
    expect(turn.credential).toBe(createHmac('sha1', TURN_SECRET).update(turn.username).digest('base64'))
    expect(JSON.stringify(creds)).not.toContain(TURN_SECRET)
    for (let i = 0; i < 5; i++) await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})
    expect((await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})).statusCode).toBe(429)
    await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {}, idem())
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})).statusCode).toBe(200)
    await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/end`, {}, idem())
    expect((await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/media-credentials`, {})).statusCode).toBe(409)
  })

  it('registers PushKit tokens against owned devices only and queues VoIP invitations for incoming calls', async () => {
    const [a, b] = [await user('vpa'), await user('vpb')]
    const convo = await directChat(a, b)
    const aDevice = await registerDevice(a)
    const bDevice = await registerDevice(b)
    const token = randomBytes(32).toString('hex')
    expect((await authed(b.accessToken, 'POST', '/v1/push/voip-devices', {deviceId: aDevice, token, environment: 'development'})).statusCode).toBe(400)
    expect((await authed(b.accessToken, 'POST', '/v1/push/voip-devices', {deviceId: bDevice, token, environment: 'development', topic: 'evil'})).statusCode).toBe(400)
    const created = await authed(b.accessToken, 'POST', '/v1/push/voip-devices', {deviceId: bDevice, token, environment: 'development', appVersion: '1.0'})
    expect(created.statusCode, created.body).toBe(201)
    const registration = created.json().data.registration
    expect(registration).toMatchObject({deviceId: bDevice, topic: 'digital.modula.app.native.voip', environment: 'development'})
    const listed = (await authed(b.accessToken, 'GET', '/v1/push/voip-devices')).json().data.items
    expect(listed).toHaveLength(1)
    expect(JSON.stringify(listed)).not.toContain(token)
    const stored = await db.selectFrom('greenfield_call_push_tokens').selectAll().where('registration_id', '=', registration.registrationId).executeTakeFirstOrThrow()
    expect(stored.token_ciphertext.toString('utf8')).not.toContain(token)

    const call = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    const invitations = await db.selectFrom('greenfield_call_device_invitations').selectAll().where('call_id', '=', call.id).execute()
    expect(invitations).toHaveLength(1)
    expect(invitations[0]).toMatchObject({actor_id: b.actorId, registration_id: registration.registrationId, status: 'queued'})
    await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/cancel`, {}, idem())
    expect((await db.selectFrom('greenfield_call_device_invitations').select('status').where('call_id', '=', call.id).executeTakeFirstOrThrow()).status).toBe('cancelled')

    expect((await authed(a.accessToken, 'DELETE', `/v1/push/voip-devices/${registration.registrationId}`)).statusCode).toBe(404)
    expect((await authed(b.accessToken, 'DELETE', `/v1/push/voip-devices/${registration.registrationId}`)).statusCode).toBe(200)
    expect((await authed(b.accessToken, 'GET', '/v1/push/voip-devices')).json().data.items).toHaveLength(0)
  })

  it('rejects signalling upgrades without a valid single-use ticket and relays only between participants', async () => {
    const [a, b, outsider] = [await user('sga'), await user('sgb'), await user('sgo')]
    const convo = await directChat(a, b)
    const call = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'video'}, idem())).json().data.call
    const path = `/v1/calls/${call.id}/signalling`
    expect((await authed(outsider.accessToken, 'POST', `/v1/calls/${call.id}/signalling-ticket`, {})).statusCode).toBe(404)
    const ticketA = (await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/signalling-ticket`, {})).json().data
    expect(ticketA).toMatchObject({protocolVersion: 1, url: `ws://127.0.0.1:4033${path}`})
    expect(ticketA.ticket).toMatch(/^[A-Za-z0-9_-]{43}$/)

    expect(await upgrade(path)).toBe(401)
    expect(await upgrade(path, 'not-a-ticket')).toBe(401)
    expect(await upgrade(path, a.accessToken)).toBe(401)
    const otherCall = '01900000-0000-7000-8000-00000000ffff'
    expect(await upgrade(`/v1/calls/${otherCall}/signalling`, ticketA.ticket)).toBe(401)
    expect(await upgrade(path, ticketA.ticket)).toBe(101)
    expect(await upgrade(path, ticketA.ticket)).toBe(401)
    const stored = await db.selectFrom('greenfield_call_signalling_tickets').select(['ticket_hash']).where('call_id', '=', call.id).execute()
    expect(stored.every(t => t.ticket_hash !== ticketA.ticket && /^[0-9a-f]{64}$/.test(t.ticket_hash))).toBe(true)

    await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/accept`, {}, idem())
    const sa = await openSignalling(path, (await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/signalling-ticket`, {})).json().data.ticket)
    const sb = await openSignalling(path, (await authed(b.accessToken, 'POST', `/v1/calls/${call.id}/signalling-ticket`, {})).json().data.ticket)
    await waitFor(() => sa.events.some(e => e.type === 'server.ready') && sb.events.some(e => e.type === 'server.ready'))
    expect(sb.events.find(e => e.type === 'server.ready').payload.call).toMatchObject({id: call.id, state: 'connecting'})

    const frame = (type: string, payload: Record<string, unknown>, negotiationId = 'nego-00000001') => JSON.stringify({
      protocolVersion: 1, type, messageId: `m-${Math.random().toString(36).slice(2, 12)}`, callId: call.id, negotiationId, payload,
    })
    sb.ws.send(frame('signal.offer', {sdp: 'v=0 from recipient'}))
    await waitFor(() => sb.events.some(e => e.type === 'error' && e.payload.code === 'SIGNALLING_GLARE'))
    sb.ws.send(JSON.stringify({protocolVersion: 1, type: 'signal.offer', messageId: 'm-unknownfield', callId: call.id, negotiationId: 'nego-00000001', payload: {sdp: 'x'}, extra: true}))
    await waitFor(() => sb.events.some(e => e.type === 'error' && e.payload.code === 'UNKNOWN_FIELD'))
    sa.ws.send(frame('signal.offer', {sdp: 'x'.repeat(70 * 1024)}))
    await waitFor(() => sa.events.some(e => e.type === 'error' && e.payload.code === 'SDP_TOO_LARGE'))
    sa.ws.send(frame('signal.offer', {sdp: 'v=0 offer'}))
    await waitFor(() => sb.events.some(e => e.type === 'signal.offer'))
    expect(sb.events.find(e => e.type === 'signal.offer')).toMatchObject({payload: {sdp: 'v=0 offer'}, negotiationId: 'nego-00000001'})
    await waitFor(() => sa.events.some(e => e.type === 'server.ack' && e.payload.relayed === true))
    sb.ws.send(frame('signal.answer', {sdp: 'v=0 answer'}))
    sb.ws.send(frame('signal.ice_candidate', {candidate: 'candidate:1 1 udp 2122260223 192.0.2.1 54400 typ host', sdpMid: '0', sdpMLineIndex: 0}))
    await waitFor(() => sa.events.some(e => e.type === 'signal.answer') && sa.events.some(e => e.type === 'signal.ice_candidate'))

    sa.ws.send(frame('media.connected', {iceType: 'relay', audio: true, video: true}))
    sb.ws.send(frame('media.connected', {iceType: 'relay', audio: true, video: false}))
    await waitFor(() => sa.events.some(e => e.type === 'call.snapshot' && e.payload.call.state === 'active'))
    expect((await authed(a.accessToken, 'GET', `/v1/calls/${call.id}`)).json().data.call.state).toBe('active')

    const activeSnapshots = () => sb.events.filter(e => e.type === 'call.snapshot' && e.payload.call.state === 'active').length
    const before = activeSnapshots()
    sb.ws.send(frame('media.disconnected', {reason: 'network_change'}))
    await waitFor(() => sa.events.some(e => e.type === 'media.reconnect_required'))
    expect((await authed(a.accessToken, 'GET', `/v1/calls/${call.id}`)).json().data.call.state).toBe('reconnecting')
    sa.ws.send(frame('media.connected', {}, 'nego-00000002'))
    sb.ws.send(frame('media.connected', {}, 'nego-00000002'))
    await waitFor(() => activeSnapshots() > before)

    sa.ws.send(frame('call.end', {reason: 'user_action', idempotencyKey: idem()}))
    await waitFor(() => sb.events.some(e => e.type === 'call.ended'))
    expect(sb.events.find(e => e.type === 'call.ended').payload.call).toMatchObject({state: 'ended', durationMs: expect.any(Number)})
    const sequences = sb.events.filter(e => typeof e.sequence === 'number').map(e => e.sequence)
    expect([...sequences].sort((x, y) => x - y)).toEqual(sequences)
    const events = await db.selectFrom('greenfield_call_events').select(['event_type', 'metadata']).where('call_id', '=', call.id).orderBy('revision').execute()
    expect(events.map(e => e.event_type)).toEqual(['started', 'accepted', 'media_connected', 'media_disconnected', 'reconnected', 'ended'])
    expect(JSON.stringify(events)).not.toMatch(/v=0|candidate|192\.0\.2\.1/)
  })

  it('tells foreground devices about calls over the messaging socket', async () => {
    const [a, b] = [await user('msa'), await user('msb')]
    const convo = await directChat(a, b)
    const events: any[] = []
    const ws = await (app as any).injectWS('/v1/messaging/socket', {headers: {authorization: `Bearer ${b.accessToken}`}}, {
      onInit: (socket: any) => socket.on('message', (data: Buffer) => events.push(JSON.parse(data.toString()))),
    })
    await waitFor(() => events.some(e => e.type === 'hello'))
    const call = (await authed(a.accessToken, 'POST', `/v1/conversations/${convo}/calls`, {mediaKind: 'audio'}, idem())).json().data.call
    await waitFor(() => events.some(e => e.type === 'call.updated' && e.event === 'started'))
    expect(events.find(e => e.type === 'call.updated')).toMatchObject({callId: call.id, conversationId: convo, state: 'ringing', mediaKind: 'audio', initiatorActorId: a.actorId})
    await authed(a.accessToken, 'POST', `/v1/calls/${call.id}/cancel`, {}, idem())
    await waitFor(() => events.some(e => e.type === 'call.updated' && e.state === 'cancelled'))
    ws.terminate()
  })

  it('hides calls entirely when the server is not configured for them', async () => {
    const u = await user('off')
    const saved = {...process.env}
    for (const key of Object.keys(process.env)) if (key.startsWith('MODULA_CALLS_')) delete process.env[key]
    const off = await createServer(loadConfig())
    process.env = saved
    try {
      const inject = (method: string, url: string, payload?: unknown) => off.app.inject({
        method: method as any, url, headers: {authorization: `Bearer ${u.accessToken}`, 'idempotency-key': idem()}, ...(payload === undefined ? {} : {payload}),
      })
      expect((await inject('GET', '/v1/messaging/capabilities')).json().data.calls).toMatchObject({enabled: false, audio: false, video: false, voipPush: false})
      const start = await inject('POST', '/v1/conversations/anything/calls', {mediaKind: 'audio'})
      expect(start.statusCode).toBe(503)
      expect(start.json().error).toMatchObject({code: 'CAPABILITY_UNAVAILABLE', details: {reason: 'CALLS_UNAVAILABLE'}})
      expect((await inject('POST', '/v1/calls/01900000-0000-7000-8000-000000000000/signalling-ticket', {})).statusCode).toBe(503)
      expect((await off.app.inject({method: 'POST', url: '/v1/conversations/anything/calls', payload: {mediaKind: 'audio'}})).statusCode).toBe(401)
    } finally {
      await off.app.close()
      await off.db.destroy()
    }
  })

  // ---- helpers ---------------------------------------------------------

  function idem() {
    keyCounter += 1
    return `idem-${runSuffix}-${keyCounter}-${randomBytes(6).toString('hex')}`
  }

  function expectReason(res: any, status: number, reason: string) {
    expect(res.statusCode, res.body).toBe(status)
    expect(res.json().error.details?.reason).toBe(reason)
  }

  async function directChat(a: {actorId: string; accessToken: string}, b: {actorId: string; handle: string}) {
    await follow(b, a)
    const res = await authed(a.accessToken, 'POST', '/v1/conversations', {handle: b.handle})
    expect(res.statusCode, res.body).toBeLessThan(300)
    return res.json().data.conversation.id as string
  }

  function upgrade(path: string, token?: string) {
    return new Promise<number>((resolve, reject) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write([
        `GET ${path} HTTP/1.1`, `Host: 127.0.0.1:${port}`, 'Connection: Upgrade', 'Upgrade: websocket',
        'Sec-WebSocket-Version: 13', 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==', ...(token ? [`Authorization: Bearer ${token}`] : []), '', '',
      ].join('\r\n')))
      let data = ''
      socket.on('data', chunk => {
        data += chunk.toString('latin1')
        const match = /^HTTP\/1\.1 (\d{3})/.exec(data)
        if (match) { socket.destroy(); resolve(Number(match[1])) }
      })
      socket.on('error', reject)
      socket.on('close', () => reject(new Error(`closed without status: ${JSON.stringify(data)}`)))
    })
  }

  async function openSignalling(path: string, ticket: string) {
    const events: any[] = []
    const ws = await (app as any).injectWS(path, {headers: {authorization: `Bearer ${ticket}`}}, {
      onInit: (socket: any) => socket.on('message', (data: Buffer) => events.push(JSON.parse(data.toString()))),
    })
    return {ws, events}
  }

  async function user(prefix: string) {
    counter += 1
    const handle = `${prefix}${runSuffix}${counter}`.slice(0, 20)
    const password = 'secure-pass-word-1'
    const email = `${handle}@example.com`
    await db.deleteFrom('greenfield_auth_rate_limits').where('purpose', '=', 'email_verification').execute()
    const register = await app.inject({method: 'POST', url: '/v1/accounts/register', payload: {email, password, handle, displayName: handle, acceptedTerms: true, inviteCode: 'test-invite'}})
    expect(register.statusCode, register.body).toBe(201)
    await app.inject({method: 'POST', url: '/v1/accounts/verify-email', payload: {token: register.json().data.verificationToken}})
    const session = await app.inject({method: 'POST', url: '/v1/sessions', payload: {email, password}})
    const accessToken = session.json().data.accessToken as string
    const accountId = register.json().data.accountId as string
    const actor = await db.selectFrom('actors').select('id').where('account_id', '=', accountId).executeTakeFirstOrThrow()
    return {accountId, actorId: actor.id, handle, accessToken}
  }

  async function follow(follower: {actorId: string}, followed: {actorId: string}) {
    const now = new Date()
    await db.insertInto('follows').values({id: `f-${follower.actorId}-${followed.actorId}`, follower_actor_id: follower.actorId, followed_actor_id: followed.actorId, created_at: now, updated_at: now, deleted_at: null, version: 1} as any)
      .onConflict(oc => oc.doNothing()).execute()
  }

  async function registerDevice(member: {accountId: string; actorId: string}) {
    const now = new Date()
    const id = `dev-${member.actorId}`
    await db.insertInto('push_device_tokens').values({
      id, account_id: member.accountId, actor_id: member.actorId, token: randomBytes(32).toString('hex'),
      platform: 'ios', environment: 'development', bundle_id: 'digital.modula.app.native', app_version: null, device_name: null, locale: null, timezone: null,
      created_at: now, updated_at: now, last_seen_at: now, disabled_at: null, disabled_reason: null,
    } as any).execute()
    return id
  }

  async function authed(accessToken: string, method: string, url: string, payload?: unknown, idempotencyKey?: string) {
    return app.inject({
      method: method as any, url,
      headers: {authorization: `Bearer ${accessToken}`, ...(idempotencyKey ? {'idempotency-key': idempotencyKey} : {})},
      ...(payload === undefined ? {} : {payload}),
    })
  }
})

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function waitFor(check: () => boolean, timeoutMs = 3000) {
  const start = Date.now()
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting for condition')
    await sleep(10)
  }
}
