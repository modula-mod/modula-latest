import {randomUUID} from 'node:crypto'
import {sql, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {AuditRepository} from '../audit/repository.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {OutboxRepository} from '../outbox/repository.js'
import {ProfileRepository} from './repository.js'
import type {ModulaProfileDto} from '@modula/api-contracts'

type ProfileVisibility = 'public' | 'followers' | 'teams' | 'private'

type ProfileLocationPatch = {
  label?: string
  visibility?: ProfileVisibility
} | null

type ProfileWebsitePatch = {
  label?: string
  url?: string
  domain?: string
  visibility?: ProfileVisibility
} | null

type ProfileFocusStatusPatch = {
  id?: string
  label?: string
  message?: string
} | null

type ProfilePatch = {
  displayName?: string
  bio?: string
  pronouns?: string | null
  avatarUri?: string | null
  coverUri?: string | null
  coverColour?: string | null
  location?: ProfileLocationPatch
  website?: ProfileWebsitePatch
  focusStatus?: ProfileFocusStatusPatch
  visibility?: ProfileVisibility
  expectedVersion?: number
}

export type ProfileWriteContext = {
  requestId?: string | null
  correlationId?: string | null
}

export type ProfileMediaKind = 'avatar' | 'cover'

export type FollowRelationshipState = 'none' | 'pending' | 'following'

export type FollowMutationResult = {
  relationship: FollowRelationshipState
  following: boolean
  pending: boolean
  requestId?: string
}

export type IncomingFollowRequest = {
  requestId: string
  requester: {
    id: string
    actorId: string
    handle: string
    displayName: string
    avatarUri?: string
  }
  createdAt: string
}

export class ProfileWriteService {
  private readonly profiles: ProfileRepository

  constructor(private readonly db: ModulaDb) {
    this.profiles = new ProfileRepository(db)
  }

  async follow(followerActorId: string, profileId: string): Promise<FollowMutationResult> {
    const target = await this.db
      .selectFrom('profiles')
      .select(['id', 'actor_id', 'visibility'])
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    if (target.actor_id === followerActorId) {
      throw Object.assign(new Error('Cannot follow yourself'), {code: 'VALIDATION_FAILED'})
    }
    return this.db.transaction().execute(async trx => {
      await lockRelationship(trx, followerActorId, target.actor_id)
      const currentTarget = await trx.selectFrom('profiles').select(['id', 'actor_id', 'visibility'])
        .where('id', '=', profileId).where('actor_id', '=', target.actor_id)
        .where('deleted_at', 'is', null).forShare().executeTakeFirst()
      if (!currentTarget || await isBlockedEitherDirection(trx, followerActorId, currentTarget.actor_id)) {
        throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
      }
      const activeFollow = await trx.selectFrom('follows').select('id')
        .where('follower_actor_id', '=', followerActorId)
        .where('followed_actor_id', '=', currentTarget.actor_id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (activeFollow) return followResult('following')

      const now = new Date()
      if (currentTarget.visibility !== 'public') {
        const existingRequest = await trx.selectFrom('follow_requests').selectAll()
          .where('requester_actor_id', '=', followerActorId)
          .where('target_actor_id', '=', currentTarget.actor_id)
          .forUpdate()
          .executeTakeFirst()
        if (existingRequest?.status === 'PENDING') {
          return followResult('pending', existingRequest.request_id)
        }
        const requestId = existingRequest?.request_id ?? randomUUID()
        const requestVersion = existingRequest ? existingRequest.version + 1 : 1
        if (existingRequest) {
          await trx.updateTable('follow_requests').set({
            status: 'PENDING', created_at: now, updated_at: now, resolved_at: null,
            version: requestVersion,
          }).where('request_id', '=', requestId).execute()
        } else {
          await trx.insertInto('follow_requests').values({
            request_id: requestId,
            requester_actor_id: followerActorId,
            target_actor_id: currentTarget.actor_id,
            status: 'PENDING',
            created_at: now,
            updated_at: now,
            resolved_at: null,
            version: requestVersion,
          }).execute()
        }
        await new OutboxRepository(trx).enqueue(trx, {
          eventType: 'notification.create',
          aggregateType: 'follow-request',
          aggregateId: requestId,
          payload: {
            type: 'follow',
            actorId: followerActorId,
            recipientActorId: currentTarget.actor_id,
            resourceType: 'profile',
            resourceId: currentTarget.id,
            dedupeKey: `follow-request:${requestId}:v${requestVersion}:requested`,
            body: 'requested to follow you',
          },
        })
        await new AuditRepository(trx).append('follow.requested', {requestId}, {
          type: 'profile', id: currentTarget.id, actorId: followerActorId,
        })
        return followResult('pending', requestId)
      }

      const activatedFollow = await activateFollow(trx, followerActorId, currentTarget.actor_id, now)
      await trx.updateTable('follow_requests').set({
        status: 'ACCEPTED', resolved_at: now, updated_at: now,
        version: sql<number>`version + 1`,
      }).where('requester_actor_id', '=', followerActorId)
        .where('target_actor_id', '=', currentTarget.actor_id)
        .where('status', '=', 'PENDING').execute()
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'notification.create',
        aggregateType: 'follow',
        aggregateId: `${followerActorId}:${currentTarget.actor_id}`,
        payload: {
          type: 'follow',
          actorId: followerActorId,
          recipientActorId: currentTarget.actor_id,
          resourceType: 'profile',
          resourceId: currentTarget.id,
          dedupeKey: `follow:${activatedFollow.id}:v${activatedFollow.version}`,
          body: 'started following you',
        },
      })
      await new AuditRepository(trx).append('follow.created', {}, {
        type: 'profile',
        id: currentTarget.id,
        actorId: followerActorId,
      })
      return followResult('following')
    })
  }

  async unfollow(followerActorId: string, profileId: string): Promise<FollowMutationResult> {
    const target = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    await this.db.transaction().execute(async trx => {
      await lockRelationship(trx, followerActorId, target.actor_id)
      const now = new Date()
      await trx.updateTable('follows').set({deleted_at: now, updated_at: now, version: sql<number>`version + 1`})
        .where('follower_actor_id', '=', followerActorId)
        .where('followed_actor_id', '=', target.actor_id)
        .where('deleted_at', 'is', null).execute()
      await trx.updateTable('follow_requests').set({
        status: 'CANCELLED', resolved_at: now, updated_at: now, version: sql<number>`version + 1`,
      }).where('requester_actor_id', '=', followerActorId)
        .where('target_actor_id', '=', target.actor_id)
        .where('status', 'in', ['PENDING', 'ACCEPTED']).execute()
    })
    return followResult('none')
  }

  async listIncomingFollowRequests(
    targetActorId: string,
    limit: number,
    cursor: string | null,
  ): Promise<IncomingFollowRequest[]> {
    let query = this.db.selectFrom('follow_requests')
      .innerJoin('profiles', 'profiles.actor_id', 'follow_requests.requester_actor_id')
      .select([
        'follow_requests.request_id', 'follow_requests.requester_actor_id', 'follow_requests.created_at',
        'profiles.id as profile_id', 'profiles.handle', 'profiles.display_name', 'profiles.avatar_url',
      ])
      .where('follow_requests.target_actor_id', '=', targetActorId)
      .where('follow_requests.status', '=', 'PENDING')
      .where('profiles.deleted_at', 'is', null)
      .orderBy('follow_requests.created_at', 'desc')
      .orderBy('follow_requests.request_id', 'desc')
      .limit(limit + 1)
    if (cursor) {
      const cursorRow = await this.db.selectFrom('follow_requests').select(['created_at', 'request_id'])
        .where('request_id', '=', cursor)
        .where('target_actor_id', '=', targetActorId)
        .executeTakeFirst()
      if (!cursorRow) throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      query = query.where(({eb, or, and}) => or([
        eb('follow_requests.created_at', '<', cursorRow.created_at),
        and([
          eb('follow_requests.created_at', '=', cursorRow.created_at),
          eb('follow_requests.request_id', '<', cursorRow.request_id),
        ]),
      ]))
    }
    const rows = await query.execute()
    return rows.map(row => ({
      requestId: row.request_id,
      requester: {
        id: row.profile_id,
        actorId: row.requester_actor_id,
        handle: row.handle,
        displayName: row.display_name,
        ...(row.avatar_url ? {avatarUri: row.avatar_url} : {}),
      },
      createdAt: row.created_at.toISOString(),
    }))
  }

  async acceptFollowRequest(targetActorId: string, requestId: string): Promise<FollowMutationResult> {
    return this.db.transaction().execute(async trx => {
      const initial = await ownedFollowRequest(trx, requestId, 'target_actor_id', targetActorId)
      await lockRelationship(trx, initial.requester_actor_id, initial.target_actor_id)
      const request = await ownedFollowRequest(trx, requestId, 'target_actor_id', targetActorId, true)
      if (await isBlockedEitherDirection(trx, request.requester_actor_id, request.target_actor_id)) {
        throw Object.assign(new Error('Follow request not found'), {code: 'NOT_FOUND'})
      }
      if (request.status === 'ACCEPTED') return followResult('following', requestId)
      if (request.status !== 'PENDING') throw Object.assign(new Error('Follow request is no longer pending'), {code: 'CONFLICT'})
      const now = new Date()
      const targetProfile = await trx.selectFrom('profiles').select('id')
        .where('actor_id', '=', request.target_actor_id).where('deleted_at', 'is', null)
        .executeTakeFirstOrThrow()
      await trx.updateTable('follow_requests').set({
        status: 'ACCEPTED', resolved_at: now, updated_at: now, version: request.version + 1,
      }).where('request_id', '=', requestId).where('status', '=', 'PENDING').executeTakeFirst()
      await activateFollow(trx, request.requester_actor_id, request.target_actor_id, now)
      await new OutboxRepository(trx).enqueue(trx, {
        eventType: 'notification.create', aggregateType: 'follow-request', aggregateId: requestId,
        payload: {
          type: 'follow', actorId: request.target_actor_id, recipientActorId: request.requester_actor_id,
          resourceType: 'profile', resourceId: targetProfile.id,
          dedupeKey: `follow-request:${requestId}:v${request.version + 1}:accepted`, body: 'accepted your follow request',
        },
      })
      await new AuditRepository(trx).append('follow.accepted', {requestId}, {
        type: 'profile', id: targetProfile.id, actorId: targetActorId,
      })
      return followResult('following', requestId)
    })
  }

  async rejectFollowRequest(targetActorId: string, requestId: string): Promise<FollowMutationResult> {
    return this.resolvePendingRequest(requestId, 'target_actor_id', targetActorId, 'REJECTED', 'follow.rejected')
  }

  async cancelFollowRequest(requesterActorId: string, requestId: string): Promise<FollowMutationResult> {
    return this.resolvePendingRequest(requestId, 'requester_actor_id', requesterActorId, 'CANCELLED', 'follow.cancelled')
  }

  private async resolvePendingRequest(
    requestId: string,
    ownerColumn: 'requester_actor_id' | 'target_actor_id',
    ownerActorId: string,
    status: 'REJECTED' | 'CANCELLED',
    auditAction: string,
  ): Promise<FollowMutationResult> {
    return this.db.transaction().execute(async trx => {
      const initial = await ownedFollowRequest(trx, requestId, ownerColumn, ownerActorId)
      await lockRelationship(trx, initial.requester_actor_id, initial.target_actor_id)
      const request = await ownedFollowRequest(trx, requestId, ownerColumn, ownerActorId, true)
      if (request.status === status) return followResult('none', requestId)
      if (request.status !== 'PENDING') throw Object.assign(new Error('Follow request is no longer pending'), {code: 'CONFLICT'})
      const now = new Date()
      await trx.updateTable('follow_requests').set({
        status, resolved_at: now, updated_at: now, version: request.version + 1,
      }).where('request_id', '=', requestId).where('status', '=', 'PENDING').execute()
      await new AuditRepository(trx).append(auditAction, {requestId}, {
        type: 'profile', id: request.target_actor_id, actorId: ownerActorId,
      })
      return followResult('none', requestId)
    })
  }

  async updateMe(
    actorId: string,
    patch: ProfilePatch,
    context: ProfileWriteContext = {},
  ): Promise<ModulaProfileDto> {
    const row = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    if (patch.expectedVersion != null && patch.expectedVersion !== row.version) {
      throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
    }
    const displayName = patch.displayName?.trim()
    const bio = patch.bio === undefined ? undefined : boundedText(patch.bio, 160, 'bio')
    if (displayName !== undefined && !displayName) {
      throw Object.assign(new Error('displayName required'), {code: 'VALIDATION_FAILED'})
    }
    if (displayName !== undefined && displayName.length > 50) {
      throw Object.assign(new Error('displayName too long'), {code: 'VALIDATION_FAILED'})
    }
    const pronouns =
      patch.pronouns === undefined ? row.pronouns : nullableText(patch.pronouns, 80, 'pronouns')
    const avatarUrl =
      patch.avatarUri === undefined ? row.avatar_url : normalizeMediaUri(patch.avatarUri, 'avatarUri')
    const coverUrl =
      patch.coverUri === undefined ? row.cover_url : normalizeMediaUri(patch.coverUri, 'coverUri')
    const coverColour =
      patch.coverColour === undefined
        ? row.cover_colour
        : nullableText(patch.coverColour, 64, 'coverColour')
    const location = normalizeLocation(patch.location, row.location_visibility as ProfileVisibility | null)
    const website = normalizeWebsite(patch.website, row.website_visibility as ProfileVisibility | null)
    const focusStatus = normalizeFocusStatus(patch.focusStatus)
    const nextVersion = row.version + 1
    const visibility = normalizeVisibility(patch.visibility, row.visibility as ProfileVisibility)
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      let query = trx
        .updateTable('profiles')
        .set({
          display_name: displayName ?? row.display_name,
          bio: bio ?? row.bio,
          pronouns,
          avatar_url: avatarUrl,
          cover_url: coverUrl,
          cover_colour: coverColour,
          location_label:
            patch.location === undefined ? row.location_label : location?.label ?? null,
          location_visibility:
            patch.location === undefined ? row.location_visibility : location?.visibility ?? null,
          website_label:
            patch.website === undefined ? row.website_label : website?.label ?? null,
          website_url:
            patch.website === undefined ? row.website_url : website?.url ?? null,
          website_domain:
            patch.website === undefined ? row.website_domain : website?.domain ?? null,
          website_visibility:
            patch.website === undefined ? row.website_visibility : website?.visibility ?? null,
          focus_status_id: focusStatus?.id ?? row.focus_status_id,
          focus_status_label: focusStatus?.label ?? row.focus_status_label,
          focus_status_message: focusStatus?.message ?? row.focus_status_message,
          focus_status_updated_at: focusStatus ? now : row.focus_status_updated_at,
          visibility,
          updated_at: now,
          version: nextVersion,
        })
        .where('id', '=', row.id)
      if (patch.expectedVersion != null) query = query.where('version', '=', patch.expectedVersion)
      const result = await query.executeTakeFirst()
      if (Number(result.numUpdatedRows ?? 0) === 0) {
        throw Object.assign(new Error('Version conflict'), {code: 'CONFLICT'})
      }
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'search.index.profile',
        aggregateType: 'profile',
        aggregateId: row.id,
        payload: {profileId: row.id, actorId},
      })
      await new AuditRepository(trx).append('profile.updated', {}, {
        type: 'profile',
        id: row.id,
        actorId,
      })
      await new GreenfieldEventBus(trx).publish({
        eventType: 'profile.updated',
        aggregateType: 'profile',
        aggregateId: row.id,
        aggregateVersion: nextVersion,
        accountId: actor?.account_id ?? null,
        actorId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? context.requestId ?? null,
        visibility: visibility === 'public' ? 'public' : 'actor',
        classification: 'internal',
        payload: {
          profileId: row.id,
          actorId,
          visibility,
          sourceVersion: nextVersion,
        },
        metadata: {source: 'greenfield.profiles'},
        occurredAt: now,
      })
      if (visibility !== row.visibility) {
        await new GreenfieldEventBus(trx).publish({
          eventType: 'profile.visibility-changed',
          aggregateType: 'profile',
          aggregateId: row.id,
          aggregateVersion: nextVersion,
          accountId: actor?.account_id ?? null,
          actorId,
          requestId: context.requestId ?? null,
          correlationId: context.correlationId ?? context.requestId ?? null,
          visibility: visibility === 'public' ? 'public' : 'actor',
          classification: 'internal',
          payload: {
            profileId: row.id,
            actorId,
            previousVisibility: row.visibility,
            visibility,
            sourceVersion: nextVersion,
          },
          metadata: {source: 'greenfield.profiles'},
          occurredAt: now,
        })
      }
    })
    const updated = await this.profiles.getByActorId(actorId, actorId)
    if (!updated) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    return updated
  }

  async updateMedia(
    actorId: string,
    accountId: string,
    kind: ProfileMediaKind,
    attachmentId: string | null,
    publicApiUrl: string,
    context: ProfileWriteContext = {},
  ): Promise<ModulaProfileDto> {
    if (attachmentId !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId)) {
      throw Object.assign(new Error('Invalid attachment ID'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      const profile = await trx.selectFrom('profiles').selectAll()
        .where('actor_id', '=', actorId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!profile) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
      const existing = await trx.selectFrom('profile_media').select('attachment_id')
        .where('profile_id', '=', profile.id).where('kind', '=', kind).executeTakeFirst()
      const now = new Date()
      let mediaUrl: string | null = null
      if (attachmentId) {
        const attachment = await trx.selectFrom('attachments').selectAll()
          .where('attachment_id', '=', attachmentId).forUpdate().executeTakeFirst()
        if (!attachment) throw Object.assign(new Error('Attachment not found'), {code: 'NOT_FOUND'})
        if (attachment.owner_account_id !== accountId) {
          throw Object.assign(new Error('Cross-account profile media binding denied'), {code: 'FORBIDDEN'})
        }
        if (attachment.kind !== 'image' || attachment.status !== 'ready') {
          throw Object.assign(new Error('Profile media must be a ready image attachment'), {code: 'CONFLICT'})
        }
        if (attachment.attached_at && existing?.attachment_id !== attachmentId) {
          throw Object.assign(new Error('Attachment is already bound'), {code: 'CONFLICT'})
        }
        mediaUrl = `${publicApiUrl.replace(/\/+$/, '')}/v1/attachments/${attachmentId}/content`
        await trx.insertInto('profile_media').values({
          profile_id: profile.id, kind, attachment_id: attachmentId, created_at: now, updated_at: now,
        }).onConflict(conflict => conflict.columns(['profile_id', 'kind']).doUpdateSet({attachment_id: attachmentId, updated_at: now})).execute()
        await trx.updateTable('attachments').set({attached_at: now, updated_at: now})
          .where('attachment_id', '=', attachmentId).execute()
      } else {
        await trx.deleteFrom('profile_media').where('profile_id', '=', profile.id).where('kind', '=', kind).execute()
      }
      if (existing && existing.attachment_id !== attachmentId) {
        await trx.updateTable('attachments').set({attached_at: null, updated_at: now})
          .where('attachment_id', '=', existing.attachment_id).execute()
      }
      const nextVersion = profile.version + 1
      const changes = kind === 'avatar' ? {avatar_url: mediaUrl} : {cover_url: mediaUrl}
      await trx.updateTable('profiles').set({...changes, updated_at: now, version: nextVersion})
        .where('id', '=', profile.id).execute()
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'search.index.profile', aggregateType: 'profile', aggregateId: profile.id,
        payload: {profileId: profile.id, actorId},
      })
      await new AuditRepository(trx).append(`profile.${kind}.updated`, {}, {type: 'profile', id: profile.id, actorId})
      await new GreenfieldEventBus(trx).publish({
        eventType: 'profile.updated', aggregateType: 'profile', aggregateId: profile.id,
        aggregateVersion: nextVersion, accountId, actorId,
        requestId: context.requestId ?? null,
        correlationId: context.correlationId ?? context.requestId ?? null,
        visibility: profile.visibility === 'public' ? 'public' : 'actor', classification: 'internal',
        payload: {profileId: profile.id, actorId, mediaKind: kind, sourceVersion: nextVersion},
        metadata: {source: 'greenfield.profiles'}, occurredAt: now,
      })
    })
    const updated = await this.profiles.getByActorId(actorId, actorId)
    if (!updated) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    return updated
  }

  async actorIdForProfileId(profileId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    return row?.actor_id ?? null
  }
}

