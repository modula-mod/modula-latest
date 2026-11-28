import {randomUUID} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {CallEventType, CallState, CallTerminalReason, Database} from '../../database/types.js'
import type {CallsConfig} from '../../config/env.js'
import {encryptWithKey} from '../../security/crypto.js'
import {
  CALL_CREDENTIALS_PER_HOUR,
  CALL_HISTORY_MAX_LIMIT,
  CALL_SIGNALLING_PROTOCOL_VERSION,
  CALL_START_PER_HOUR,
  CALL_START_PER_MINUTE,
  CALL_TICKET_TTL_MS,
  CALL_UNANSWERED_TO_RECIPIENT_PER_HOUR,
  COMMAND_REASONS,
  LIVE_CALL_STATES,
  canTransition,
  deadlineFor,
  expiryOutcome,
  formatCallIdCode,
  hashPushToken,
  hashTicket,
  iceServersFor,
  isTerminal,
  isValidIdempotencyKey,
  newCallIdCode,
  newTicket,
  normalizeCallIdCode,
  policyOutcome,
  resolveCommand,
  turnCredentials,
  uuidv7,
  type CallCommand,
  type CallRole,
  type IceServer,
} from './policy.js'

type Trx = Transaction<Database>
type CallRow = Database['greenfield_calls']
type ParticipantRow = Database['greenfield_call_participants']

/** Error codes are the frozen v1 set; the call-specific meaning travels in `reason`. */
export type CallErrorReason =
  | 'CALL_NOT_ALLOWED' | 'CALL_BUSY' | 'CALL_REVISION_CONFLICT' | 'CALL_ALREADY_ANSWERED'
  | 'CALL_ALREADY_TERMINAL' | 'CALL_RING_EXPIRED' | 'CALLS_UNAVAILABLE' | 'VOIP_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REUSED' | 'RATE_LIMITED' | 'CALL_GROUP_TOO_LARGE' | 'CALL_ID_NOT_FOUND'

export class CallError extends Error {
  constructor(
    readonly code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'REVISION_CONFLICT' | 'RATE_LIMITED' | 'CAPABILITY_UNAVAILABLE' | 'MUTATION_REUSE_CONFLICT' | 'SERVER_ERROR',
    message: string,
    readonly reason?: CallErrorReason,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

const fail = (...args: ConstructorParameters<typeof CallError>): never => { throw new CallError(...args) }
const hidden = (): never => fail('NOT_FOUND', 'Call not found')
const notAllowed = (): never => fail('FORBIDDEN', 'Calling is not available for this conversation', 'CALL_NOT_ALLOWED')

export type CallParticipantDto = {id: string; handle: string; displayName: string; avatarUrl: string | null}

/** One participant as every call viewer sees them. Session ids are never exposed here. */
export type CallGroupParticipantDto = CallParticipantDto & {
  role: 'initiator' | 'recipient' | 'participant'
  response: 'invited' | 'accepted' | 'declined'
  joinedAt: string | null
  mediaState: 'none' | 'connected' | 'disconnected'
}

export type CallDto = {
  id: string
  conversationId: string
  kind: 'direct' | 'group'
  maxParticipants: number
  participantCount: number
  participants: CallGroupParticipantDto[]
  mediaKind: 'audio' | 'video'
  state: CallState
  revision: number
  initiatorActorId: string
  recipientActorId: string | null
  direction: 'outgoing' | 'incoming'
  /** The 1:1 other side; null for group calls, where `participants` is the source of truth. */
  other: CallParticipantDto | null
  ringDeadlineAt: string
  stateDeadlineAt: string | null
  acceptedAt: string | null
  connectedAt: string | null
  endedAt: string | null
  terminalReason: CallTerminalReason | null
  durationMs: number | null
  createdAt: string
  /** True only for the device session that accepted; other recipient devices treat the call as answered elsewhere. */
  answeredHere: boolean | null
}

export type CallSettingsDto = {
  incomingCalls: 'accepted_directs' | 'nobody'
  allowVideo: boolean
  relayOnly: boolean
  version: number
  updatedAt: string | null
}

export type CallActor = {actorId: string; sessionId: string; accountId: string}

export type CallTransition = {call: CallRow; previousState: CallState | null; eventType: CallEventType}

/** One invitee the start call could not invite, and why. */
export type NotInvitedEntry = {actorId: string; reason: 'busy' | 'blocked' | 'unavailable' | 'call_settings'}

export type CallIdDto = {code: string; formatted: string; createdAt: string}

export type CallIdCalleeDto = CallParticipantDto & {callable: true}

function callIdDto(row: Database['greenfield_call_ids']): CallIdDto {
  return {code: row.code, formatted: formatCallIdCode(row.code), createdAt: row.created_at.toISOString()}
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(cursor: unknown): {at: Date; id: string} | null {
  if (typeof cursor !== 'string' || !cursor) return null
  try {
    const [stamp, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    const at = new Date(stamp ?? '')
    if (!id || Number.isNaN(at.getTime())) return null
    return {at, id}
  } catch {
    return null
  }
}

function strictBody(raw: unknown, allowed: string[]): Record<string, unknown> {
  if (raw === undefined || raw === null) return {}
  if (typeof raw !== 'object' || Array.isArray(raw)) fail('VALIDATION_FAILED', 'Body must be an object')
  const body = raw as Record<string, unknown>
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) fail('VALIDATION_FAILED', `Unknown field ${key}`)
  }
  return body
}

function lockKey(actorId: string): string {
  return `greenfield-call-actor:${actorId}`
}

export class CallsService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: CallsConfig,
    private readonly options: {publicApiUrl: string; bundleId: string},
  ) {}

  get enabled(): boolean {
    return this.config.enabled
  }

  get voipEnabled(): boolean {
    return this.config.enabled && this.config.voipTokenKey !== null
  }

  get groupMaxParticipants(): number {
    return this.config.groupMaxParticipants
  }

  requireEnabled(): void {
    if (!this.config.enabled) fail('CAPABILITY_UNAVAILABLE', 'Calls are not available', 'CALLS_UNAVAILABLE')
  }

  // ---- shared lookups --------------------------------------------------------

  private async profiles(actorIds: string[], db: ModulaDb | Trx = this.db): Promise<Map<string, CallParticipantDto>> {
    const map = new Map<string, CallParticipantDto>()
    if (actorIds.length === 0) return map
    const rows = await db.selectFrom('profiles')
      .select(['actor_id', 'handle', 'display_name', 'avatar_url'])
      .where('actor_id', 'in', [...new Set(actorIds)])
      .execute()
    for (const row of rows) map.set(row.actor_id, {id: row.actor_id, handle: row.handle, displayName: row.display_name, avatarUrl: row.avatar_url})
    for (const id of actorIds) if (!map.has(id)) map.set(id, {id, handle: '', displayName: 'Member', avatarUrl: null})
    return map
  }

  private async blockedBetween(db: ModulaDb | Trx, a: string, b: string): Promise<boolean> {
    const row = await db.selectFrom('blocks').select('id')
      .where('deleted_at', 'is', null)
      .where(({eb, or, and}) => or([
        and([eb('blocker_actor_id', '=', a), eb('blocked_actor_id', '=', b)]),
        and([eb('blocker_actor_id', '=', b), eb('blocked_actor_id', '=', a)]),
      ]))
      .executeTakeFirst()
    return Boolean(row)
  }

  private async activeAccount(db: ModulaDb | Trx, actorId: string): Promise<boolean> {
    const row = await db.selectFrom('actors as a')
      .innerJoin('greenfield_accounts as ga', 'ga.account_id', 'a.account_id')
      .select('ga.status')
      .where('a.id', '=', actorId)
      .where('a.deleted_at', 'is', null)
      .executeTakeFirst()
    return row?.status === 'active'
  }

  /**
   * Members of the conversation the viewer may call in: direct conversations
   * need exactly two active members; group conversations need at least two
   * members with the viewer active (pending members are not callable).
   * A pending message request is not enough to call.
   */
  private async callPeers(db: ModulaDb | Trx, conversationId: string, viewer: string): Promise<{kind: 'direct' | 'group'; members: {actorId: string; state: string}[]}> {
    const conversation = await db.selectFrom('greenfield_conversations').select(['kind'])
      .where('conversation_id', '=', conversationId).executeTakeFirst()
    const members = await db.selectFrom('greenfield_conversation_members').select(['actor_id', 'state'])
      .where('conversation_id', '=', conversationId).execute()
    const mine = members.find(m => m.actor_id === viewer)
    if (!conversation || !mine || mine.state === 'declined' || mine.state === 'left' || mine.state === 'removed') hidden()
    if (mine!.state !== 'active') notAllowed()
    if (conversation!.kind === 'direct') {
      if (members.length !== 2) notAllowed()
      return {kind: 'direct', members: members.map(m => ({actorId: m.actor_id, state: m.state}))}
    }
    if (conversation!.kind !== 'group' || members.length < 2) notAllowed()
    return {kind: 'group', members: members.map(m => ({actorId: m.actor_id, state: m.state}))}
  }

