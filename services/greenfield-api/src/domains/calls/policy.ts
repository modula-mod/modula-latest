import {createHash, createHmac, randomBytes} from 'node:crypto'
import type {CallState, CallTerminalReason} from '../../database/types.js'

/**
 * Pure call policy: the state machine from calls-state-machine.mmd, deadlines,
 * TURN REST credentials and small id/ticket helpers. No I/O here so every rule
 * can be unit tested exhaustively.
 */

export const CALL_RING_TIMEOUT_MS = 30_000
export const CALL_NEGOTIATION_TIMEOUT_MS = 20_000
export const CALL_RECONNECT_GRACE_MS = 30_000
export const CALL_TICKET_TTL_MS = 60_000
export const CALL_SIGNALLING_PROTOCOL_VERSION = 1
export const CALL_SIGNALLING_HEARTBEAT_MS = 15_000
export const CALL_SIGNALLING_STALE_MS = 45_000
export const CALL_SIGNALLING_AUTH_RECHECK_MS = 60_000
/** Strict JSON frames; SDP bodies are bounded separately. */
export const CALL_FRAME_MAX_BYTES = 72 * 1024
export const CALL_SDP_MAX_BYTES = 64 * 1024
export const CALL_ICE_CANDIDATE_MAX_BYTES = 2 * 1024
export const CALL_ICE_CANDIDATES_PER_NEGOTIATION = 256
export const CALL_FRAMES_PER_SECOND = 50
export const CALL_START_PER_MINUTE = 5
export const CALL_START_PER_HOUR = 20
export const CALL_UNANSWERED_TO_RECIPIENT_PER_HOUR = 5
export const CALL_CREDENTIALS_PER_HOUR = 6
export const CALL_HISTORY_MAX_LIMIT = 50

export const LIVE_CALL_STATES: readonly CallState[] = ['ringing', 'connecting', 'active', 'reconnecting']
export const TERMINAL_CALL_STATES: readonly CallState[] = ['declined', 'cancelled', 'missed', 'ended', 'failed']

export function isTerminal(state: CallState): boolean {
  return TERMINAL_CALL_STATES.includes(state)
}

/** The canonical transition table (calls-state-machine.mmd). Terminal states have no exits. */
export const CALL_TRANSITIONS: Readonly<Record<CallState, readonly CallState[]>> = {
  ringing: ['connecting', 'declined', 'cancelled', 'missed', 'failed'],
  connecting: ['active', 'ended', 'failed'],
  active: ['reconnecting', 'ended'],
  reconnecting: ['active', 'ended', 'failed'],
  declined: [],
  cancelled: [],
  missed: [],
  ended: [],
  failed: [],
}

export function canTransition(from: CallState, to: CallState): boolean {
  return CALL_TRANSITIONS[from].includes(to)
}

/** Deadline for a state that has one, measured from `now`. */
export function deadlineFor(state: CallState, now: Date): Date | null {
  switch (state) {
    case 'ringing': return new Date(now.getTime() + CALL_RING_TIMEOUT_MS)
    case 'connecting': return new Date(now.getTime() + CALL_NEGOTIATION_TIMEOUT_MS)
    case 'reconnecting': return new Date(now.getTime() + CALL_RECONNECT_GRACE_MS)
    default: return null
  }
}

/** What an expired deadline turns a state into, or null when that state has no deadline. */
export function expiryOutcome(state: CallState): {state: CallState; reason: CallTerminalReason} | null {
  switch (state) {
    case 'ringing': return {state: 'missed', reason: 'no_answer'}
    case 'connecting': return {state: 'failed', reason: 'negotiation_timeout'}
    case 'reconnecting': return {state: 'failed', reason: 'reconnect_timeout'}
    default: return null
  }
}

/** Policy termination (block, authorization loss) from any live state. */
export function policyOutcome(state: CallState): CallState | null {
  if (state === 'ringing') return 'failed'
  if (state === 'connecting' || state === 'active' || state === 'reconnecting') return 'ended'
  return null
}

export type CallCommand = 'accept' | 'decline' | 'cancel' | 'end'