function followResult(relationship: FollowRelationshipState, requestId?: string): FollowMutationResult {
  return {
    relationship,
    following: relationship === 'following',
    pending: relationship === 'pending',
    ...(requestId ? {requestId} : {}),
  }
}

async function lockRelationship(
  trx: Transaction<Database>,
  actorA: string,
  actorB: string,
): Promise<void> {
  const key = [actorA, actorB].sort().join(':')
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(trx)
}

async function isBlockedEitherDirection(
  trx: Transaction<Database>,
  actorA: string,
  actorB: string,
): Promise<boolean> {
  const row = await trx.selectFrom('blocks').select('id').where('deleted_at', 'is', null)
    .where(({eb, or, and}) => or([
      and([eb('blocker_actor_id', '=', actorA), eb('blocked_actor_id', '=', actorB)]),
      and([eb('blocker_actor_id', '=', actorB), eb('blocked_actor_id', '=', actorA)]),
    ])).executeTakeFirst()
  return Boolean(row)
}

async function activateFollow(
  trx: Transaction<Database>,
  followerActorId: string,
  followedActorId: string,
  now: Date,
): Promise<{id: string; version: number}> {
  const existing = await trx.selectFrom('follows').selectAll()
    .where('follower_actor_id', '=', followerActorId)
    .where('followed_actor_id', '=', followedActorId)
    .forUpdate().executeTakeFirst()
  if (existing) {
    if (existing.deleted_at) {
      const version = existing.version + 1
      await trx.updateTable('follows').set({
        deleted_at: null, updated_at: now, version,
      }).where('id', '=', existing.id).execute()
      return {id: existing.id, version}
    }
    return {id: existing.id, version: existing.version}
  }
  const id = randomUUID()
  await trx.insertInto('follows').values({
    id, follower_actor_id: followerActorId, followed_actor_id: followedActorId,
    created_at: now, updated_at: now, deleted_at: null, version: 1,
  }).execute()
  return {id, version: 1}
}

