import {
  CALL_FRAME_MAX_BYTES,
  CALL_FRAMES_PER_SECOND,
  CALL_ICE_CANDIDATE_MAX_BYTES,
  CALL_ICE_CANDIDATES_PER_NEGOTIATION,
  CALL_SDP_MAX_BYTES,
  CALL_SIGNALLING_PROTOCOL_VERSION,
} from './policy.js'

/**
 * In-process call signalling relay. SDP and ICE live only in memory for the
 * moment they are relayed: they are never logged or persisted.
 *
 * Single-instance: both participants must reach the same API process. The
 * architecture's Redis Pub/Sub bus is required before running more than one
 * API replica (see docs/ops/calls-coturn.md).
 */

export type SignallingPeer = {
  actorId: string
  sessionId: string
  send: (frame: Record<string, unknown>) => void
  close: (code: number, reason: string) => void
}

export const CALL_SOCKETS_PER_ACTOR = 2

const RELAY_TYPES = new Set(['signal.offer', 'signal.answer', 'signal.ice_candidate', 'signal.ice_complete'])
const CLIENT_TYPES = new Set([
  'client.ready', 'signal.offer', 'signal.answer', 'signal.ice_candidate', 'signal.ice_complete',
  'media.connected', 'media.disconnected', 'media.reconnect_started', 'call.end', 'ping',
])
const ENVELOPE_KEYS = new Set(['protocolVersion', 'type', 'messageId', 'callId', 'negotiationId', 'expectedRevision', 'sentAt', 'payload'])
const MEDIA_DISCONNECT_REASONS = new Set(['ice_failed', 'ice_disconnected', 'network_change', 'audio_interrupted', 'unknown'])

export type ClientFrame = {
  type: string
  messageId: string
  callId: string
  negotiationId: string | null
  payload: Record<string, unknown>
}

export type FrameError = {error: string}

const ID = /^[A-Za-z0-9._:-]{8,64}$/