  async settingsFor(db: ModulaDb | Trx, actorId: string): Promise<CallSettingsDto> {
    const row = await db.selectFrom('greenfield_call_settings').selectAll().where('actor_id', '=', actorId).executeTakeFirst()
    return {
      incomingCalls: row?.incoming_calls ?? 'accepted_directs',
      allowVideo: row?.allow_video ?? true,
      relayOnly: row?.relay_only ?? false,
      version: row?.version ?? 0,
      updatedAt: iso(row?.updated_at),
    }
  }

  private async dto(row: CallRow, viewer: string, sessionId?: string, db: ModulaDb | Trx = this.db): Promise<CallDto> {
    const partRows = await db.selectFrom('greenfield_call_participants').selectAll()
      .where('call_id', '=', row.call_id).orderBy('joined_at').execute()
    const actorIds = [row.initiator_actor_id, ...(row.recipient_actor_id ? [row.recipient_actor_id] : []), ...partRows.map(p => p.actor_id)]
    const people = await this.profiles(actorIds, db)
    const participants = this.participantDtos(partRows, people)
    const otherId = row.kind === 'direct'
      ? (row.initiator_actor_id === viewer ? row.recipient_actor_id : row.initiator_actor_id)
      : null
    const other = otherId ? people.get(otherId)! : null
    const answeredHere = this.answeredHereFor(row, partRows, viewer, sessionId)
    return this.toDto(row, viewer, other, participants, answeredHere)
  }

  private participantDtos(rows: ParticipantRow[], people: Map<string, CallParticipantDto>): CallGroupParticipantDto[] {
    return rows.map(r => {
      const p = people.get(r.actor_id)!
      return {
        id: p.id, handle: p.handle, displayName: p.displayName, avatarUrl: p.avatarUrl,
        role: r.role, response: r.response, joinedAt: iso(r.joined_at), mediaState: r.media_state,
      }
    })
  }

  /** Viewer-specific answer flag. Direct reads the call row; group reads the viewer's own participant row. */
  private answeredHereFor(row: CallRow, partRows: ParticipantRow[], viewer: string, sessionId?: string): boolean | null {
    if (row.kind === 'direct') {
      if (row.recipient_actor_id === viewer && row.accepted_session_id && sessionId) return row.accepted_session_id === sessionId
      return null
    }
    const mine = partRows.find(p => p.actor_id === viewer)
    if (!mine || mine.response !== 'accepted' || !mine.selected_session_id || !sessionId) return null
    return mine.selected_session_id === sessionId
  }

  private toDto(row: CallRow, viewer: string, other: CallParticipantDto | null, participants: CallGroupParticipantDto[], answeredHere: boolean | null): CallDto {
    const durationMs = row.connected_at && row.ended_at ? Math.max(0, row.ended_at.getTime() - row.connected_at.getTime()) : null
    return {
      id: row.call_id,
      conversationId: row.conversation_id,
      kind: row.kind,
      maxParticipants: row.max_participants,
      participantCount: participants.length,
      participants,
      mediaKind: row.media_kind,
      state: row.state,
      revision: row.revision,
      initiatorActorId: row.initiator_actor_id,
      recipientActorId: row.recipient_actor_id,
      direction: row.initiator_actor_id === viewer ? 'outgoing' : 'incoming',
      other,
      ringDeadlineAt: row.ring_deadline_at.toISOString(),
      stateDeadlineAt: iso(row.state_deadline_at),
      acceptedAt: iso(row.accepted_at),
      connectedAt: iso(row.connected_at),
      endedAt: iso(row.ended_at),
      terminalReason: row.terminal_reason,
      durationMs,
      createdAt: row.created_at.toISOString(),
      answeredHere,
    }
  }

  /** Initiator, the 1:1 recipient, a group participant, or null when the actor is not on the call. */
  private async roleOf(db: ModulaDb | Trx, row: CallRow, actorId: string): Promise<CallRole | null> {
    if (row.initiator_actor_id === actorId) return 'initiator'
    if (row.recipient_actor_id === actorId) return 'recipient'
    const member = await db.selectFrom('greenfield_call_participants').select('actor_id')
      .where('call_id', '=', row.call_id).where('actor_id', '=', actorId).executeTakeFirst()
    return member ? 'participant' : null
  }

  /** Every actor currently on the call (for fan-out publishes). */
  async participantActorIds(callId: string): Promise<string[]> {
    const rows = await this.db.selectFrom('greenfield_call_participants').select('actor_id').where('call_id', '=', callId).execute()
    return rows.map(r => r.actor_id)
  }

  // ---- transitions -----------------------------------------------------------

  /** Apply one transition under an already-held row lock. Never called for an illegal edge. */
  private async transition(trx: Trx, call: CallRow, input: {
    to: CallState
    eventType: CallEventType
    actor?: CallActor | null
    reason?: CallTerminalReason | null
    requestId?: string | null
    idempotencyKey?: string | null
    deviceId?: string | null
    metadata?: Record<string, unknown>
    patch?: Partial<CallRow>
    now: Date
  }): Promise<CallRow> {
    if (!canTransition(call.state, input.to)) throw new Error(`illegal call transition ${call.state} -> ${input.to}`)
    const terminal = isTerminal(input.to)
    const revision = call.revision + 1
    const updated = await trx.updateTable('greenfield_calls')
      .set({
        ...input.patch,
        state: input.to,
        revision,
        state_deadline_at: deadlineFor(input.to, input.now),
        updated_at: input.now,
        ...(terminal ? {ended_at: input.now, terminal_reason: input.reason ?? 'user_action', ended_by_actor_id: input.actor?.actorId ?? null} : {}),
      })
      .where('call_id', '=', call.call_id)
      .where('revision', '=', call.revision)
      .returningAll()
      .executeTakeFirstOrThrow()
    await trx.insertInto('greenfield_call_events').values({
      event_id: randomUUID(),
      call_id: call.call_id,
      revision,
      event_type: input.eventType,
      from_state: call.state,
      to_state: input.to,
      actor_id: input.actor?.actorId ?? null,
      session_id: input.actor?.sessionId ?? null,
      device_id: input.deviceId ?? null,
      request_id: input.requestId ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      reason: input.reason ?? null,
      metadata: JSON.stringify(input.metadata ?? {}),
      occurred_at: input.now,
    }).execute()
    if (terminal) {
      await trx.updateTable('greenfield_call_participants')
        .set({live: false, left_at: input.now, updated_at: input.now})
        .where('call_id', '=', call.call_id).execute()
      await trx.updateTable('greenfield_call_signalling_tickets')
        .set({revoked_at: input.now})
        .where('call_id', '=', call.call_id).where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
    }
    if (input.to !== 'ringing') {
      // Any state other than ringing ends the VoIP lane for this call.
      await trx.updateTable('greenfield_call_device_invitations')
        .set({status: 'cancelled', updated_at: input.now, leased_until: null})
        .where('call_id', '=', call.call_id).where('status', 'in', ['queued', 'sending']).execute()
    }
    return updated
  }

