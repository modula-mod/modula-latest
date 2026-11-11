import {createHmac} from 'node:crypto'
import {afterEach, describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'
import {callsCapabilities} from '../src/app/register-calls-routes.js'
import {
  CALL_TRANSITIONS, LIVE_CALL_STATES, TERMINAL_CALL_STATES, canTransition, deadlineFor, expiryOutcome, hashTicket,
  isValidIdempotencyKey, newTicket, policyOutcome, resolveCommand, turnCredentials, uuidv7,
} from '../src/domains/calls/policy.js'
import {FrameRateLimiter, parseClientFrame} from '../src/domains/calls/signalling-hub.js'

const CALL = '01900000-0000-7000-8000-000000000001'

describe('call state machine', () => {
  it('matches the architecture transition table and keeps terminal states final', () => {
    expect(CALL_TRANSITIONS.ringing).toEqual(expect.arrayContaining(['connecting', 'declined', 'cancelled', 'missed', 'failed']))
    expect(canTransition('connecting', 'active')).toBe(true)
    expect(canTransition('active', 'reconnecting')).toBe(true)
    expect(canTransition('reconnecting', 'active')).toBe(true)
    expect(canTransition('ringing', 'active')).toBe(false)
    expect(canTransition('active', 'missed')).toBe(false)
    for (const terminal of TERMINAL_CALL_STATES) for (const to of [...LIVE_CALL_STATES, ...TERMINAL_CALL_STATES]) expect(canTransition(terminal, to)).toBe(false)
  })

  it('gives each live state a server deadline and a timeout outcome', () => {
    const now = new Date('2026-11-11T00:00:00Z')
    expect(deadlineFor('ringing', now)!.getTime() - now.getTime()).toBe(30_000)
    expect(deadlineFor('connecting', now)!.getTime() - now.getTime()).toBe(20_000)
    expect(deadlineFor('reconnecting', now)!.getTime() - now.getTime()).toBe(30_000)
    expect(deadlineFor('active', now)).toBeNull()
    expect(expiryOutcome('ringing')).toEqual({state: 'missed', reason: 'no_answer'})
    expect(expiryOutcome('connecting')).toEqual({state: 'failed', reason: 'negotiation_timeout'})
    expect(expiryOutcome('reconnecting')).toEqual({state: 'failed', reason: 'reconnect_timeout'})
    expect(policyOutcome('ringing')).toBe('failed')
    expect(policyOutcome('active')).toBe('ended')
    expect(policyOutcome('ended')).toBeNull()
  })

  it('resolves commands by role and maps an early hang-up to cancel or decline', () => {
    expect(resolveCommand('accept', 'recipient', 'ringing')).toMatchObject({to: 'connecting'})
    expect(resolveCommand('accept', 'initiator', 'ringing')).toEqual({error: 'FORBIDDEN'})
    expect(resolveCommand('cancel', 'recipient', 'ringing')).toEqual({error: 'FORBIDDEN'})
    expect(resolveCommand('end', 'initiator', 'ringing')).toMatchObject({to: 'cancelled', event: 'cancelled'})
    expect(resolveCommand('end', 'recipient', 'ringing')).toMatchObject({to: 'declined', event: 'declined'})
    expect(resolveCommand('end', 'recipient', 'active')).toMatchObject({to: 'ended'})
    expect(resolveCommand('decline', 'recipient', 'connecting')).toEqual({error: 'INVALID_STATE'})
    expect(resolveCommand('end', 'initiator', 'ended')).toEqual({error: 'INVALID_STATE'})
  })
})

describe('call identifiers, tickets and TURN credentials', () => {
  it('mints time-ordered UUIDv7 call ids usable as CallKit UUIDs', () => {
    const a = uuidv7(1_700_000_000_000)
    const b = uuidv7(1_700_000_000_001)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(a < b).toBe(true)
  })

  it('mints 256-bit tickets and stores only a peppered hash', () => {
    const ticket = newTicket()
    expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hashTicket(ticket, 'p1')).not.toBe(hashTicket(ticket, 'p2'))
    expect(hashTicket(ticket, 'p1')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('produces coturn REST credentials with an opaque, stable pseudonym', () => {
    const now = new Date('2026-11-11T00:00:00Z')
    const input = {secret: 's'.repeat(40), callId: CALL, actorId: 'actor-1', sessionId: 'session-1', ttlSeconds: 600, now}
    const creds = turnCredentials(input)
    expect(creds.username).toMatch(/^\d+:[0-9a-f]{24}$/)
    expect(Number(creds.username.split(':')[0])).toBe(now.getTime() / 1000 + 600)
    expect(creds.credential).toBe(createHmac('sha1', 's'.repeat(40)).update(creds.username).digest('base64'))
    expect(creds.username).not.toContain('actor-1')
    expect(turnCredentials({...input, sessionId: 'session-2'}).username).not.toBe(creds.username)
  })

  it('accepts only printable idempotency keys of 16 to 128 characters', () => {
    expect(isValidIdempotencyKey('a'.repeat(16))).toBe(true)
    expect(isValidIdempotencyKey('a'.repeat(15))).toBe(false)
    expect(isValidIdempotencyKey('a'.repeat(129))).toBe(false)
    expect(isValidIdempotencyKey('a b c d e f g h i j')).toBe(false)
  })
})

describe('signalling frame validation', () => {
  const frame = (overrides: Record<string, unknown>) => JSON.stringify({protocolVersion: 1, type: 'ping', messageId: 'message-0001', callId: CALL, payload: {}, ...overrides})

  it('accepts well-formed frames', () => {
    expect(parseClientFrame(frame({}), CALL)).toMatchObject({type: 'ping'})
    expect(parseClientFrame(frame({type: 'signal.offer', negotiationId: 'nego-0001', payload: {sdp: 'v=0'}}), CALL)).toMatchObject({type: 'signal.offer', negotiationId: 'nego-0001'})
    expect(parseClientFrame(frame({type: 'signal.ice_candidate', negotiationId: 'nego-0001', payload: {candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0}}), CALL)).toMatchObject({type: 'signal.ice_candidate'})
  })

  it('rejects unknown fields, wrong calls, bad versions and oversize media descriptions', () => {
    expect(parseClientFrame(frame({extra: 1}), CALL)).toEqual({error: 'UNKNOWN_FIELD'})
    expect(parseClientFrame(frame({protocolVersion: 2}), CALL)).toEqual({error: 'UNSUPPORTED_PROTOCOL'})
    expect(parseClientFrame(frame({type: 'server.ready'}), CALL)).toEqual({error: 'UNKNOWN_TYPE'})
    expect(parseClientFrame(frame({callId: '01900000-0000-7000-8000-000000000002'}), CALL)).toEqual({error: 'CALL_MISMATCH'})
    expect(parseClientFrame(frame({messageId: 'x'}), CALL)).toEqual({error: 'INVALID_MESSAGE_ID'})
    expect(parseClientFrame('{not json', CALL)).toEqual({error: 'INVALID_JSON'})
    expect(parseClientFrame(frame({type: 'signal.offer', payload: {sdp: 'v=0'}}), CALL)).toEqual({error: 'INVALID_PAYLOAD'})
    expect(parseClientFrame(frame({type: 'signal.offer', negotiationId: 'nego-0001', payload: {sdp: 'v=0', trickle: true}}), CALL)).toEqual({error: 'INVALID_PAYLOAD'})
    expect(parseClientFrame(frame({type: 'signal.offer', negotiationId: 'nego-0001', payload: {sdp: 'x'.repeat(65 * 1024)}}), CALL)).toEqual({error: 'SDP_TOO_LARGE'})
    expect(parseClientFrame(frame({type: 'signal.offer', negotiationId: 'nego-0001', payload: {sdp: 'x'.repeat(73 * 1024)}}), CALL)).toEqual({error: 'FRAME_TOO_LARGE'})
    expect(parseClientFrame(frame({type: 'signal.ice_candidate', negotiationId: 'nego-0001', payload: {candidate: 'c'.repeat(3000)}}), CALL)).toEqual({error: 'INVALID_PAYLOAD'})
    expect(parseClientFrame(frame({type: 'call.end', payload: {reason: 'whatever', idempotencyKey: 'k'.repeat(16)}}), CALL)).toEqual({error: 'INVALID_PAYLOAD'})
  })

  it('rate limits a socket to its budget with a small burst', () => {
    const limiter = new FrameRateLimiter(50, 100)
    const now = Date.now() + 1
    let allowed = 0
    for (let i = 0; i < 150; i++) if (limiter.take(now)) allowed++
    expect(allowed).toBe(100)
    expect(limiter.take(now + 100)).toBe(true)
  })
})

describe('calls configuration and capability', () => {
  const saved = {...process.env}
  afterEach(() => { process.env = {...saved} })

  function baseEnv() {
    process.env.NODE_ENV = 'test'
    process.env.MODULA_ENVIRONMENT = 'development'
    process.env.MODULA_DATABASE_URL = 'postgresql://u:p@127.0.0.1:5432/db'
    process.env.MODULA_PUBLIC_API_URL = 'http://127.0.0.1:4000'
    process.env.MODULA_ALLOWED_ORIGINS = 'http://localhost:8081'
    for (const key of Object.keys(process.env)) if (key.startsWith('MODULA_CALLS_')) delete process.env[key]
  }

  it('is off by default and stays off when TURN or the ticket pepper is missing', () => {
    baseEnv()
    expect(loadConfig().calls).toMatchObject({enabled: false})
    expect(callsCapabilities(loadConfig().calls)).toMatchObject({enabled: false, audio: false, video: false, voipPush: false})
    process.env.MODULA_CALLS_ENABLED = 'true'
    expect(loadConfig().calls.enabled).toBe(false)
    process.env.MODULA_CALLS_TURN_URLS = 'turn:turn.example.test:3478'
    process.env.MODULA_CALLS_TURN_SECRET = 't'.repeat(40)
    expect(loadConfig().calls.enabled).toBe(false)
    process.env.MODULA_CALLS_TICKET_PEPPER = 'p'.repeat(40)
    const config = loadConfig().calls
    expect(config).toMatchObject({enabled: true, turnTtlSeconds: 600})
    expect(callsCapabilities(config)).toMatchObject({enabled: true, voipPush: false, maxParticipants: 2})
    expect(JSON.stringify(callsCapabilities(config))).not.toContain('t'.repeat(40))
  })

  it('rejects weak secrets and out-of-range credential lifetimes', () => {
    baseEnv()
    process.env.MODULA_CALLS_TURN_SECRET = 'short'
    expect(() => loadConfig()).toThrow()
    delete process.env.MODULA_CALLS_TURN_SECRET
    process.env.MODULA_CALLS_TURN_TTL_SECONDS = '86400'
    expect(() => loadConfig()).toThrow()
  })
})
