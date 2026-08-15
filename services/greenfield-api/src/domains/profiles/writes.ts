import {randomUUID} from 'node:crypto'
import type {ModulaDb} from '../../database/client.js'
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

export class ProfileWriteService {
  private readonly profiles: ProfileRepository

  constructor(private readonly db: ModulaDb) {
    this.profiles = new ProfileRepository(db)
  }

  async follow(followerActorId: string, profileId: string): Promise<void> {
    const target = await this.db
      .selectFrom('profiles')
      .selectAll()
      .where('id', '=', profileId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    if (target.actor_id === followerActorId) {
      throw Object.assign(new Error('Cannot follow yourself'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      const existing = await trx
        .selectFrom('follows')
        .selectAll()
        .where('follower_actor_id', '=', followerActorId)
        .where('followed_actor_id', '=', target.actor_id)
        .executeTakeFirst()
      const now = new Date()
      if (!existing) {
        await trx
          .insertInto('follows')
          .values({
            id: randomUUID(),
            follower_actor_id: followerActorId,
            followed_actor_id: target.actor_id,
            created_at: now,
            updated_at: now,
            deleted_at: null,
            version: 1,
          })
          .execute()
      } else if (existing.deleted_at) {
        await trx
          .updateTable('follows')
          .set({deleted_at: null, updated_at: now, version: existing.version + 1})
          .where('id', '=', existing.id)
          .execute()
      }
      await new OutboxRepository(this.db).enqueue(trx, {
        eventType: 'notification.create',
        aggregateType: 'follow',
        aggregateId: `${followerActorId}:${target.actor_id}`,
        payload: {
          type: 'follow',
          actorId: followerActorId,
          recipientActorId: target.actor_id,
          resourceType: 'profile',
          resourceId: target.id,
        },
      })
      await new AuditRepository(trx).append('follow.created', {}, {
        type: 'profile',
        id: target.id,
        actorId: followerActorId,
      })
    })
  }

  async unfollow(followerActorId: string, profileId: string): Promise<void> {
    const target = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profileId)
      .executeTakeFirst()
    if (!target) throw Object.assign(new Error('Profile not found'), {code: 'NOT_FOUND'})
    await this.db
      .updateTable('follows')
      .set({deleted_at: new Date(), updated_at: new Date()})
      .where('follower_actor_id', '=', followerActorId)
      .where('followed_actor_id', '=', target.actor_id)
      .where('deleted_at', 'is', null)
      .execute()
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
    const updated = await this.profiles.getByActorId(actorId)
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