async function ownedFollowRequest(
  trx: Transaction<Database>,
  requestId: string,
  ownerColumn: 'requester_actor_id' | 'target_actor_id',
  ownerActorId: string,
  lock = false,
): Promise<Database['follow_requests']> {
  let query = trx.selectFrom('follow_requests').selectAll()
    .where('request_id', '=', requestId)
    .where(ownerColumn, '=', ownerActorId)
  if (lock) query = query.forUpdate()
  const request = await query.executeTakeFirst()
  if (!request) throw Object.assign(new Error('Follow request not found'), {code: 'NOT_FOUND'})
  return request
}

function boundedText(value: string, max: number, label: string): string {
  const next = value.trim()
  if (next.length > max) throw Object.assign(new Error(`${label} too long`), {code: 'VALIDATION_FAILED'})
  return next
}

function nullableText(value: string | null | undefined, max: number, label: string): string | null {
  if (value === null || value === undefined) return null
  const next = value.trim()
  if (!next) return null
  if (next.length > max) throw Object.assign(new Error(`${label} too long`), {code: 'VALIDATION_FAILED'})
  return next
}

function normalizeVisibility(value: ProfileVisibility | undefined | null, fallback: ProfileVisibility): ProfileVisibility {
  if (value === undefined || value === null) return fallback
  if (value === 'public' || value === 'followers' || value === 'teams' || value === 'private') return value
  throw Object.assign(new Error('Invalid visibility'), {code: 'VALIDATION_FAILED'})
}