  private async lockCall(trx: Trx, callId: string): Promise<CallRow | undefined> {
    return trx.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).forUpdate().executeTakeFirst()
  }

  /** Expire a locked call whose deadline has passed. Returns the transition when one happened. */
  private async expireIfDue(trx: Trx, call: CallRow, now: Date): Promise<CallRow | null> {
    if (!call.state_deadline_at || call.state_deadline_at.getTime() > now.getTime()) return null
    const outcome = expiryOutcome(call.state)
    if (!outcome) return null
    return this.transition(trx, call, {
      to: outcome.state, eventType: outcome.state === 'missed' ? 'missed' : 'failed', reason: outcome.reason, now,
    })
  }

  // ---- start -------------------------------------------------------------------

  async start(actor: CallActor, conversationId: string, rawBody: unknown, idempotencyKey: unknown, requestId: string):
    Promise<{call: CallDto; replay: boolean; glare: boolean; transition: CallTransition | null; notInvited: NotInvitedEntry[]}> {
    this.requireEnabled()
    if (!isValidIdempotencyKey(idempotencyKey)) fail('VALIDATION_FAILED', 'Idempotency-Key header (16-128 printable characters) is required')
    const body = strictBody(rawBody, ['mediaKind', 'deviceId', 'participantActorIds'])
    const mediaKind = body.mediaKind === 'audio' || body.mediaKind === 'video' ? body.mediaKind : fail('VALIDATION_FAILED', 'mediaKind must be audio or video')
    const deviceId = body.deviceId === undefined || body.deviceId === null ? null
      : typeof body.deviceId === 'string' && body.deviceId.length <= 64 ? body.deviceId : fail('VALIDATION_FAILED', 'Invalid deviceId')
    const requestedIds = body.participantActorIds === undefined || body.participantActorIds === null ? null
      : Array.isArray(body.participantActorIds) && (body.participantActorIds as unknown[]).every(id => typeof id === 'string' && id.length >= 1 && id.length <= 128)
        ? [...new Set(body.participantActorIds as string[])] : fail('VALIDATION_FAILED', 'participantActorIds must be an array of actor ids')
    if (requestedIds && requestedIds.includes(actor.actorId)) fail('VALIDATION_FAILED', 'participantActorIds must not include the caller')

    const existing = await this.db.selectFrom('greenfield_calls').selectAll()
      .where('initiator_actor_id', '=', actor.actorId).where('idempotency_key', '=', idempotencyKey as string)
      .executeTakeFirst()
    if (existing) {
      if (existing.conversation_id !== conversationId || existing.media_kind !== mediaKind) {
        fail('MUTATION_REUSE_CONFLICT', 'Idempotency-Key was used for a different call', 'IDEMPOTENCY_KEY_REUSED')
      }
      return {call: await this.dto(existing, actor.actorId, actor.sessionId), replay: true, glare: false, transition: null, notInvited: []}
    }

    const now = new Date()
    try {
      return await this.db.transaction().execute(async trx => {
        const peers = await this.callPeers(trx, conversationId, actor.actorId)
        const kind = peers.kind
        if (kind === 'direct' && requestedIds) fail('VALIDATION_FAILED', 'participantActorIds is only for group calls')
        const maxParticipants = kind === 'group' ? this.config.groupMaxParticipants : 2
        const activeOthers = peers.members.filter(m => m.actorId !== actor.actorId && m.state === 'active').map(m => m.actorId)
        let inviteeIds: string[]
        if (requestedIds) {
          for (const id of requestedIds) {
            if (!activeOthers.includes(id)) fail('VALIDATION_FAILED', 'participantActorIds must list active members of this conversation')
          }
          inviteeIds = requestedIds
        } else {
          inviteeIds = activeOthers
        }
        if (kind === 'group' && inviteeIds.length > maxParticipants - 1) {
          fail('FORBIDDEN', 'This group is too large for one call; pick fewer people', 'CALL_GROUP_TOO_LARGE')
        }
        if (inviteeIds.length === 0) notAllowed()

        for (const id of [actor.actorId, ...inviteeIds].sort()) {
          await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey(id)}, 0))`.execute(trx)
        }
        if (!(await this.activeAccount(trx, actor.actorId))) notAllowed()

        // Glare precedes the per-invitee gates: if the other side is already
        // ringing this conversation, the caller gets that call back to answer
        // instead of a busy error for a busy recipient. Expire this
        // conversation's stale calls first so a dead ring cannot glare.
        const staleHere = await trx.selectFrom('greenfield_calls').selectAll()
          .where('conversation_id', '=', conversationId)
          .where('state', 'in', [...LIVE_CALL_STATES])
          .where('state_deadline_at', '<=', now)
          .forUpdate().execute()
        for (const row of staleHere) await this.expireIfDue(trx, row, now)
        const liveHere = await trx.selectFrom('greenfield_calls').selectAll()
          .where('conversation_id', '=', conversationId).where('state', 'in', [...LIVE_CALL_STATES]).executeTakeFirst()
        if (liveHere && liveHere.recipient_actor_id === actor.actorId && liveHere.state === 'ringing') {
          return {call: await this.dto(liveHere, actor.actorId, actor.sessionId, trx), replay: false, glare: true, transition: null, notInvited: []}
        }

        // Per-invitee gates: an uncallable invitee is reported, never fatal.
        // The busy check ignores stale calls (past deadline): the stale-expiry
        // pass below would end them, so they must not gate anyone out.
        const notInvited: NotInvitedEntry[] = []
        const invited: string[] = []
        for (const id of inviteeIds) {
          if (await this.blockedBetween(trx, actor.actorId, id)) { notInvited.push({actorId: id, reason: 'blocked'}); continue }
          if (!(await this.activeAccount(trx, id))) { notInvited.push({actorId: id, reason: 'unavailable'}); continue }
          const settings = await this.settingsFor(trx, id)
          if (settings.incomingCalls === 'nobody' || (mediaKind === 'video' && !settings.allowVideo)) { notInvited.push({actorId: id, reason: 'call_settings'}); continue }
          const busy = await trx.selectFrom('greenfield_call_participants as p')
            .innerJoin('greenfield_calls as c', 'c.call_id', 'p.call_id')
            .select('p.actor_id')
            .where('p.live', '=', true).where('p.actor_id', '=', id)
            .where('c.state', 'in', [...LIVE_CALL_STATES])
            .where(eb => eb.or([eb('c.state_deadline_at', 'is', null), eb('c.state_deadline_at', '>', now)]))
            .executeTakeFirst()
          if (busy) { notInvited.push({actorId: id, reason: 'busy'}); continue }
          invited.push(id)
        }
        if (invited.length === 0) {
          // A 1:1 call whose only recipient is busy keeps the old contract:
          // 409 CALL_BUSY, not a 403 with an empty invitee list.
          if (kind === 'direct' && notInvited[0]?.reason === 'busy') {
            fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')
          }
          notAllowed()
        }

        // Expire anything stale for anyone on this call before judging busy state.
        const stale = await trx.selectFrom('greenfield_calls').selectAll()
          .where('state', 'in', [...LIVE_CALL_STATES])
          .where('state_deadline_at', '<=', now)
          .where(({eb, or}) => or([
            eb('initiator_actor_id', 'in', [actor.actorId, ...inviteeIds]),
            eb('recipient_actor_id', 'in', [actor.actorId, ...inviteeIds]),
            eb.exists(
              eb.selectFrom('greenfield_call_participants').select('actor_id')
                .whereRef('greenfield_call_participants.call_id', '=', 'greenfield_calls.call_id')
                .where('greenfield_call_participants.actor_id', 'in', [actor.actorId, ...inviteeIds]),
            ),
          ]))
          .forUpdate().execute()
        for (const row of stale) await this.expireIfDue(trx, row, now)

        const liveInConversation = await trx.selectFrom('greenfield_calls').selectAll()
          .where('conversation_id', '=', conversationId).where('state', 'in', [...LIVE_CALL_STATES]).executeTakeFirst()
        if (liveInConversation) {
          // Both sides pressed call at once: the first committed call wins and
          // the second caller gets it back to answer instead of a busy error.
          if (liveInConversation.recipient_actor_id === actor.actorId && liveInConversation.state === 'ringing') {
            return {call: await this.dto(liveInConversation, actor.actorId, actor.sessionId, trx), replay: false, glare: true, transition: null, notInvited: []}
          }
          fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')
        }
        const busySelf = await trx.selectFrom('greenfield_call_participants').select('actor_id')
          .where('live', '=', true).where('actor_id', '=', actor.actorId).executeTakeFirst()
        if (busySelf) fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')

        const other = kind === 'direct' ? invited[0]! : actor.actorId
        const recent = await trx.selectFrom('greenfield_calls')
          .select([
            sql<number>`count(*) FILTER (WHERE created_at > ${new Date(now.getTime() - 60_000)})::int`.as('minute'),
            sql<number>`count(*)::int`.as('hour'),
            sql<number>`count(*) FILTER (WHERE recipient_actor_id = ${other} AND accepted_at IS NULL)::int`.as('unanswered'),
          ])
          .where('initiator_actor_id', '=', actor.actorId)
          .where('created_at', '>', new Date(now.getTime() - 3_600_000))
          .executeTakeFirstOrThrow()
        if (recent.minute >= CALL_START_PER_MINUTE || recent.hour >= CALL_START_PER_HOUR
          || (kind === 'direct' && recent.unanswered >= CALL_UNANSWERED_TO_RECIPIENT_PER_HOUR)) {
          fail('RATE_LIMITED', 'Too many call attempts; try again later', 'RATE_LIMITED')
        }
        if (deviceId) await this.requireOwnedDevice(trx, actor, deviceId)

        const callId = uuidv7(now.getTime())
        const ringDeadline = deadlineFor('ringing', now)!
        const call = await trx.insertInto('greenfield_calls').values({
          call_id: callId,
          conversation_id: conversationId,
          kind,
          max_participants: maxParticipants,
          initiator_actor_id: actor.actorId,
          recipient_actor_id: kind === 'direct' ? invited[0]! : null,
          media_kind: mediaKind,
          state: 'ringing',
          revision: 1,
          ring_deadline_at: ringDeadline,
          state_deadline_at: ringDeadline,
          accepted_at: null,
          connected_at: null,
          ended_at: null,
          terminal_reason: null,
          ended_by_actor_id: null,
          accepted_session_id: null,
          accepted_device_id: null,
          negotiation_id: null,
          idempotency_key: idempotencyKey as string,
          created_at: now,
          updated_at: now,
        }).returningAll().executeTakeFirstOrThrow()
        const participant = (actorId: string, role: 'initiator' | 'recipient' | 'participant') => ({
          call_id: callId, actor_id: actorId, role, response: role === 'initiator' ? 'accepted' as const : 'invited' as const,
          live: true, selected_session_id: role === 'initiator' ? actor.sessionId : null, selected_device_id: role === 'initiator' ? deviceId : null,
          media_state: 'none' as const, media_negotiation_id: null, credential_window_started_at: null, credential_window_count: 0,
          joined_at: role === 'initiator' ? now : null, left_at: null, updated_at: now,
        })
        await trx.insertInto('greenfield_call_participants').values([
          participant(actor.actorId, 'initiator'),
          ...invited.map(id => participant(id, kind === 'direct' ? 'recipient' as const : 'participant' as const)),
        ]).execute()
        await trx.insertInto('greenfield_call_events').values({
          event_id: randomUUID(), call_id: callId, revision: 1, event_type: 'started', from_state: null, to_state: 'ringing',
          actor_id: actor.actorId, session_id: actor.sessionId, device_id: deviceId, request_id: requestId,
          idempotency_key: idempotencyKey as string, reason: null, metadata: JSON.stringify({mediaKind}), occurred_at: now,
        }).execute()
        if (this.voipEnabled && invited.length > 0) {
          const registrations = await trx.selectFrom('greenfield_call_push_tokens').select(['registration_id', 'actor_id'])
            .where('actor_id', 'in', invited).where('disabled_at', 'is', null).execute()
          if (registrations.length > 0) {
            await trx.insertInto('greenfield_call_device_invitations').values(registrations.map(r => ({
              invitation_id: randomUUID(), call_id: callId, actor_id: r.actor_id, registration_id: r.registration_id,
              status: 'queued' as const, attempts: 0, next_attempt_at: now, deadline_at: ringDeadline, leased_until: null,
              apns_id: null, last_error: null, created_at: now, updated_at: now,
            }))).execute()
          }
        }
        return {
          call: await this.dto(call, actor.actorId, actor.sessionId, trx), replay: false, glare: false,
          transition: {call, previousState: null, eventType: 'started' as const}, notInvited,
        }
      })
    } catch (error: any) {
      if (error?.code === '23505') {
        const replay = await this.db.selectFrom('greenfield_calls').selectAll()
          .where('initiator_actor_id', '=', actor.actorId).where('idempotency_key', '=', idempotencyKey as string).executeTakeFirst()
        if (replay) return {call: await this.dto(replay, actor.actorId, actor.sessionId), replay: true, glare: false, transition: null, notInvited: []}
        fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')
      }
      throw error
    }
  }

  /** Start a 1:1 call by dialling a call ID. The accepted DM must already exist; nothing is created. */
  async startByCallId(actor: CallActor, rawCode: unknown, rawBody: unknown, idempotencyKey: unknown, requestId: string):
    Promise<{call: CallDto; replay: boolean; glare: boolean; transition: CallTransition | null; notInvited: NotInvitedEntry[]}> {
    this.requireEnabled()
    const code = normalizeCallIdCode(rawCode) ?? fail('VALIDATION_FAILED', 'A call ID is 8 digits')
    const found = await this.lookupCallableByCode(actor, code) ?? fail('NOT_FOUND', 'Call ID not found', 'CALL_ID_NOT_FOUND')
    return this.start(actor, found.conversationId, rawBody, idempotencyKey, requestId)
  }

  private async requireOwnedDevice(db: ModulaDb | Trx, actor: CallActor, deviceId: string): Promise<void> {
    const device = await db.selectFrom('push_device_tokens').select(['id'])
      .where('id', '=', deviceId).where('actor_id', '=', actor.actorId).where('account_id', '=', actor.accountId)
      .where('disabled_at', 'is', null).executeTakeFirst()
    if (!device) fail('VALIDATION_FAILED', 'Unknown device')
  }

  // ---- lifecycle commands ----------------------------------------------------------

  async command(actor: CallActor, callId: string, command: CallCommand, rawBody: unknown, idempotencyKey: unknown, requestId: string):
    Promise<{call: CallDto; replay: boolean; transition: CallTransition | null; expired: CallTransition | null}> {
    this.requireEnabled()
    if (!isValidIdempotencyKey(idempotencyKey)) fail('VALIDATION_FAILED', 'Idempotency-Key header (16-128 printable characters) is required')
    const body = strictBody(rawBody, ['deviceId', 'expectedRevision', 'reason'])
    const expectedRevision = body.expectedRevision === undefined || body.expectedRevision === null ? null
      : Number.isInteger(body.expectedRevision) && (body.expectedRevision as number) >= 1 ? body.expectedRevision as number : fail('VALIDATION_FAILED', 'Invalid expectedRevision')
    const reason = body.reason === undefined ? 'user_action'
      : (COMMAND_REASONS[command] as readonly string[]).includes(body.reason as string) ? body.reason as CallTerminalReason : fail('VALIDATION_FAILED', 'Unsupported reason')
    const deviceId = body.deviceId === undefined || body.deviceId === null ? null
      : typeof body.deviceId === 'string' && body.deviceId.length <= 64 ? body.deviceId : fail('VALIDATION_FAILED', 'Invalid deviceId')
    const now = new Date()

    const result = await this.db.transaction().execute(async trx => {
      let call = await this.lockCall(trx, callId)
      const role = call ? await this.roleOf(trx, call, actor.actorId) : null
      if (!call || !role) return hidden()
      const replay = await trx.selectFrom('greenfield_call_events').select('event_id')
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).where('idempotency_key', '=', idempotencyKey as string)
        .executeTakeFirst()
      if (replay) return {call, replay: true, transition: null, expired: null}

      const expiredRow = await this.expireIfDue(trx, call, now)
      let expired: CallTransition | null = null
      if (expiredRow) {
        expired = {call: expiredRow, previousState: call.state, eventType: expiredRow.state === 'missed' ? 'missed' : 'failed'}
        call = expiredRow
        if (command === 'accept') return {expiredOnly: true as const, call, expired}
      }
      if (isTerminal(call.state)) return {terminal: true as const, call, expired}
      if (expectedRevision !== null && expectedRevision !== call.revision) {
        return {conflict: true as const, call, expired}
      }
      if (deviceId) await this.requireOwnedDevice(trx, actor, deviceId)
      const isGroup = call.kind === 'group'
      const myRow = await trx.selectFrom('greenfield_call_participants').selectAll()
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).executeTakeFirstOrThrow()

      // ---- group non-transition paths: join, withdraw, leave ----
      if (isGroup && role === 'participant') {
        if (command === 'accept' && (call.state === 'connecting' || call.state === 'active') && myRow.response === 'invited') {
          // Late join: the seat is taken, the call state does not move.
          await trx.updateTable('greenfield_call_participants')
            .set({response: 'accepted', selected_session_id: actor.sessionId, selected_device_id: deviceId, joined_at: now, updated_at: now})
            .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
          await trx.updateTable('greenfield_call_signalling_tickets').set({revoked_at: now})
            .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).where('session_id', '<>', actor.sessionId)
            .where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
          return {call, replay: false, transition: null, expired}
        }
        if ((command === 'decline' || command === 'end') && (call.state === 'connecting' || call.state === 'active' || call.state === 'reconnecting') && myRow.response === 'invited') {
          // Withdraw an unanswered invitation; the call continues for everyone else.
          await trx.updateTable('greenfield_call_participants')
            .set({response: 'declined', live: false, left_at: now, updated_at: now})
            .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
          return {call, replay: false, transition: null, expired}
        }
        if (command === 'end' && (call.state === 'connecting' || call.state === 'active' || call.state === 'reconnecting') && myRow.response === 'accepted') {
          // Leave: only the participant's seat closes. The call ends when fewer
          // than two live participants remain.
          await trx.updateTable('greenfield_call_participants')
            .set({live: false, left_at: now, media_state: 'none', updated_at: now})
            .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
          await trx.updateTable('greenfield_call_signalling_tickets').set({revoked_at: now})
            .where('call_id', '=', callId).where('actor_id', '=', actor.actorId)
            .where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
          const remaining = await trx.selectFrom('greenfield_call_participants').select('actor_id')
            .where('call_id', '=', callId).where('live', '=', true).execute()
          if (remaining.length < 2) {
            const ended = await this.transition(trx, call, {
              to: 'ended', eventType: 'ended', actor, reason: 'user_action', requestId, idempotencyKey: idempotencyKey as string, deviceId, now,
            })
            return {call: ended, replay: false, transition: {call: ended, previousState: call.state, eventType: 'ended' as const}, expired}
          }
          return {call, replay: false, transition: null, expired}
        }
      }

      const resolved = resolveCommand(command, role, call.state)
      if ('error' in resolved) {
        if (resolved.error === 'FORBIDDEN') return {forbidden: true as const, call, expired}
        if (command === 'accept' && call.accepted_session_id) return {answered: true as const, call, expired}
        return {invalid: true as const, call, expired}
      }

      if (resolved.event === 'accepted') {
        const counterpart = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
        if (await this.blockedBetween(trx, actor.actorId, counterpart!) || !(await this.activeAccount(trx, counterpart!))) {
          const revoked = await this.transition(trx, call, {to: 'failed', eventType: 'failed', reason: 'policy_revoked', actor, requestId, now})
          return {revoked: true as const, call: revoked, expired: {call: revoked, previousState: call.state, eventType: 'failed' as const}}
        }
        const accepted = await this.transition(trx, call, {
          to: 'connecting', eventType: 'accepted', actor, requestId, idempotencyKey: idempotencyKey as string, deviceId, now,
          // The call-level answering session is a 1:1 concept; the call-level
          // accepted_at is set on first accept for both kinds, so the
          // connected_at ordering check holds when media connects.
          patch: call.kind === 'direct' ? {accepted_at: now, accepted_session_id: actor.sessionId, accepted_device_id: deviceId} : {accepted_at: now},
        })
        await trx.updateTable('greenfield_call_participants')
          .set({response: 'accepted', selected_session_id: actor.sessionId, selected_device_id: deviceId, joined_at: now, updated_at: now})
          .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
        // Tickets other recipient sessions were issued while ringing stop working now.
        await trx.updateTable('greenfield_call_signalling_tickets').set({revoked_at: now})
          .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).where('session_id', '<>', actor.sessionId)
          .where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
        return {call: accepted, replay: false, transition: {call: accepted, previousState: call.state, eventType: 'accepted' as const}, expired}
      }

      if (resolved.event === 'declined' && isGroup && call.state === 'ringing') {
        // Group decline: the call ends only when every invitee has declined.
        await trx.updateTable('greenfield_call_participants')
          .set({response: 'declined', live: false, left_at: now, updated_at: now})
          .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
        const stillInvited = await trx.selectFrom('greenfield_call_participants').select('actor_id')
          .where('call_id', '=', callId).where('response', '=', 'invited').executeTakeFirst()
        if (stillInvited) return {call, replay: false, transition: null, expired}
        const declined = await this.transition(trx, call, {
          to: resolved.to, eventType: 'declined', actor, reason: 'declined', requestId, idempotencyKey: idempotencyKey as string, deviceId, now,
        })
        return {call: declined, replay: false, transition: {call: declined, previousState: call.state, eventType: 'declined' as const}, expired}
      }

      const terminalReason: CallTerminalReason = resolved.event === 'ended' ? reason : resolved.event === 'declined' && reason === 'busy' ? 'busy' : resolved.reason!
      const ended = await this.transition(trx, call, {
        to: resolved.to, eventType: resolved.event, actor, reason: terminalReason, requestId, idempotencyKey: idempotencyKey as string, deviceId, now,
      })
      if (resolved.event === 'declined') {
        await trx.updateTable('greenfield_call_participants').set({response: 'declined', updated_at: now})
          .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
      }
      return {call: ended, replay: false, transition: {call: ended, previousState: call.state, eventType: resolved.event}, expired}
    })

    const dto = await this.dto(result.call, actor.actorId, actor.sessionId)
    const details = {call: dto}
    if ('expiredOnly' in result) fail('CONFLICT', 'The call is no longer ringing', 'CALL_RING_EXPIRED', {...details, expired: result.expired})
    if ('terminal' in result) fail('CONFLICT', 'The call has already ended', 'CALL_ALREADY_TERMINAL', {...details, expired: result.expired})
    if ('conflict' in result) fail('REVISION_CONFLICT', 'The call changed; reload and retry', 'CALL_REVISION_CONFLICT', {...details, revision: result.call.revision, expired: result.expired})
    if ('forbidden' in result) fail('FORBIDDEN', 'That action is not available for your side of the call', 'CALL_NOT_ALLOWED')
    if ('answered' in result) fail('CONFLICT', 'The call was answered on another device', 'CALL_ALREADY_ANSWERED', details)
    if ('invalid' in result) fail('CONFLICT', 'That action is not available in the current call state', 'CALL_ALREADY_TERMINAL', details)
    if ('revoked' in result) fail('FORBIDDEN', 'Calling is not available for this conversation', 'CALL_NOT_ALLOWED', {expired: result.expired})
    return {call: dto, replay: result.replay === true, transition: result.transition ?? null, expired: result.expired}
  }

  /** Error helper for routes: a failed command can still carry a transition to publish. */
  static expiredFrom(error: unknown): CallTransition | null {
    if (error instanceof CallError && error.details.expired) return error.details.expired as CallTransition
    return null
  }

  // ---- media reports (from the signalling socket) --------------------------------------

  async reportMedia(actor: {actorId: string; sessionId: string}, callId: string, report: {
    type: 'connected' | 'disconnected' | 'reconnect_started'
    negotiationId: string
  }): Promise<CallTransition | null> {
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const call = await this.lockCall(trx, callId)
      if (!call || !(await this.roleOf(trx, call, actor.actorId)) || isTerminal(call.state)) return null
      if (call.state === 'ringing') return null
      const mediaState = report.type === 'connected' ? 'connected' as const : report.type === 'disconnected' ? 'disconnected' as const : 'none' as const
      await trx.updateTable('greenfield_call_participants')
        .set({media_state: mediaState, media_negotiation_id: report.negotiationId, updated_at: now})
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
      if (report.type === 'reconnect_started') {
        // Direct calls track the single renegotiation on the call row; group
        // pairs renegotiate independently, so only the participant row carries it.
        if (call.kind === 'direct') {
          await trx.updateTable('greenfield_calls').set({negotiation_id: report.negotiationId, updated_at: now}).where('call_id', '=', callId).execute()
        }
        return null
      }
      const participants = await trx.selectFrom('greenfield_call_participants').select(['media_state', 'media_negotiation_id'])
        .where('call_id', '=', callId).execute()
      const connected = participants.filter(p => p.media_state === 'connected')
      if (report.type === 'disconnected') {
        if (call.state !== 'active') return null
        // One mesh leg dropping must not end the call while enough media remains.
        if (connected.length >= 2) return null
        const next = await this.transition(trx, call, {to: 'reconnecting', eventType: 'media_disconnected', actor: {...actor, accountId: ''}, now})
        return {call: next, previousState: call.state, eventType: 'media_disconnected' as const}
      }
      if (call.state !== 'connecting' && call.state !== 'reconnecting') return null
      // Direct: both sides connected on the same negotiation. Group: any two
      // participants connected (mesh pairs negotiate independently).
      const ready = call.kind === 'direct'
        ? participants.length === 2 && connected.length === 2 && participants.every(p => p.media_negotiation_id === report.negotiationId)
        : connected.length >= 2
      if (!ready) return null
      const eventType = call.state === 'connecting' ? 'media_connected' as const : 'reconnected' as const
      const next = await this.transition(trx, call, {
        to: 'active', eventType, actor: {...actor, accountId: ''}, now,
        patch: {connected_at: call.connected_at ?? now, ...(call.kind === 'direct' ? {negotiation_id: report.negotiationId} : {})},
      })
      return {call: next, previousState: call.state, eventType}
    })
  }

  // ---- deadlines and policy ----------------------------------------------------------

  /** Claim and expire overdue calls. Safe across API instances (SKIP LOCKED). */
  async sweepDeadlines(now = new Date(), limit = 50): Promise<CallTransition[]> {
    return this.db.transaction().execute(async trx => {
      const due = await trx.selectFrom('greenfield_calls').selectAll()
        .where('state', 'in', ['ringing', 'connecting', 'reconnecting'])
        .where('state_deadline_at', '<=', now)
        .orderBy('state_deadline_at').limit(limit)
        .forUpdate().skipLocked().execute()
      const out: CallTransition[] = []
      for (const call of due) {
        const next = await this.expireIfDue(trx, call, now)
        if (next) out.push({call: next, previousState: call.state, eventType: next.state === 'missed' ? 'missed' : 'failed'})
      }
      return out
    })
  }

  /** A new block ends any live 1:1 call between the pair. */
  async endForBlock(a: string, b: string): Promise<CallTransition[]> {
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const live = await trx.selectFrom('greenfield_calls').selectAll()
        .where('state', 'in', [...LIVE_CALL_STATES])
        .where(({eb, or, and}) => or([
          and([eb('initiator_actor_id', '=', a), eb('recipient_actor_id', '=', b)]),
          and([eb('initiator_actor_id', '=', b), eb('recipient_actor_id', '=', a)]),
        ]))
        .forUpdate().execute()
      const out: CallTransition[] = []
      for (const call of live) {
        const to = policyOutcome(call.state)
        if (!to) continue
        const next = await this.transition(trx, call, {to, eventType: to === 'ended' ? 'ended' : 'failed', reason: 'blocked', now})
        out.push({call: next, previousState: call.state, eventType: to === 'ended' ? 'ended' : 'failed'})
      }
      // Group calls: a block between the initiator and a participant removes
      // that participant. A block between two non-initiators leaves the call
      // alone — two members blocking each other must not end a group call.
      const groupLive = await trx.selectFrom('greenfield_calls').selectAll()
        .where('kind', '=', 'group').where('state', 'in', [...LIVE_CALL_STATES]).forUpdate().execute()
      for (const call of groupLive) {
        const rows = await trx.selectFrom('greenfield_call_participants').select(['actor_id', 'live'])
          .where('call_id', '=', call.call_id).where('live', '=', true).execute()
        const ids = new Set(rows.map(r => r.actor_id))
        if (!ids.has(a) || !ids.has(b)) continue
        const removable = call.initiator_actor_id === a ? b : call.initiator_actor_id === b ? a : null
        if (!removable) continue
        await trx.updateTable('greenfield_call_participants')
          .set({live: false, left_at: now, media_state: 'none', updated_at: now})
          .where('call_id', '=', call.call_id).where('actor_id', '=', removable).execute()
        await trx.updateTable('greenfield_call_signalling_tickets').set({revoked_at: now})
          .where('call_id', '=', call.call_id).where('actor_id', '=', removable)
          .where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
        if (rows.length - 1 < 2) {
          const to = policyOutcome(call.state)
          if (!to) continue
          const next = await this.transition(trx, call, {to, eventType: to === 'ended' ? 'ended' : 'failed', reason: 'blocked', now})
          out.push({call: next, previousState: call.state, eventType: to === 'ended' ? 'ended' : 'failed'})
        }
      }
      return out
    })
  }

  /** Re-derive authorization for a live socket. False means close it. */
  async stillAuthorized(actorId: string, callId: string): Promise<boolean> {
    const call = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    if (!call || isTerminal(call.state) || !(await this.roleOf(this.db, call, actorId))) return false
    // Group calls check the block against the initiator only; two invitees
    // blocking each other does not close either socket (see endForBlock).
    const counterpart = call.kind === 'group'
      ? call.initiator_actor_id
      : call.initiator_actor_id === actorId ? call.recipient_actor_id! : call.initiator_actor_id
    if (await this.blockedBetween(this.db, actorId, counterpart)) return false
    return this.activeAccount(this.db, actorId)
  }

  // ---- reads ----------------------------------------------------------------------------

  async snapshot(actor: CallActor, callId: string): Promise<{call: CallDto; expired: CallTransition | null}> {
    this.requireEnabled()
    const row = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    if (!row || !(await this.roleOf(this.db, row, actor.actorId))) hidden()
    let expired: CallTransition | null = null
    let current = row!
    if (row!.state_deadline_at && row!.state_deadline_at.getTime() <= Date.now() && !isTerminal(row!.state)) {
      const next = await this.db.transaction().execute(async trx => {
        const locked = await this.lockCall(trx, callId)
        return locked ? {before: locked.state, after: await this.expireIfDue(trx, locked, new Date())} : null
      })
      if (next?.after) {
        current = next.after
        expired = {call: next.after, previousState: next.before, eventType: next.after.state === 'missed' ? 'missed' : 'failed'}
      }
    }
    return {call: await this.dto(current, actor.actorId, actor.sessionId), expired}
  }

  async history(actor: CallActor, query: Record<string, unknown>): Promise<{items: CallDto[]; nextCursor: string | null; hasMore: boolean}> {
    this.requireEnabled()
    const limit = Math.min(CALL_HISTORY_MAX_LIMIT, Math.max(1, Number.parseInt(String(query.limit ?? '30'), 10) || 30))
    const cursor = query.cursor === undefined ? null : decodeCursor(query.cursor)
    if (query.cursor !== undefined && !cursor) fail('VALIDATION_FAILED', 'Invalid cursor')
    const conversationId = typeof query.conversationId === 'string' && query.conversationId ? query.conversationId.slice(0, 64) : null
    if (conversationId) {
      const member = await this.db.selectFrom('greenfield_conversation_members').select('state')
        .where('conversation_id', '=', conversationId).where('actor_id', '=', actor.actorId).executeTakeFirst()
      if (!member || member.state === 'declined' || member.state === 'left' || member.state === 'removed') hidden()
    }
    let q = this.db.selectFrom('greenfield_calls').selectAll()
      .where(({eb}) => eb.exists(
        eb.selectFrom('greenfield_call_participants').select('actor_id')
          .whereRef('greenfield_call_participants.call_id', '=', 'greenfield_calls.call_id')
          .where('greenfield_call_participants.actor_id', '=', actor.actorId),
      ))
    if (conversationId) q = q.where('conversation_id', '=', conversationId)
    if (cursor) {
      q = q.where(({eb, or, and}) => or([
        eb('created_at', '<', cursor.at),
        and([eb('created_at', '=', cursor.at), eb('call_id', '<', cursor.id)]),
      ]))
    }
    const rows = await q.orderBy('created_at', 'desc').orderBy('call_id', 'desc').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const partRows = page.length > 0
      ? await this.db.selectFrom('greenfield_call_participants').selectAll().where('call_id', 'in', page.map(r => r.call_id)).execute()
      : []
    const people = await this.profiles([
      ...page.flatMap(r => [r.initiator_actor_id, ...(r.recipient_actor_id ? [r.recipient_actor_id] : [])]),
      ...partRows.map(p => p.actor_id),
    ])
    const items = page.map(r => {
      const participants = this.participantDtos(partRows.filter(p => p.call_id === r.call_id), people)
      const otherId = r.kind === 'direct'
        ? (r.initiator_actor_id === actor.actorId ? r.recipient_actor_id : r.initiator_actor_id)
        : null
      return this.toDto(r, actor.actorId, otherId ? people.get(otherId)! : null, participants, this.answeredHereFor(r, partRows.filter(p => p.call_id === r.call_id), actor.actorId, actor.sessionId))
    })
    const last = page.at(-1)
    return {items, nextCursor: hasMore && last ? encodeCursor(last.created_at, last.call_id) : null, hasMore}
  }

  // ---- signalling tickets ---------------------------------------------------------------

  async issueTicket(actor: CallActor, callId: string, rawBody: unknown): Promise<{ticket: string; url: string; protocolVersion: number; expiresAt: string; heartbeatMs: number}> {
    this.requireEnabled()
    const body = strictBody(rawBody, ['deviceId'])
    const deviceId = body.deviceId === undefined || body.deviceId === null ? null
      : typeof body.deviceId === 'string' && body.deviceId.length <= 64 ? body.deviceId : fail('VALIDATION_FAILED', 'Invalid deviceId')
    const call = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    const role = call ? await this.roleOf(this.db, call, actor.actorId) : null
    if (!call || !role) return hidden()
    if (isTerminal(call.state)) fail('CONFLICT', 'The call has already ended', 'CALL_ALREADY_TERMINAL')
    if (role === 'recipient' && call.accepted_session_id && call.accepted_session_id !== actor.sessionId) {
      fail('CONFLICT', 'The call was answered on another device', 'CALL_ALREADY_ANSWERED')
    }
    if (role === 'participant') {
      const myRow = await this.db.selectFrom('greenfield_call_participants').select(['response', 'selected_session_id'])
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).executeTakeFirst()
      if (myRow?.response === 'accepted' && myRow.selected_session_id && myRow.selected_session_id !== actor.sessionId) {
        fail('CONFLICT', 'The call was answered on another device', 'CALL_ALREADY_ANSWERED')
      }
    }
    const other = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
    if (other && await this.blockedBetween(this.db, actor.actorId, other)) notAllowed()
    if (deviceId) await this.requireOwnedDevice(this.db, actor, deviceId)
    const now = new Date()
    const ticket = newTicket()
    const expiresAt = new Date(now.getTime() + CALL_TICKET_TTL_MS)
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_call_signalling_tickets').set({revoked_at: now})
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).where('session_id', '=', actor.sessionId)
        .where('consumed_at', 'is', null).where('revoked_at', 'is', null).execute()
      await trx.insertInto('greenfield_call_signalling_tickets').values({
        ticket_id: randomUUID(), ticket_hash: hashTicket(ticket, this.config.ticketPepper!), call_id: callId,
        actor_id: actor.actorId, session_id: actor.sessionId, device_id: deviceId, expires_at: expiresAt,
        consumed_at: null, revoked_at: null, created_at: now,
      }).execute()
    })
    const base = this.options.publicApiUrl.replace(/^http/, 'ws').replace(/\/$/, '')
    return {
      ticket,
      url: `${base}/v1/calls/${callId}/signalling`,
      protocolVersion: CALL_SIGNALLING_PROTOCOL_VERSION,
      expiresAt: expiresAt.toISOString(),
      heartbeatMs: 15_000,
    }
  }

  /** Atomically consume a ticket at upgrade time. Null for anything that is not exactly right. */
  async consumeTicket(raw: string, callId: string): Promise<{actorId: string; sessionId: string; deviceId: string | null} | null> {
    if (!this.config.enabled || !this.config.ticketPepper || !/^[A-Za-z0-9_-]{43}$/.test(raw)) return null
    const now = new Date()
    const row = await this.db.updateTable('greenfield_call_signalling_tickets')
      .set({consumed_at: now})
      .where('ticket_hash', '=', hashTicket(raw, this.config.ticketPepper))
      .where('call_id', '=', callId)
      .where('consumed_at', 'is', null).where('revoked_at', 'is', null).where('expires_at', '>', now)
      .returning(['actor_id', 'session_id', 'device_id'])
      .executeTakeFirst()
    if (!row) return null
    if (!(await this.stillAuthorized(row.actor_id, callId))) return null
    return {actorId: row.actor_id, sessionId: row.session_id, deviceId: row.device_id}
  }

  /** Server-side snapshot for the socket's `server.ready`. */
  async socketSnapshot(actorId: string, sessionId: string, callId: string): Promise<CallDto | null> {
    const row = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    if (!row || !(await this.roleOf(this.db, row, actorId))) return null
    return this.dto(row, actorId, sessionId)
  }

  async dtoFor(row: CallRow, actorId: string): Promise<CallDto> {
    return this.dto(row, actorId)
  }

  // ---- media credentials -------------------------------------------------------------------

  async mediaCredentials(actor: CallActor, callId: string): Promise<{iceServers: IceServer[]; iceTransportPolicy: 'all' | 'relay'; expiresAt: string; credentialVersion: number; ttlSeconds: number}> {
    this.requireEnabled()
    const now = new Date()
    return this.db.transaction().execute(async trx => {
      const call = await this.lockCall(trx, callId)
      const role = call ? await this.roleOf(trx, call, actor.actorId) : null
      if (!call || !role) return hidden()
      if (isTerminal(call.state)) fail('CONFLICT', 'The call has already ended', 'CALL_ALREADY_TERMINAL')
      const participant = await trx.selectFrom('greenfield_call_participants').selectAll()
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).executeTakeFirstOrThrow()
      // A recipient gets relay credentials only once its device has answered.
      // Group invitees answer per participant row, not the call-level session.
      if (role === 'recipient' && call.accepted_session_id !== actor.sessionId) {
        fail('CONFLICT', call.accepted_session_id ? 'The call was answered on another device' : 'Answer the call first', call.accepted_session_id ? 'CALL_ALREADY_ANSWERED' : 'CALL_NOT_ALLOWED')
      }
      if (role === 'participant' && participant.response !== 'accepted') {
        fail('CONFLICT', participant.selected_session_id ? 'The call was answered on another device' : 'Answer the call first', participant.selected_session_id ? 'CALL_ALREADY_ANSWERED' : 'CALL_NOT_ALLOWED')
      }
      const other = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
      if (other && await this.blockedBetween(trx, actor.actorId, other)) notAllowed()
      const windowOpen = participant.credential_window_started_at && now.getTime() - participant.credential_window_started_at.getTime() < 3_600_000
      const count = windowOpen ? participant.credential_window_count : 0
      if (count >= CALL_CREDENTIALS_PER_HOUR) fail('RATE_LIMITED', 'Too many credential requests for this call', 'RATE_LIMITED')
      await trx.updateTable('greenfield_call_participants')
        .set({
          credential_window_started_at: windowOpen ? participant.credential_window_started_at : now,
          credential_window_count: count + 1,
          updated_at: now,
        })
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
      const settings = await this.settingsFor(trx, actor.actorId)
      const creds = turnCredentials({
        secret: this.config.turnSecret!, callId, actorId: actor.actorId, sessionId: actor.sessionId, ttlSeconds: this.config.turnTtlSeconds, now,
      })
      return {
        iceServers: iceServersFor({stunUrls: this.config.stunUrls, turnUrls: this.config.turnUrls, username: creds.username, credential: creds.credential}),
        iceTransportPolicy: settings.relayOnly ? 'relay' : 'all',
        expiresAt: creds.expiresAt.toISOString(),
        credentialVersion: 1,
        ttlSeconds: this.config.turnTtlSeconds,
      }
    })
  }

  // ---- dialable call IDs -------------------------------------------------------------------

  /**
   * Mint my call ID, or return the live one. Naturally idempotent: one live
   * code per account, so a repeated mint returns the same code (the
   * Idempotency-Key is validated by the route but needs no stored replay).
   */
  async mintCallId(actor: CallActor): Promise<{callId: CallIdDto; isNew: boolean}> {
    this.requireEnabled()
    const existing = await this.db.selectFrom('greenfield_call_ids').selectAll()
      .where('actor_id', '=', actor.actorId).where('revoked_at', 'is', null).executeTakeFirst()
    if (existing) return {callId: callIdDto(existing), isNew: false}
    const now = new Date()
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = newCallIdCode()
      try {
        const row = await this.db.insertInto('greenfield_call_ids').values({
          code, actor_id: actor.actorId, account_id: actor.accountId,
          created_at: now, revoked_at: null, revoked_reason: null,
        }).returningAll().executeTakeFirstOrThrow()
        return {callId: callIdDto(row), isNew: true}
      } catch (error: any) {
        if (error?.code !== '23505') throw error
      }
    }
    throw new CallError('SERVER_ERROR', 'Unable to issue a call ID')
  }

  async myCallId(actor: CallActor): Promise<CallIdDto> {
    this.requireEnabled()
    const row = await this.db.selectFrom('greenfield_call_ids').selectAll()
      .where('actor_id', '=', actor.actorId).where('revoked_at', 'is', null).executeTakeFirst()
    if (!row) fail('NOT_FOUND', 'No call ID', 'CALL_ID_NOT_FOUND')
    return callIdDto(row!)
  }

  async revokeCallId(actor: CallActor): Promise<void> {
    this.requireEnabled()
    const now = new Date()
    const result = await this.db.updateTable('greenfield_call_ids')
      .set({revoked_at: now, revoked_reason: 'user_removed'})
      .where('actor_id', '=', actor.actorId).where('revoked_at', 'is', null)
      .executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) fail('NOT_FOUND', 'No call ID', 'CALL_ID_NOT_FOUND')
  }

  /** Public resolve: the callee card only. The DM id stays internal (see lookupCallableByCode). */
  async resolveCallId(viewer: CallActor, rawCode: unknown): Promise<{callee: CallIdCalleeDto}> {
    this.requireEnabled()
    const code = normalizeCallIdCode(rawCode) ?? fail('VALIDATION_FAILED', 'A call ID is 8 digits')
    const found = await this.lookupCallableByCode(viewer, code) ?? fail('NOT_FOUND', 'Call ID not found', 'CALL_ID_NOT_FOUND')
    return {callee: found.callee}
  }

  /**
   * Resolve a code to a callable person. Every failure mode returns null so
   * the caller cannot distinguish unknown, revoked, blocked, unavailable,
   * call-rejecting, or no-accepted-DM — the endpoint is not an existence oracle.
   */
  private async lookupCallableByCode(viewer: CallActor, code: string): Promise<{callee: CallIdCalleeDto; conversationId: string} | null> {
    const row = await this.db.selectFrom('greenfield_call_ids').selectAll()
      .where('code', '=', code).where('revoked_at', 'is', null).executeTakeFirst()
    if (!row || row.actor_id === viewer.actorId) return null
    if (!(await this.activeAccount(this.db, row.actor_id))) return null
    if (await this.blockedBetween(this.db, viewer.actorId, row.actor_id)) return null
    const settings = await this.settingsFor(this.db, row.actor_id)
    if (settings.incomingCalls === 'nobody') return null
    const directKey = [viewer.actorId, row.actor_id].sort().join(':')
    const conversation = await this.db.selectFrom('greenfield_conversations').select('conversation_id')
      .where('direct_key', '=', directKey).where('kind', '=', 'direct').executeTakeFirst()
    if (!conversation) return null
    const members = await this.db.selectFrom('greenfield_conversation_members').select(['actor_id', 'state'])
      .where('conversation_id', '=', conversation.conversation_id).execute()
    if (members.length !== 2 || members.some(m => m.state !== 'active')) return null
    const person = (await this.profiles([row.actor_id])).get(row.actor_id)!
    return {callee: {...person, callable: true as const}, conversationId: conversation.conversation_id}
  }

  // ---- call settings ---------------------------------------------------------------------------

  async getSettings(actor: CallActor): Promise<CallSettingsDto> {
    this.requireEnabled()
    return this.settingsFor(this.db, actor.actorId)
  }

  async updateSettings(actor: CallActor, rawBody: unknown): Promise<CallSettingsDto> {
    this.requireEnabled()
    const body = strictBody(rawBody, ['incomingCalls', 'allowVideo', 'relayOnly', 'expectedVersion'])
    if (!Number.isInteger(body.expectedVersion) || (body.expectedVersion as number) < 0) fail('VALIDATION_FAILED', 'expectedVersion is required')
    if (body.incomingCalls !== undefined && body.incomingCalls !== 'accepted_directs' && body.incomingCalls !== 'nobody') fail('VALIDATION_FAILED', 'Invalid incomingCalls')
    for (const key of ['allowVideo', 'relayOnly'] as const) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') fail('VALIDATION_FAILED', `${key} must be a boolean`)
    }
    return this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'greenfield-call-settings:' + actor.actorId}, 0))`.execute(trx)
      const current = await this.settingsFor(trx, actor.actorId)
      if (body.expectedVersion !== current.version) fail('REVISION_CONFLICT', 'Call settings changed; reload and retry', undefined, {version: current.version})
      const now = new Date()
      const next = {
        incoming_calls: (body.incomingCalls as CallSettingsDto['incomingCalls'] | undefined) ?? current.incomingCalls,
        allow_video: (body.allowVideo as boolean | undefined) ?? current.allowVideo,
        relay_only: (body.relayOnly as boolean | undefined) ?? current.relayOnly,
        version: current.version + 1,
        updated_at: now,
      }
      await trx.insertInto('greenfield_call_settings').values({actor_id: actor.actorId, ...next})
        .onConflict(oc => oc.column('actor_id').doUpdateSet(next)).execute()
      return this.settingsFor(trx, actor.actorId)
    })
  }

  // ---- PushKit VoIP registrations -----------------------------------------------------------

  async registerVoip(actor: CallActor, rawBody: unknown): Promise<VoipRegistrationDto> {
    this.requireEnabled()
    if (!this.voipEnabled) fail('CAPABILITY_UNAVAILABLE', 'VoIP push is not configured', 'VOIP_UNAVAILABLE')
    const body = strictBody(rawBody, ['deviceId', 'token', 'environment', 'appVersion'])
    const token = typeof body.token === 'string' && /^[0-9a-fA-F]{64,200}$/.test(body.token) ? body.token.toLowerCase() : fail('VALIDATION_FAILED', 'token must be the hex PushKit token')
    const deviceId = typeof body.deviceId === 'string' && body.deviceId.length <= 64 ? body.deviceId : fail('VALIDATION_FAILED', 'deviceId is required')
    const environment = body.environment === 'development' || body.environment === 'production' ? body.environment : fail('VALIDATION_FAILED', 'Invalid environment')
    const appVersion = body.appVersion === undefined ? null : typeof body.appVersion === 'string' && body.appVersion.length <= 40 ? body.appVersion : fail('VALIDATION_FAILED', 'Invalid appVersion')
    const now = new Date()
    const topic = `${this.options.bundleId}.voip`
    const tokenHash = hashPushToken(token)
    return this.db.transaction().execute(async trx => {
      await this.requireOwnedDevice(trx, actor, deviceId)
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'greenfield-voip:' + tokenHash}, 0))`.execute(trx)
      // One live registration per device; a token seen under another actor moves (sign-in reassignment).
      await trx.updateTable('greenfield_call_push_tokens').set({disabled_at: now, disabled_reason: 'replaced', updated_at: now})
        .where('device_id', '=', deviceId).where('token_hash', '<>', tokenHash).where('disabled_at', 'is', null).execute()
      const ciphertext = encryptWithKey(token, this.config.voipTokenKey!)
      const existing = await trx.selectFrom('greenfield_call_push_tokens').select(['registration_id'])
        .where('token_hash', '=', tokenHash).executeTakeFirst()
      let registrationId: string
      if (existing) {
        registrationId = existing.registration_id
        await trx.updateTable('greenfield_call_push_tokens').set({
          account_id: actor.accountId, actor_id: actor.actorId, device_id: deviceId, token_ciphertext: ciphertext, key_version: 1,
          environment, topic, app_version: appVersion, updated_at: now, last_seen_at: now, disabled_at: null, disabled_reason: null,
        }).where('registration_id', '=', registrationId).execute()
      } else {
        registrationId = randomUUID()
        await trx.insertInto('greenfield_call_push_tokens').values({
          registration_id: registrationId, account_id: actor.accountId, actor_id: actor.actorId, device_id: deviceId,
          token_hash: tokenHash, token_ciphertext: ciphertext, key_version: 1, environment, topic, app_version: appVersion,
          created_at: now, updated_at: now, last_seen_at: now, disabled_at: null, disabled_reason: null,
        }).execute()
      }
      const row = await trx.selectFrom('greenfield_call_push_tokens').selectAll().where('registration_id', '=', registrationId).executeTakeFirstOrThrow()
      return voipDto(row)
    })
  }

  async listVoip(actor: CallActor): Promise<VoipRegistrationDto[]> {
    this.requireEnabled()
    const rows = await this.db.selectFrom('greenfield_call_push_tokens').selectAll()
      .where('actor_id', '=', actor.actorId).where('account_id', '=', actor.accountId).where('disabled_at', 'is', null)
      .orderBy('created_at', 'desc').execute()
    return rows.map(voipDto)
  }

  async deleteVoip(actor: CallActor, registrationId: string): Promise<void> {
    this.requireEnabled()
    const now = new Date()
    const result = await this.db.updateTable('greenfield_call_push_tokens')
      .set({disabled_at: now, disabled_reason: 'user_removed', updated_at: now})
      .where('registration_id', '=', registrationId).where('actor_id', '=', actor.actorId).where('disabled_at', 'is', null)
      .executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) fail('NOT_FOUND', 'Registration not found')
  }
}

export type VoipRegistrationDto = {
  registrationId: string
  deviceId: string
  environment: 'development' | 'production'
  topic: string
  appVersion: string | null
  createdAt: string
  lastSeenAt: string
}

function voipDto(row: Database['greenfield_call_push_tokens']): VoipRegistrationDto {
  return {
    registrationId: row.registration_id,
    deviceId: row.device_id,
    environment: row.environment,
    topic: row.topic,
    appVersion: row.app_version,
    createdAt: row.created_at.toISOString(),
    lastSeenAt: row.last_seen_at.toISOString(),
  }
}