/** Endpoint-specific reason enums. Never free text. */
export const COMMAND_REASONS: Readonly<Record<CallCommand, readonly CallTerminalReason[]>> = {
  accept: ['user_action'],
  decline: ['user_action', 'busy'],
  cancel: ['user_action'],
  end: ['user_action', 'media_failed'],
}

/**
 * Resolve a lifecycle command for the actor's role and the current state.
 * `end` while still ringing maps to the role's natural command (cancel or
 * decline) so a client hanging up early always lands in the right terminal
 * state.
 */
export function resolveCommand(
  command: CallCommand,
  role: 'initiator' | 'recipient',
  state: CallState,
): {to: CallState; reason: CallTerminalReason | null; event: 'accepted' | 'declined' | 'cancelled' | 'ended'} | {error: 'FORBIDDEN' | 'INVALID_STATE'} {
  if (isTerminal(state)) return {error: 'INVALID_STATE'}
  if (command === 'end' && state === 'ringing') command = role === 'initiator' ? 'cancel' : 'decline'
  switch (command) {
    case 'accept':
      if (role !== 'recipient') return {error: 'FORBIDDEN'}
      return state === 'ringing' ? {to: 'connecting', reason: null, event: 'accepted'} : {error: 'INVALID_STATE'}
    case 'decline':
      if (role !== 'recipient') return {error: 'FORBIDDEN'}
      return state === 'ringing' ? {to: 'declined', reason: 'declined', event: 'declined'} : {error: 'INVALID_STATE'}
    case 'cancel':
      if (role !== 'initiator') return {error: 'FORBIDDEN'}
      return state === 'ringing' ? {to: 'cancelled', reason: 'cancelled', event: 'cancelled'} : {error: 'INVALID_STATE'}
    case 'end':
      return {to: 'ended', reason: 'user_action', event: 'ended'}
  }
}

// ---- ids, tickets, credentials -------------------------------------------

/** RFC 9562 UUIDv7: time-ordered, valid as a CallKit UUID. */
export function uuidv7(now = Date.now()): string {
  const bytes = randomBytes(16)
  const ms = BigInt(now)
  for (let i = 0; i < 6; i++) bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn)
  bytes[6] = (bytes[6]! & 0x0f) | 0x70
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function newTicket(): string {
  return randomBytes(32).toString('base64url')
}

export function hashTicket(ticket: string, pepper: string): string {
  return createHash('sha256').update(pepper).update('\u0000').update(ticket).digest('hex')
}

export function hashPushToken(token: string): string {
  return createHash('sha256').update('voip\u0000').update(token.toLowerCase()).digest('hex')
}

export type IceServer = {urls: string[]; username?: string; credential?: string}

/**
 * coturn TURN REST credentials (`use-auth-secret` / `static-auth-secret`):
 * username = "<unix expiry>:<pseudonym>", credential = base64(HMAC-SHA1(secret, username)).
 * The pseudonym binds call, actor and session without revealing any of them.
 */
export function turnCredentials(input: {
  secret: string
  callId: string
  actorId: string
  sessionId: string
  ttlSeconds: number
  now?: Date
}): {username: string; credential: string; expiresAt: Date} {
  const now = input.now ?? new Date()
  const expiry = Math.floor(now.getTime() / 1000) + input.ttlSeconds
  const pseudonym = createHmac('sha256', input.secret)
    .update(`${input.callId}|${input.actorId}|${input.sessionId}`)
    .digest('hex')
    .slice(0, 24)
  const username = `${expiry}:${pseudonym}`
  const credential = createHmac('sha1', input.secret).update(username).digest('base64')
  return {username, credential, expiresAt: new Date(expiry * 1000)}
}

export function iceServersFor(input: {
  stunUrls: string[]
  turnUrls: string[]
  username: string
  credential: string
}): IceServer[] {
  const servers: IceServer[] = []
  if (input.stunUrls.length > 0) servers.push({urls: input.stunUrls})
  servers.push({urls: input.turnUrls, username: input.username, credential: input.credential})
  return servers
}

export function isValidIdempotencyKey(value: unknown): value is string {
  return typeof value === 'string' && /^[\x21-\x7e]{16,128}$/.test(value)
}
