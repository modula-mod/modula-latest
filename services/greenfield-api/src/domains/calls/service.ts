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
  hashPushToken,
  hashTicket,
  iceServersFor,
  isTerminal,
  isValidIdempotencyKey,
  newTicket,
  policyOutcome,
  resolveCommand,
  turnCredentials,
  uuidv7,
  type CallCommand,
  type IceServer,
} from './policy.js'

type Trx = Transaction<Database>
type CallRow = Database['greenfield_calls']

/** Error codes are the frozen v1 set; the call-specific meaning travels in `reason`. */
export type CallErrorReason =
  | 'CALL_NOT_ALLOWED' | 'CALL_BUSY' | 'CALL_REVISION_CONFLICT' | 'CALL_ALREADY_ANSWERED'
  | 'CALL_ALREADY_TERMINAL' | 'CALL_RING_EXPIRED' | 'CALLS_UNAVAILABLE' | 'VOIP_UNAVAILABLE'
  | 'IDEMPOTENCY_KEY_REUSED' | 'RATE_LIMITED'

export class CallError extends Error {
  constructor(
    readonly code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT' | 'REVISION_CONFLICT' | 'RATE_LIMITED' | 'CAPABILITY_UNAVAILABLE' | 'MUTATION_REUSE_CONFLICT',
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

export type CallDto = {
  id: string
  conversationId: string
  mediaKind: 'audio' | 'video'
  state: CallState
  revision: number
  initiatorActorId: string
  recipientActorId: string
  direction: 'outgoing' | 'incoming'
  other: CallParticipantDto
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

  requireEnabled(): void {
    if (!this.config.enabled) fail('CAPABILITY_UNAVAILABLE', 'Calls are not available', 'CALLS_UNAVAILABLE')
  }

  // ---- shared lookups --------------------------------------------------------

  private async profiles(actorIds: string[]): Promise<Map<string, CallParticipantDto>> {
    const map = new Map<string, CallParticipantDto>()
    if (actorIds.length === 0) return map
    const rows = await this.db.selectFrom('profiles')
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
   * Both actors must be active members of the same accepted direct conversation.
   * A pending message request is not enough to call.
   */
  private async directPeers(db: ModulaDb | Trx, conversationId: string, viewer: string): Promise<{other: string}> {
    const conversation = await db.selectFrom('greenfield_conversations').select(['kind'])
      .where('conversation_id', '=', conversationId).executeTakeFirst()
    const members = await db.selectFrom('greenfield_conversation_members').select(['actor_id', 'state'])
      .where('conversation_id', '=', conversationId).execute()
    const mine = members.find(m => m.actor_id === viewer)
    if (!conversation || !mine || mine.state === 'declined' || mine.state === 'left' || mine.state === 'removed') hidden()
    if (conversation!.kind !== 'direct' || members.length !== 2) notAllowed()
    const other = members.find(m => m.actor_id !== viewer)!
    if (mine!.state !== 'active' || other.state !== 'active') notAllowed()
    return {other: other.actor_id}
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

  private async dto(row: CallRow, viewer: string, sessionId?: string): Promise<CallDto> {
    const otherId = row.initiator_actor_id === viewer ? row.recipient_actor_id : row.initiator_actor_id
    const other = (await this.profiles([otherId])).get(otherId)!
    return this.toDto(row, viewer, other, sessionId)
  }

  private toDto(row: CallRow, viewer: string, other: CallParticipantDto, sessionId?: string): CallDto {
    const durationMs = row.connected_at && row.ended_at ? Math.max(0, row.ended_at.getTime() - row.connected_at.getTime()) : null
    let answeredHere: boolean | null = null
    if (row.recipient_actor_id === viewer && row.accepted_session_id && sessionId) answeredHere = row.accepted_session_id === sessionId
    return {
      id: row.call_id,
      conversationId: row.conversation_id,
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

  private roleOf(row: CallRow, actorId: string): 'initiator' | 'recipient' | null {
    if (row.initiator_actor_id === actorId) return 'initiator'
    if (row.recipient_actor_id === actorId) return 'recipient'
    return null
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
    Promise<{call: CallDto; replay: boolean; glare: boolean; transition: CallTransition | null}> {
    this.requireEnabled()
    if (!isValidIdempotencyKey(idempotencyKey)) fail('VALIDATION_FAILED', 'Idempotency-Key header (16-128 printable characters) is required')
    const body = strictBody(rawBody, ['mediaKind', 'deviceId'])
    const mediaKind = body.mediaKind === 'audio' || body.mediaKind === 'video' ? body.mediaKind : fail('VALIDATION_FAILED', 'mediaKind must be audio or video')
    const deviceId = body.deviceId === undefined || body.deviceId === null ? null
      : typeof body.deviceId === 'string' && body.deviceId.length <= 64 ? body.deviceId : fail('VALIDATION_FAILED', 'Invalid deviceId')

    const existing = await this.db.selectFrom('greenfield_calls').selectAll()
      .where('initiator_actor_id', '=', actor.actorId).where('idempotency_key', '=', idempotencyKey as string)
      .executeTakeFirst()
    if (existing) {
      if (existing.conversation_id !== conversationId || existing.media_kind !== mediaKind) {
        fail('MUTATION_REUSE_CONFLICT', 'Idempotency-Key was used for a different call', 'IDEMPOTENCY_KEY_REUSED')
      }
      return {call: await this.dto(existing, actor.actorId, actor.sessionId), replay: true, glare: false, transition: null}
    }

    const now = new Date()
    try {
      return await this.db.transaction().execute(async trx => {
        const {other} = await this.directPeers(trx, conversationId, actor.actorId)
        for (const id of [actor.actorId, other].sort()) {
          await sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey(id)}, 0))`.execute(trx)
        }
        if (await this.blockedBetween(trx, actor.actorId, other)) notAllowed()
        if (!(await this.activeAccount(trx, other)) || !(await this.activeAccount(trx, actor.actorId))) notAllowed()
        const settings = await this.settingsFor(trx, other)
        if (settings.incomingCalls === 'nobody' || (mediaKind === 'video' && !settings.allowVideo)) notAllowed()

        // Expire anything stale for either actor before judging busy state.
        const stale = await trx.selectFrom('greenfield_calls').selectAll()
          .where('state', 'in', [...LIVE_CALL_STATES])
          .where('state_deadline_at', '<=', now)
          .where(({eb, or}) => or([
            eb('initiator_actor_id', 'in', [actor.actorId, other]),
            eb('recipient_actor_id', 'in', [actor.actorId, other]),
          ]))
          .forUpdate().execute()
        for (const row of stale) await this.expireIfDue(trx, row, now)

        const liveInConversation = await trx.selectFrom('greenfield_calls').selectAll()
          .where('conversation_id', '=', conversationId).where('state', 'in', [...LIVE_CALL_STATES]).executeTakeFirst()
        if (liveInConversation) {
          // Both sides pressed call at once: the first committed call wins and
          // the second caller gets it back to answer instead of a busy error.
          if (liveInConversation.recipient_actor_id === actor.actorId && liveInConversation.state === 'ringing') {
            return {call: await this.dto(liveInConversation, actor.actorId, actor.sessionId), replay: false, glare: true, transition: null}
          }
          fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')
        }
        const busy = await trx.selectFrom('greenfield_call_participants').select('actor_id')
          .where('live', '=', true).where('actor_id', 'in', [actor.actorId, other]).executeTakeFirst()
        if (busy) fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')

        const recent = await trx.selectFrom('greenfield_calls')
          .select([
            sql<number>`count(*) FILTER (WHERE created_at > ${new Date(now.getTime() - 60_000)})::int`.as('minute'),
            sql<number>`count(*)::int`.as('hour'),
            sql<number>`count(*) FILTER (WHERE recipient_actor_id = ${other} AND accepted_at IS NULL)::int`.as('unanswered'),
          ])
          .where('initiator_actor_id', '=', actor.actorId)
          .where('created_at', '>', new Date(now.getTime() - 3_600_000))
          .executeTakeFirstOrThrow()
        if (recent.minute >= CALL_START_PER_MINUTE || recent.hour >= CALL_START_PER_HOUR || recent.unanswered >= CALL_UNANSWERED_TO_RECIPIENT_PER_HOUR) {
          fail('RATE_LIMITED', 'Too many call attempts; try again later', 'RATE_LIMITED')
        }
        if (deviceId) await this.requireOwnedDevice(trx, actor, deviceId)

        const callId = uuidv7(now.getTime())
        const ringDeadline = deadlineFor('ringing', now)!
        const call = await trx.insertInto('greenfield_calls').values({
          call_id: callId,
          conversation_id: conversationId,
          initiator_actor_id: actor.actorId,
          recipient_actor_id: other,
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
        const participant = (actorId: string, role: 'initiator' | 'recipient') => ({
          call_id: callId, actor_id: actorId, role, response: role === 'initiator' ? 'accepted' as const : 'invited' as const,
          live: true, selected_session_id: role === 'initiator' ? actor.sessionId : null, selected_device_id: role === 'initiator' ? deviceId : null,
          media_state: 'none' as const, media_negotiation_id: null, credential_window_started_at: null, credential_window_count: 0,
          joined_at: role === 'initiator' ? now : null, left_at: null, updated_at: now,
        })
        await trx.insertInto('greenfield_call_participants').values([participant(actor.actorId, 'initiator'), participant(other, 'recipient')]).execute()
        await trx.insertInto('greenfield_call_events').values({
          event_id: randomUUID(), call_id: callId, revision: 1, event_type: 'started', from_state: null, to_state: 'ringing',
          actor_id: actor.actorId, session_id: actor.sessionId, device_id: deviceId, request_id: requestId,
          idempotency_key: idempotencyKey as string, reason: null, metadata: JSON.stringify({mediaKind}), occurred_at: now,
        }).execute()
        if (this.voipEnabled) {
          const registrations = await trx.selectFrom('greenfield_call_push_tokens').select(['registration_id'])
            .where('actor_id', '=', other).where('disabled_at', 'is', null).execute()
          if (registrations.length > 0) {
            await trx.insertInto('greenfield_call_device_invitations').values(registrations.map(r => ({
              invitation_id: randomUUID(), call_id: callId, actor_id: other, registration_id: r.registration_id,
              status: 'queued' as const, attempts: 0, next_attempt_at: now, deadline_at: ringDeadline, leased_until: null,
              apns_id: null, last_error: null, created_at: now, updated_at: now,
            }))).execute()
          }
        }
        return {
          call: await this.dto(call, actor.actorId, actor.sessionId), replay: false, glare: false,
          transition: {call, previousState: null, eventType: 'started' as const},
        }
      })
    } catch (error: any) {
      if (error?.code === '23505') {
        const replay = await this.db.selectFrom('greenfield_calls').selectAll()
          .where('initiator_actor_id', '=', actor.actorId).where('idempotency_key', '=', idempotencyKey as string).executeTakeFirst()
        if (replay) return {call: await this.dto(replay, actor.actorId, actor.sessionId), replay: true, glare: false, transition: null}
        fail('CONFLICT', 'A call is already in progress', 'CALL_BUSY')
      }
      throw error
    }
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
      const role = call ? this.roleOf(call, actor.actorId) : null
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
      const resolved = resolveCommand(command, role, call.state)
      if ('error' in resolved) {
        if (resolved.error === 'FORBIDDEN') return {forbidden: true as const, call, expired}
        if (command === 'accept' && call.accepted_session_id) return {answered: true as const, call, expired}
        return {invalid: true as const, call, expired}
      }

      const other = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
      if (resolved.event === 'accepted') {
        if (await this.blockedBetween(trx, actor.actorId, other) || !(await this.activeAccount(trx, other))) {
          const revoked = await this.transition(trx, call, {to: 'failed', eventType: 'failed', reason: 'policy_revoked', actor, requestId, now})
          return {revoked: true as const, call: revoked, expired: {call: revoked, previousState: call.state, eventType: 'failed' as const}}
        }
        const accepted = await this.transition(trx, call, {
          to: 'connecting', eventType: 'accepted', actor, requestId, idempotencyKey: idempotencyKey as string, deviceId, now,
          patch: {accepted_at: now, accepted_session_id: actor.sessionId, accepted_device_id: deviceId},
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
      if (!call || !this.roleOf(call, actor.actorId) || isTerminal(call.state)) return null
      if (call.state === 'ringing') return null
      const mediaState = report.type === 'connected' ? 'connected' as const : report.type === 'disconnected' ? 'disconnected' as const : 'none' as const
      await trx.updateTable('greenfield_call_participants')
        .set({media_state: mediaState, media_negotiation_id: report.negotiationId, updated_at: now})
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).execute()
      if (report.type === 'reconnect_started') {
        await trx.updateTable('greenfield_calls').set({negotiation_id: report.negotiationId, updated_at: now}).where('call_id', '=', callId).execute()
        return null
      }
      if (report.type === 'disconnected') {
        if (call.state !== 'active') return null
        const next = await this.transition(trx, call, {to: 'reconnecting', eventType: 'media_disconnected', actor: {...actor, accountId: ''}, now})
        return {call: next, previousState: call.state, eventType: 'media_disconnected' as const}
      }
      if (call.state !== 'connecting' && call.state !== 'reconnecting') return null
      const participants = await trx.selectFrom('greenfield_call_participants').select(['media_state', 'media_negotiation_id'])
        .where('call_id', '=', callId).execute()
      const ready = participants.length === 2 && participants.every(p => p.media_state === 'connected' && p.media_negotiation_id === report.negotiationId)
      if (!ready) return null
      const eventType = call.state === 'connecting' ? 'media_connected' as const : 'reconnected' as const
      const next = await this.transition(trx, call, {
        to: 'active', eventType, actor: {...actor, accountId: ''}, now,
        patch: {connected_at: call.connected_at ?? now, negotiation_id: report.negotiationId},
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

  /** A new block ends any live call between the pair. */
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
      return out
    })
  }

  /** Re-derive authorization for a live socket. False means close it. */
  async stillAuthorized(actorId: string, callId: string): Promise<boolean> {
    const call = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    if (!call || isTerminal(call.state) || !this.roleOf(call, actorId)) return false
    const other = call.initiator_actor_id === actorId ? call.recipient_actor_id : call.initiator_actor_id
    if (await this.blockedBetween(this.db, actorId, other)) return false
    return this.activeAccount(this.db, actorId)
  }

  // ---- reads ----------------------------------------------------------------------------

  async snapshot(actor: CallActor, callId: string): Promise<{call: CallDto; expired: CallTransition | null}> {
    this.requireEnabled()
    const row = await this.db.selectFrom('greenfield_calls').selectAll().where('call_id', '=', callId).executeTakeFirst()
    if (!row || !this.roleOf(row, actor.actorId)) hidden()
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
      .where(({eb, or}) => or([eb('initiator_actor_id', '=', actor.actorId), eb('recipient_actor_id', '=', actor.actorId)]))
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
    const people = await this.profiles(page.map(r => r.initiator_actor_id === actor.actorId ? r.recipient_actor_id : r.initiator_actor_id))
    const items = page.map(r => this.toDto(r, actor.actorId, people.get(r.initiator_actor_id === actor.actorId ? r.recipient_actor_id : r.initiator_actor_id)!, actor.sessionId))
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
    const role = call ? this.roleOf(call, actor.actorId) : null
    if (!call || !role) return hidden()
    if (isTerminal(call.state)) fail('CONFLICT', 'The call has already ended', 'CALL_ALREADY_TERMINAL')
    if (role === 'recipient' && call.accepted_session_id && call.accepted_session_id !== actor.sessionId) {
      fail('CONFLICT', 'The call was answered on another device', 'CALL_ALREADY_ANSWERED')
    }
    const other = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
    if (await this.blockedBetween(this.db, actor.actorId, other)) notAllowed()
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
    if (!row || !this.roleOf(row, actorId)) return null
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
      const role = call ? this.roleOf(call, actor.actorId) : null
      if (!call || !role) return hidden()
      if (isTerminal(call.state)) fail('CONFLICT', 'The call has already ended', 'CALL_ALREADY_TERMINAL')
      // A recipient gets relay credentials only once its device has answered.
      if (role === 'recipient' && call.accepted_session_id !== actor.sessionId) {
        fail('CONFLICT', call.accepted_session_id ? 'The call was answered on another device' : 'Answer the call first', call.accepted_session_id ? 'CALL_ALREADY_ANSWERED' : 'CALL_NOT_ALLOWED')
      }
      const other = role === 'initiator' ? call.recipient_actor_id : call.initiator_actor_id
      if (await this.blockedBetween(trx, actor.actorId, other)) notAllowed()
      const participant = await trx.selectFrom('greenfield_call_participants').selectAll()
        .where('call_id', '=', callId).where('actor_id', '=', actor.actorId).executeTakeFirstOrThrow()
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