function normalizeLocation(
  value: ProfileLocationPatch | undefined,
  fallbackVisibility: ProfileVisibility | null,
): {label: string; visibility: ProfileVisibility} | null {
  if (value === undefined) return null
  if (value === null) return null
  const label = boundedText(value.label ?? '', 120, 'location')
  if (!label) return null
  return {
    label,
    visibility: normalizeVisibility(value.visibility, fallbackVisibility ?? 'public'),
  }
}

function normalizeWebsite(
  value: ProfileWebsitePatch | undefined,
  fallbackVisibility: ProfileVisibility | null,
): {label: string; url: string; domain: string; visibility: ProfileVisibility} | null {
  if (value === undefined) return null
  if (value === null) return null
  const rawUrl = boundedText(value.url ?? '', 2048, 'website')
  if (!rawUrl) return null
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw Object.assign(new Error('Invalid website URL'), {code: 'VALIDATION_FAILED'})
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw Object.assign(new Error('Invalid website URL'), {code: 'VALIDATION_FAILED'})
  }
  const domain = boundedText(value.domain ?? url.hostname, 253, 'website domain')
  return {
    label: boundedText(value.label ?? 'Website', 80, 'website label') || 'Website',
    url: url.toString(),
    domain,
    visibility: normalizeVisibility(value.visibility, fallbackVisibility ?? 'public'),
  }
}