/** Strict validation of one client frame. Returns the frame or a machine error code. */
export function parseClientFrame(raw: string | Buffer, callId: string): ClientFrame | FrameError {
  const size = typeof raw === 'string' ? Buffer.byteLength(raw) : raw.length
  if (size > CALL_FRAME_MAX_BYTES) return {error: 'FRAME_TOO_LARGE'}
  let value: any
  try { value = JSON.parse(raw.toString()) } catch { return {error: 'INVALID_JSON'} }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {error: 'INVALID_FRAME'}
  for (const key of Object.keys(value)) if (!ENVELOPE_KEYS.has(key)) return {error: 'UNKNOWN_FIELD'}
  if (value.protocolVersion !== CALL_SIGNALLING_PROTOCOL_VERSION) return {error: 'UNSUPPORTED_PROTOCOL'}
  if (typeof value.type !== 'string' || !CLIENT_TYPES.has(value.type)) return {error: 'UNKNOWN_TYPE'}
  if (typeof value.messageId !== 'string' || !ID.test(value.messageId)) return {error: 'INVALID_MESSAGE_ID'}
  if (value.callId !== callId) return {error: 'CALL_MISMATCH'}
  if (value.negotiationId !== undefined && value.negotiationId !== null && (typeof value.negotiationId !== 'string' || !ID.test(value.negotiationId))) {
    return {error: 'INVALID_NEGOTIATION_ID'}
  }
  const payload = value.payload ?? {}
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {error: 'INVALID_PAYLOAD'}
  const frame: ClientFrame = {type: value.type, messageId: value.messageId, callId, negotiationId: value.negotiationId ?? null, payload}
  const keys = Object.keys(payload)
  const only = (...allowed: string[]) => keys.every(key => allowed.includes(key))
  switch (frame.type) {
    case 'signal.offer':
    case 'signal.answer':
      if (!frame.negotiationId || !only('sdp') || typeof payload.sdp !== 'string' || payload.sdp.length === 0) return {error: 'INVALID_PAYLOAD'}
      if (Buffer.byteLength(payload.sdp) > CALL_SDP_MAX_BYTES) return {error: 'SDP_TOO_LARGE'}
      return frame
    case 'signal.ice_candidate': {
      if (!frame.negotiationId || !only('candidate', 'sdpMid', 'sdpMLineIndex')) return {error: 'INVALID_PAYLOAD'}
      if (typeof payload.candidate !== 'string' || Buffer.byteLength(payload.candidate) > CALL_ICE_CANDIDATE_MAX_BYTES) return {error: 'INVALID_PAYLOAD'}
      if (payload.sdpMid !== undefined && payload.sdpMid !== null && (typeof payload.sdpMid !== 'string' || payload.sdpMid.length > 32)) return {error: 'INVALID_PAYLOAD'}
      if (payload.sdpMLineIndex !== undefined && payload.sdpMLineIndex !== null && (!Number.isInteger(payload.sdpMLineIndex) || payload.sdpMLineIndex < 0 || payload.sdpMLineIndex > 16)) return {error: 'INVALID_PAYLOAD'}
      return frame
    }
    case 'signal.ice_complete':
      return frame.negotiationId && keys.length === 0 ? frame : {error: 'INVALID_PAYLOAD'}
    case 'media.connected':
      if (!frame.negotiationId || !only('iceType', 'audio', 'video')) return {error: 'INVALID_PAYLOAD'}
      if (payload.iceType !== undefined && !['host', 'srflx', 'prflx', 'relay'].includes(payload.iceType as string)) return {error: 'INVALID_PAYLOAD'}
      return frame
    case 'media.disconnected':
      if (!frame.negotiationId || !only('reason') || (payload.reason !== undefined && !MEDIA_DISCONNECT_REASONS.has(payload.reason as string))) return {error: 'INVALID_PAYLOAD'}
      return frame
    case 'media.reconnect_started':
      return frame.negotiationId && keys.length === 0 ? frame : {error: 'INVALID_PAYLOAD'}
    case 'call.end':
      if (!only('reason', 'idempotencyKey')) return {error: 'INVALID_PAYLOAD'}
      if (payload.reason !== undefined && payload.reason !== 'user_action' && payload.reason !== 'media_failed') return {error: 'INVALID_PAYLOAD'}
      if (typeof payload.idempotencyKey !== 'string' || !/^[\x21-\x7e]{16,128}$/.test(payload.idempotencyKey)) return {error: 'INVALID_PAYLOAD'}
      return frame
    case 'client.ready':
      return only('lastSequence', 'capabilities') ? frame : {error: 'INVALID_PAYLOAD'}
    case 'ping':
      return only('clientTime') ? frame : {error: 'INVALID_PAYLOAD'}
    default:
      return {error: 'UNKNOWN_TYPE'}
  }
}

export function isRelayType(type: string): boolean {
  return RELAY_TYPES.has(type)
}

/** Token bucket: CALL_FRAMES_PER_SECOND sustained with a small burst. */
export class FrameRateLimiter {
  private tokens: number
  private last = Date.now()
  constructor(private readonly rate = CALL_FRAMES_PER_SECOND, private readonly burst = CALL_FRAMES_PER_SECOND * 2) {
    this.tokens = burst
  }
  take(now = Date.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.last) / 1000) * this.rate)
    this.last = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}

type CallRoom = {
  sequence: number
  peers: Map<string, SignallingPeer[]>
  candidates: Map<string, number>
  seen: Map<string, Set<string>>
}

export class CallSignallingHub {
  private readonly rooms = new Map<string, CallRoom>()

  private room(callId: string): CallRoom {
    let room = this.rooms.get(callId)
    if (!room) {
      room = {sequence: 0, peers: new Map(), candidates: new Map(), seen: new Map()}
      this.rooms.set(callId, room)
    }
    return room
  }