function normalizeFocusStatus(value: ProfileFocusStatusPatch | undefined) {
  if (value === undefined || value === null) return null
  const id = boundedText(value.id ?? '', 64, 'focus status id')
  const label = boundedText(value.label ?? '', 80, 'focus status label')
  const message = boundedText(value.message ?? '', 160, 'focus status message')
  if (!id || !label) {
    throw Object.assign(new Error('Invalid focus status'), {code: 'VALIDATION_FAILED'})
  }
  return {id, label, message}
}

function normalizeMediaUri(value: string | null | undefined, label: string): string | null {
  const next = nullableText(value, 2048, label)
  if (!next) return null
  let url: URL
  try {
    url = new URL(next)
  } catch {
    throw Object.assign(new Error(`${label} must be a public HTTPS URL`), {code: 'VALIDATION_FAILED'})
  }
  if (url.protocol !== 'https:' || isPrivateMediaHost(url.hostname)) {
    throw Object.assign(new Error(`${label} must be a public HTTPS URL`), {code: 'VALIDATION_FAILED'})
  }
  return url.toString()
}

function isPrivateMediaHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'host.docker.internal' ||
    host.endsWith('.internal')
  ) {
    return true
  }
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!ipv4) return false
  const a = Number(ipv4[1])
  const b = Number(ipv4[2])
  const c = Number(ipv4[3])
  const d = Number(ipv4[4])
  if ([a, b, c, d].some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  )
}