  /** Adds a peer; the newest socket for an actor is the selected one. Returns an unsubscribe. */
  join(callId: string, peer: SignallingPeer): () => void {
    const room = this.room(callId)
    const list = room.peers.get(peer.actorId) ?? []
    // Bounded handover: keep at most two sockets per actor; drop the oldest.
    while (list.length >= CALL_SOCKETS_PER_ACTOR) list.shift()?.close(4409, 'Replaced by a newer connection')
    list.push(peer)
    room.peers.set(peer.actorId, list)
    return () => {
      const current = this.rooms.get(callId)
      if (!current) return
      const peers = (current.peers.get(peer.actorId) ?? []).filter(p => p !== peer)
      if (peers.length === 0) current.peers.delete(peer.actorId)
      else current.peers.set(peer.actorId, peers)
      if (current.peers.size === 0) this.rooms.delete(callId)
    }
  }

  connected(callId: string, actorId: string): boolean {
    return (this.rooms.get(callId)?.peers.get(actorId)?.length ?? 0) > 0
  }

  /** True the first time a messageId is seen for this sender in this call. */
  firstSeen(callId: string, actorId: string, messageId: string): boolean {
    const room = this.room(callId)
    const seen = room.seen.get(actorId) ?? new Set<string>()
    if (seen.has(messageId)) return false
    seen.add(messageId)
    if (seen.size > 1024) seen.delete(seen.values().next().value as string)
    room.seen.set(actorId, seen)
    return true
  }

  /** Counts ICE candidates per negotiation; false once the cap is reached. */
  allowCandidate(callId: string, actorId: string, negotiationId: string): boolean {
    const room = this.room(callId)
    const key = `${actorId}|${negotiationId}`
    const count = (room.candidates.get(key) ?? 0) + 1
    room.candidates.set(key, count)
    return count <= CALL_ICE_CANDIDATES_PER_NEGOTIATION
  }

  private frame(callId: string, type: string, payload: Record<string, unknown>, extra: Record<string, unknown> = {}): Record<string, unknown> {
    const room = this.room(callId)
    room.sequence += 1
    return {protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION, type, sequence: room.sequence, callId, sentAt: new Date().toISOString(), ...extra, payload}
  }

  /** Relay to the other participant's selected (newest) socket. Returns whether a socket received it. */
  relay(callId: string, fromActorId: string, frame: ClientFrame): boolean {
    const room = this.rooms.get(callId)
    if (!room) return false
    for (const [actorId, peers] of room.peers) {
      if (actorId === fromActorId) continue
      const target = peers.at(-1)
      if (!target) continue
      try {
        target.send(this.frame(callId, frame.type, frame.payload, {messageId: frame.messageId, negotiationId: frame.negotiationId}))
        return true
      } catch {
        return false
      }
    }
    return false
  }

  sendTo(callId: string, actorId: string, type: string, payload: Record<string, unknown>): void {
    for (const peer of this.rooms.get(callId)?.peers.get(actorId) ?? []) {
      try { peer.send(this.frame(callId, type, payload)) } catch { /* closed */ }
    }
  }

  /** Send a per-recipient payload to every socket in the call. */
  broadcast(callId: string, build: (actorId: string) => {type: string; payload: Record<string, unknown>} | null): void {
    for (const actorId of [...(this.rooms.get(callId)?.peers.keys() ?? [])]) {
      const event = build(actorId)
      if (event) this.sendTo(callId, actorId, event.type, event.payload)
    }
  }

  closeCall(callId: string, code: number, reason: string): void {
    const room = this.rooms.get(callId)
    if (!room) return
    for (const peers of room.peers.values()) for (const peer of [...peers]) peer.close(code, reason)
    this.rooms.delete(callId)
  }

  closeActor(callId: string, actorId: string, code: number, reason: string): void {
    for (const peer of [...(this.rooms.get(callId)?.peers.get(actorId) ?? [])]) peer.close(code, reason)
  }

  socketCount(): number {
    let total = 0
    for (const room of this.rooms.values()) for (const peers of room.peers.values()) total += peers.length
    return total
  }
}
