import {randomUUID} from 'node:crypto'
import type {
  CommunityDto,
  CommunityEventDto,
  CommunityEventResponse,
  CommunityMemberDto,
  CommunityPollDto,
  CommunityPostDto,
  CommunityRole,
  CommunitySettingsDto,
  CommunitySummaryDto,
  CreateCommunityPostInput,
} from '@modula/api-contracts'
import {sql, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {GreenfieldEventBus} from '../../events/index.js'
import {AuditRepository} from '../audit/repository.js'
import {PostRepository} from '../posts/repository.js'
import {PostWriteService, type PostWriteContext} from '../posts/writes.js'
import {ProfileRepository} from '../profiles/repository.js'

type DbTransaction = Transaction<Database>
type CommunityRow = Database['greenfield_communities']
type MembershipRow = Database['greenfield_community_memberships']

export type CommunityCreateInput = {
  slug?: string
  name: string
  description?: string
  category: string
  visibility?: 'public' | 'private'
  discoverable?: boolean
  membershipPolicy?: 'open' | 'approval'
  postingPolicy?: 'members' | 'moderators'
  iconAttachmentId?: string | null
  coverAttachmentId?: string | null
}

export type CommunityPatchInput = Partial<Omit<CommunityCreateInput, 'slug'>> & {
  slug?: string
  expectedVersion: number
}

export type CommunityListInput = {
  limit: number
  cursor: string | null
  query?: string
  category?: string
  membership?: 'joined' | 'notJoined'
}

export type CommunityEventCreateInput = {
  title: string
  description?: string
  startsAt: string
  endsAt: string
  timezone: string
  location: {type: 'online' | 'inPerson' | 'tba'; name?: string | null; onlineUrl?: string | null}
  coverAttachmentId?: string | null
  capacity?: number | null
}

export type CommunityEventPatchInput = Partial<CommunityEventCreateInput> & {
  status?: 'scheduled' | 'cancelled'
  expectedVersion: number
}

export type CommunityPollCreateInput = {
  question: string
  options: string[]
  closesAt: string
  allowVoteChanges?: boolean
  resultsVisibility?: 'always' | 'afterVote' | 'afterClose'
}

export type CommunityPollPatchInput = {status: 'cancelled'; expectedVersion: number}

export type CommunityRequestContext = PostWriteContext & {accountId?: string | null}

export class CommunityService {
  private readonly profiles: ProfileRepository
  private readonly posts: PostRepository
  private readonly postWrites: PostWriteService

  constructor(private readonly db: ModulaDb, private readonly config: AppConfig) {
    this.profiles = new ProfileRepository(db)
    this.posts = new PostRepository(db, config.publicApiUrl)
    this.postWrites = new PostWriteService(db, config)
  }

  async list(viewerActorId: string | null, input: CommunityListInput): Promise<CommunitySummaryDto[]> {
    const cursor = decodeCommunityCursor(input.cursor)
    const search = cleanOptional(input.query, 120)
    const category = cleanOptional(input.category, 80)
    let query = this.db
      .selectFrom('greenfield_communities as community')
      .leftJoin('greenfield_community_memberships as membership', join => join
        .onRef('membership.community_id', '=', 'community.community_id')
        .on('membership.actor_id', '=', viewerActorId ?? '__anonymous__'))
      .selectAll('community')
      .select([
        'membership.role as viewer_role',
        'membership.status as viewer_status',
        sql<number>`(
          SELECT count(*)::int FROM greenfield_community_memberships counted
          WHERE counted.community_id = community.community_id AND counted.status = 'active'
        )`.as('member_count'),
      ])
      .where('community.deleted_at', 'is', null)
      .where(eb => eb.or([
        eb.and([eb('community.visibility', '=', 'public'), eb('community.discoverable', '=', true)]),
        eb('membership.status', '=', 'active'),
      ]))
      .orderBy('community.featured', 'desc')
      .orderBy('community.updated_at', 'desc')
      .orderBy('community.community_id', 'desc')
      .limit(input.limit + 1)
    if (search) {
      query = query.where(eb => eb.or([
        eb(sql`lower(community.name)`, 'like', `%${escapeLike(search.toLocaleLowerCase())}%`),
        eb(sql`lower(community.description)`, 'like', `%${escapeLike(search.toLocaleLowerCase())}%`),
        eb(sql`lower(community.slug)`, 'like', `%${escapeLike(search.toLocaleLowerCase())}%`),
      ]))
    }
    if (category) query = query.where(sql`lower(community.category)`, '=', category.toLocaleLowerCase())
    if (input.membership === 'joined') query = query.where('membership.status', '=', 'active')
    if (input.membership === 'notJoined') query = query.where(eb => eb.or([
      eb('membership.status', 'is', null), eb('membership.status', 'in', ['left', 'pending']),
    ]))
    if (cursor) {
      query = query.where(eb => eb.or([
        eb('community.featured', '<', cursor.featured),
        eb.and([eb('community.featured', '=', cursor.featured), eb('community.updated_at', '<', cursor.updatedAt)]),
        eb.and([
          eb('community.featured', '=', cursor.featured),
          eb('community.updated_at', '=', cursor.updatedAt),
          eb('community.community_id', '<', cursor.id),
        ]),
      ]))
    }
    const rows = await query.execute()
    return rows.map(row => this.summary(row, row.member_count, row.viewer_status ?? null, row.viewer_role ?? null))
  }

  async get(communityId: string, viewerActorId: string | null): Promise<CommunityDto> {
    const access = await this.communityAccess(communityId, viewerActorId)
    const count = await this.activeMemberCount(communityId)
    return {
      ...this.summary(access.community, count, access.membership?.status ?? null, access.membership?.role ?? null),
      ownerActorId: access.community.owner_actor_id,
      membershipPolicy: access.community.membership_policy,
      postingPolicy: access.community.posting_policy,
      createdAt: access.community.created_at.toISOString(),
      updatedAt: access.community.updated_at.toISOString(),
    }
  }

  async create(actorId: string, input: CommunityCreateInput, context: CommunityRequestContext = {}): Promise<CommunityDto> {
    const name = requiredText(input.name, 'name', 120)
    const description = optionalText(input.description, 'description', 5000)
    const category = requiredText(input.category, 'category', 80)
    const slug = normalizeSlug(input.slug ?? name)
    const visibility = input.visibility ?? 'public'
    const discoverable = visibility === 'public' ? (input.discoverable ?? true) : false
    const membershipPolicy = input.membershipPolicy ?? (visibility === 'public' ? 'open' : 'approval')
    const postingPolicy = input.postingPolicy ?? 'members'
    assertEnum(visibility, ['public', 'private'], 'visibility')
    assertEnum(membershipPolicy, ['open', 'approval'], 'membershipPolicy')
    assertEnum(postingPolicy, ['members', 'moderators'], 'postingPolicy')
    const communityId = randomUUID()
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      await this.bindArtwork(trx, accountId, [input.iconAttachmentId, input.coverAttachmentId])
      await trx.insertInto('greenfield_communities').values({
        community_id: communityId,
        slug,
        owner_actor_id: actorId,
        name,
        description,
        category,
        visibility,
        discoverable,
        featured: false,
        membership_policy: membershipPolicy,
        posting_policy: postingPolicy,
        icon_attachment_id: input.iconAttachmentId ?? null,
        cover_attachment_id: input.coverAttachmentId ?? null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      }).execute()
      await trx.insertInto('greenfield_community_settings').values({
        community_id: communityId,
        allow_attachments: true,
        reactions_enabled: true,
        featured_posts_enabled: false,
        invite_links_enabled: false,
        blocked_words: [],
        version: 1,
        created_at: now,
        updated_at: now,
      }).execute()
      await trx.insertInto('greenfield_community_memberships').values({
        community_id: communityId,
        actor_id: actorId,
        role: 'owner',
        status: 'active',
        notify_mentions: true,
        weekly_digest: false,
        event_reminders: true,
        joined_at: now,
        created_at: now,
        updated_at: now,
        version: 1,
      }).execute()
      await new AuditRepository(trx).append('community.created', {slug, visibility}, {
        type: 'community', id: communityId, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.created', aggregateType: 'community', aggregateId: communityId,
        actorId, accountId, version: 1, visibility, payload: {communityId, slug, visibility}, context,
      })
    }).catch(mapUniqueCommunityError)
    return this.get(communityId, actorId)
  }

  async update(
    actorId: string,
    communityId: string,
    input: CommunityPatchInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityDto> {
    const access = await this.communityAccess(communityId, actorId)
    assertRole(access.membership, ['owner', 'admin'], 'Only community owners and administrators can edit the community')
    const updates: Partial<CommunityRow> = {}
    if (input.name !== undefined) updates.name = requiredText(input.name, 'name', 120)
    if (input.description !== undefined) updates.description = optionalText(input.description, 'description', 5000)
    if (input.category !== undefined) updates.category = requiredText(input.category, 'category', 80)
    if (input.slug !== undefined) updates.slug = normalizeSlug(input.slug)
    if (input.visibility !== undefined) {
      assertEnum(input.visibility, ['public', 'private'], 'visibility')
      updates.visibility = input.visibility
      if (input.visibility === 'private') updates.discoverable = false
    }
    if (input.discoverable !== undefined && (input.visibility ?? access.community.visibility) === 'public') {
      updates.discoverable = Boolean(input.discoverable)
    }
    if (input.membershipPolicy !== undefined) {
      assertEnum(input.membershipPolicy, ['open', 'approval'], 'membershipPolicy')
      updates.membership_policy = input.membershipPolicy
    }
    if (input.postingPolicy !== undefined) {
      assertEnum(input.postingPolicy, ['members', 'moderators'], 'postingPolicy')
      updates.posting_policy = input.postingPolicy
    }
    if (input.iconAttachmentId !== undefined) updates.icon_attachment_id = input.iconAttachmentId
    if (input.coverAttachmentId !== undefined) updates.cover_attachment_id = input.coverAttachmentId
    if (Object.keys(updates).length === 0) throw domainError('VALIDATION_FAILED', 'No community changes supplied')
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      const changesPolicy = input.membershipPolicy !== undefined || input.postingPolicy !== undefined
      if (changesPolicy) await advisoryLock(trx, `community-settings:${communityId}`)
      await this.bindArtwork(trx, accountId, [
        input.iconAttachmentId === access.community.icon_attachment_id ? undefined : input.iconAttachmentId,
        input.coverAttachmentId === access.community.cover_attachment_id ? undefined : input.coverAttachmentId,
      ])
      const updated = await trx.updateTable('greenfield_communities').set({
        ...updates,
        updated_at: now,
        version: input.expectedVersion + 1,
      }).where('community_id', '=', communityId).where('deleted_at', 'is', null)
        .where('version', '=', input.expectedVersion).executeTakeFirst()
      if (Number(updated.numUpdatedRows ?? 0) !== 1) throw domainError('CONFLICT', 'Community version conflict')
      if (changesPolicy) {
        await trx.updateTable('greenfield_community_settings').set({
          updated_at: now,
          version: sql`version + 1`,
        }).where('community_id', '=', communityId).execute()
      }
      await new AuditRepository(trx).append('community.updated', {expectedVersion: input.expectedVersion, fields: Object.keys(updates)}, {
        type: 'community', id: communityId, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.updated', aggregateType: 'community', aggregateId: communityId,
        actorId, accountId, version: input.expectedVersion + 1,
        visibility: (updates.visibility ?? access.community.visibility), payload: {communityId, fields: Object.keys(updates)}, context,
      })
    }).catch(mapUniqueCommunityError)
    return this.get(communityId, actorId)
  }

  async join(actorId: string, communityId: string, context: CommunityRequestContext = {}) {
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    return this.db.transaction().execute(async trx => {
      await advisoryLock(trx, `community-membership:${communityId}:${actorId}`)
      const community = await trx.selectFrom('greenfield_communities').selectAll()
        .where('community_id', '=', communityId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!community || community.visibility === 'private') throw domainError('NOT_FOUND', 'Community not found')
      const existing = await trx.selectFrom('greenfield_community_memberships').selectAll()
        .where('community_id', '=', communityId).where('actor_id', '=', actorId).executeTakeFirst()
      if (existing?.status === 'banned') throw domainError('FORBIDDEN', 'Community membership is unavailable')
      if (existing?.status === 'active' || existing?.status === 'pending') {
        return {membership: membershipView(existing)}
      }
      const status = community.membership_policy === 'open' ? 'active' : 'pending'
      const now = new Date()
      const row = await trx.insertInto('greenfield_community_memberships').values({
        community_id: communityId,
        actor_id: actorId,
        role: 'member',
        status,
        notify_mentions: true,
        weekly_digest: false,
        event_reminders: true,
        joined_at: status === 'active' ? now : null,
        created_at: existing?.created_at ?? now,
        updated_at: now,
        version: (existing?.version ?? 0) + 1,
      }).onConflict(conflict => conflict.columns(['community_id', 'actor_id']).doUpdateSet({
        role: 'member', status, joined_at: status === 'active' ? now : null, updated_at: now,
        version: (existing?.version ?? 0) + 1,
      })).returningAll().executeTakeFirstOrThrow()
      await this.touch(trx, communityId, now)
      await new AuditRepository(trx).append('community.member-joined', {status}, {
        type: 'communityMembership', id: `${communityId}:${actorId}`, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.member-joined', aggregateType: 'communityMembership', aggregateId: `${communityId}:${actorId}`,
        actorId, accountId, version: row.version, visibility: 'private', payload: {communityId, actorId, status}, context,
      })
      return {membership: membershipView(row)}
    })
  }

  async leave(actorId: string, communityId: string, context: CommunityRequestContext = {}) {
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    return this.db.transaction().execute(async trx => {
      await advisoryLock(trx, `community-membership:${communityId}:${actorId}`)
      const row = await trx.selectFrom('greenfield_community_memberships').selectAll()
        .where('community_id', '=', communityId).where('actor_id', '=', actorId).forUpdate().executeTakeFirst()
      if (!row || row.status === 'left') return {left: true}
      if (row.status === 'banned') throw domainError('FORBIDDEN', 'Community membership is unavailable')
      if (row.role === 'owner') throw domainError('CONFLICT', 'Transfer community ownership before leaving')
      const now = new Date()
      await trx.updateTable('greenfield_community_memberships').set({
        status: 'left', joined_at: null, updated_at: now, version: row.version + 1,
      }).where('community_id', '=', communityId).where('actor_id', '=', actorId).execute()
      await this.touch(trx, communityId, now)
      await new AuditRepository(trx).append('community.member-left', {}, {
        type: 'communityMembership', id: `${communityId}:${actorId}`, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.member-left', aggregateType: 'communityMembership', aggregateId: `${communityId}:${actorId}`,
        actorId, accountId, version: row.version + 1, visibility: 'private', payload: {communityId, actorId}, context,
      })
      return {left: true}
    })
  }

  async listMembers(communityId: string, viewerActorId: string | null, limit: number, cursor: string | null): Promise<CommunityMemberDto[]> {
    await this.communityAccess(communityId, viewerActorId)
    let query = this.db.selectFrom('greenfield_community_memberships').selectAll()
      .where('community_id', '=', communityId).where('status', '=', 'active')
      .orderBy('joined_at', 'desc').orderBy('actor_id', 'desc').limit(limit + 1)
    if (cursor) {
      const [joinedAtRaw, actorId] = cursor.split('|')
      const joinedAt = new Date(joinedAtRaw ?? '')
      if (!actorId || Number.isNaN(joinedAt.getTime())) throw domainError('VALIDATION_FAILED', 'Invalid cursor')
      query = query.where(eb => eb.or([
        eb('joined_at', '<', joinedAt),
        eb.and([eb('joined_at', '=', joinedAt), eb('actor_id', '<', actorId)]),
      ]))
    }
    const rows = await query.execute()
    const profiles = await this.profiles.getByActorIds(rows.map(row => row.actor_id), viewerActorId)
    const members: CommunityMemberDto[] = []
    for (const row of rows) {
      const profile = profiles.get(row.actor_id)
      if (profile) members.push({communityId, actorId: row.actor_id, role: row.role, status: row.status, joinedAt: row.joined_at?.toISOString() ?? null, profile})
    }
    return members
  }

  async getSettings(communityId: string, viewerActorId: string): Promise<CommunitySettingsDto> {
    const access = await this.communityAccess(communityId, viewerActorId)
    requireActiveMembership(access.membership)
    const row = await this.db.selectFrom('greenfield_community_settings').selectAll()
      .where('community_id', '=', communityId).executeTakeFirstOrThrow()
    return settingsDto(row, access.community, access.membership)
  }

  async updateSettings(
    actorId: string,
    communityId: string,
    input: {
      membershipPolicy?: 'open' | 'approval'
      postingPolicy?: 'members' | 'moderators'
      inviteLinksEnabled?: boolean
      allowAttachments?: boolean
      reactionsEnabled?: boolean
      featuredPostsEnabled?: boolean
      blockedWords?: string[]
      notifyMentions?: boolean
      weeklyDigest?: boolean
      eventReminders?: boolean
      expectedVersion?: number
    },
    context: CommunityRequestContext = {},
  ): Promise<CommunitySettingsDto> {
    const access = await this.communityAccess(communityId, actorId)
    requireActiveMembership(access.membership)
    const hasGlobalChanges = [
      input.membershipPolicy,
      input.postingPolicy,
      input.inviteLinksEnabled,
      input.allowAttachments,
      input.reactionsEnabled,
      input.featuredPostsEnabled,
      input.blockedWords,
    ].some(value => value !== undefined)
    const hasPersonalChanges = [input.notifyMentions, input.weeklyDigest, input.eventReminders]
      .some(value => value !== undefined)
    if (!hasGlobalChanges && !hasPersonalChanges) throw domainError('VALIDATION_FAILED', 'No community settings changes supplied')
    if (hasGlobalChanges) {
      assertRole(access.membership, ['owner', 'admin'], 'Only community owners and administrators can edit global settings')
      if (!Number.isInteger(input.expectedVersion) || Number(input.expectedVersion) < 1) {
        throw domainError('VALIDATION_FAILED', 'expectedVersion is required for global settings changes')
      }
    }
    if (input.membershipPolicy !== undefined) assertEnum(input.membershipPolicy, ['open', 'approval'], 'membershipPolicy')
    if (input.postingPolicy !== undefined) assertEnum(input.postingPolicy, ['members', 'moderators'], 'postingPolicy')
    const blockedWords = input.blockedWords === undefined ? undefined : normalizeBlockedWords(input.blockedWords)
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      if (hasGlobalChanges) {
        await advisoryLock(trx, `community-settings:${communityId}`)
        const expectedVersion = input.expectedVersion!
        const result = await trx.updateTable('greenfield_community_settings').set({
          ...(input.inviteLinksEnabled === undefined ? {} : {invite_links_enabled: input.inviteLinksEnabled}),
          ...(input.allowAttachments === undefined ? {} : {allow_attachments: input.allowAttachments}),
          ...(input.reactionsEnabled === undefined ? {} : {reactions_enabled: input.reactionsEnabled}),
          ...(input.featuredPostsEnabled === undefined ? {} : {featured_posts_enabled: input.featuredPostsEnabled}),
          ...(blockedWords === undefined ? {} : {blocked_words: blockedWords}),
          updated_at: now,
          version: expectedVersion + 1,
        }).where('community_id', '=', communityId).where('version', '=', expectedVersion).executeTakeFirst()
        if (Number(result.numUpdatedRows ?? 0) !== 1) throw domainError('CONFLICT', 'Community settings version conflict')
        if (input.membershipPolicy !== undefined || input.postingPolicy !== undefined) {
          await trx.updateTable('greenfield_communities').set({
            ...(input.membershipPolicy === undefined ? {} : {membership_policy: input.membershipPolicy}),
            ...(input.postingPolicy === undefined ? {} : {posting_policy: input.postingPolicy}),
            updated_at: now,
            version: sql`version + 1`,
          }).where('community_id', '=', communityId).where('deleted_at', 'is', null).execute()
        }
        await new AuditRepository(trx).append('community.settings-updated', {
          expectedVersion,
          fields: Object.keys(input).filter(key => key !== 'expectedVersion' && !['notifyMentions', 'weeklyDigest', 'eventReminders'].includes(key)),
        }, {
          type: 'communitySettings', id: communityId, actorId,
        }, auditContext(context, accountId))
      }
      if (hasPersonalChanges) {
        const membership = await trx.updateTable('greenfield_community_memberships').set({
          ...(input.notifyMentions === undefined ? {} : {notify_mentions: input.notifyMentions}),
          ...(input.weeklyDigest === undefined ? {} : {weekly_digest: input.weeklyDigest}),
          ...(input.eventReminders === undefined ? {} : {event_reminders: input.eventReminders}),
          updated_at: now,
          version: sql`version + 1`,
        }).where('community_id', '=', communityId).where('actor_id', '=', actorId)
          .where('status', '=', 'active').where('role', '!=', 'restricted').executeTakeFirst()
        if (Number(membership.numUpdatedRows ?? 0) !== 1) throw domainError('FORBIDDEN', 'Active community membership is required')
        await new AuditRepository(trx).append('community.notification-preferences-updated', {
          fields: ['notifyMentions', 'weeklyDigest', 'eventReminders'].filter(key => input[key as keyof typeof input] !== undefined),
        }, {
          type: 'communityMembership', id: `${communityId}:${actorId}`, actorId,
        }, auditContext(context, accountId))
      }
    })
    return this.getSettings(communityId, actorId)
  }

  async listPosts(communityId: string, viewerActorId: string | null, limit: number, cursor: string | null): Promise<CommunityPostDto[]> {
    await this.communityAccess(communityId, viewerActorId)
    const rows = await this.posts.listForCommunity(communityId, limit, cursor, viewerActorId)
    return rows.map(({row, post}) => ({
      communityId,
      moderationState: row.community_moderation_state ?? 'visible',
      featuredAt: row.community_featured_at?.toISOString() ?? null,
      post,
    }))
  }

  async createPost(
    actorId: string,
    communityId: string,
    input: CreateCommunityPostInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityPostDto> {
    const post = await this.postWrites.create(actorId, {
      text: input.text,
      media: input.media,
      content: input.content,
      idempotencyKey: input.idempotencyKey,
      audience: 'private',
      feed: 'following',
      replyPermission: 'everyone',
    }, {...context, communityId})
    const row = await this.db.selectFrom('posts').select(['community_moderation_state', 'community_featured_at'])
      .where('id', '=', post.id).where('community_id', '=', communityId).executeTakeFirstOrThrow()
    return {
      communityId,
      moderationState: row.community_moderation_state ?? 'visible',
      featuredAt: row.community_featured_at?.toISOString() ?? null,
      post,
    }
  }

  async listEvents(communityId: string, viewerActorId: string | null, limit: number, cursor: string | null): Promise<CommunityEventDto[]> {
    await this.communityAccess(communityId, viewerActorId)
    let query = this.db.selectFrom('greenfield_community_events').selectAll()
      .where('community_id', '=', communityId).where('deleted_at', 'is', null)
      .orderBy('starts_at', 'asc').orderBy('event_id', 'asc').limit(limit + 1)
    if (cursor) {
      const [startsAtRaw, eventId] = cursor.split('|')
      const startsAt = new Date(startsAtRaw ?? '')
      if (!eventId || Number.isNaN(startsAt.getTime())) throw domainError('VALIDATION_FAILED', 'Invalid cursor')
      query = query.where(eb => eb.or([
        eb('starts_at', '>', startsAt), eb.and([eb('starts_at', '=', startsAt), eb('event_id', '>', eventId)]),
      ]))
    }
    const rows = await query.execute()
    return this.eventDtos(rows, viewerActorId)
  }

  async getEvent(communityId: string, eventId: string, viewerActorId: string | null): Promise<CommunityEventDto> {
    await this.communityAccess(communityId, viewerActorId)
    const row = await this.db.selectFrom('greenfield_community_events').selectAll()
      .where('community_id', '=', communityId).where('event_id', '=', eventId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('NOT_FOUND', 'Community event not found')
    return this.eventDto(row, viewerActorId)
  }

  async createEvent(
    actorId: string,
    communityId: string,
    input: CommunityEventCreateInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityEventDto> {
    const access = await this.communityAccess(communityId, actorId)
    assertRole(access.membership, ['owner', 'admin', 'moderator'], 'A moderator role is required to create events')
    const values = validateEventInput(input)
    const eventId = randomUUID()
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      await this.bindArtwork(trx, accountId, [values.coverAttachmentId])
      await trx.insertInto('greenfield_community_events').values({
        event_id: eventId, community_id: communityId, creator_actor_id: actorId,
        title: values.title, description: values.description, starts_at: values.startsAt, ends_at: values.endsAt,
        timezone: values.timezone, location_type: values.locationType, location_name: values.locationName,
        online_url: values.onlineUrl, cover_attachment_id: values.coverAttachmentId, capacity: values.capacity,
        status: 'scheduled', created_at: now, updated_at: now, deleted_at: null, version: 1,
      }).execute()
      await this.touch(trx, communityId, now)
      await new AuditRepository(trx).append('community.event-created', {}, {type: 'communityEvent', id: eventId, actorId}, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.event-created', aggregateType: 'communityEvent', aggregateId: eventId,
        actorId, accountId, version: 1, visibility: access.community.visibility,
        payload: {communityId, eventId}, context,
      })
    })
    return this.getEvent(communityId, eventId, actorId)
  }

  async updateEvent(
    actorId: string,
    communityId: string,
    eventId: string,
    input: CommunityEventPatchInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityEventDto> {
    const access = await this.communityAccess(communityId, actorId)
    const row = await this.db.selectFrom('greenfield_community_events').selectAll()
      .where('event_id', '=', eventId).where('community_id', '=', communityId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('NOT_FOUND', 'Community event not found')
    if (row.creator_actor_id !== actorId) assertRole(access.membership, ['owner', 'admin', 'moderator'], 'Only the creator or a moderator can edit this event')
    if (input.status !== undefined) assertEnum(input.status, ['scheduled', 'cancelled'], 'status')
    const merged = validateEventInput({
      title: input.title ?? row.title,
      description: input.description ?? row.description,
      startsAt: input.startsAt ?? row.starts_at.toISOString(),
      endsAt: input.endsAt ?? row.ends_at.toISOString(),
      timezone: input.timezone ?? row.timezone,
      location: input.location ?? {type: row.location_type, name: row.location_name, onlineUrl: row.online_url},
      coverAttachmentId: input.coverAttachmentId === undefined ? row.cover_attachment_id : input.coverAttachmentId,
      capacity: input.capacity === undefined ? row.capacity : input.capacity,
    })
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      const locked = await trx.selectFrom('greenfield_community_events').select(['event_id', 'version'])
        .where('event_id', '=', eventId).where('community_id', '=', communityId)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!locked) throw domainError('NOT_FOUND', 'Community event not found')
      if (locked.version !== input.expectedVersion) throw domainError('CONFLICT', 'Community event version conflict')
      if (merged.capacity !== null) {
        const responses = await trx.selectFrom('greenfield_community_event_responses')
          .select(sql<number>`count(*)::int`.as('count')).where('event_id', '=', eventId)
          .where('response', '=', 'going').executeTakeFirstOrThrow()
        if (responses.count > merged.capacity) {
          throw domainError('CONFLICT', 'Event capacity cannot be lower than the current going count')
        }
      }
      await this.bindArtwork(trx, accountId, [
        input.coverAttachmentId === row.cover_attachment_id ? undefined : input.coverAttachmentId,
      ])
      const result = await trx.updateTable('greenfield_community_events').set({
        title: merged.title, description: merged.description, starts_at: merged.startsAt, ends_at: merged.endsAt,
        timezone: merged.timezone, location_type: merged.locationType, location_name: merged.locationName,
        online_url: merged.onlineUrl, cover_attachment_id: merged.coverAttachmentId, capacity: merged.capacity,
        status: input.status ?? row.status, updated_at: now, version: input.expectedVersion + 1,
      }).where('event_id', '=', eventId).where('community_id', '=', communityId)
        .where('version', '=', input.expectedVersion).executeTakeFirst()
      if (Number(result.numUpdatedRows ?? 0) !== 1) throw domainError('CONFLICT', 'Community event version conflict')
      await this.touch(trx, communityId, now)
      await new AuditRepository(trx).append('community.event-updated', {expectedVersion: input.expectedVersion}, {
        type: 'communityEvent', id: eventId, actorId,
      }, auditContext(context, accountId))
    })
    return this.getEvent(communityId, eventId, actorId)
  }

  async respondToEvent(
    actorId: string,
    communityId: string,
    eventId: string,
    response: CommunityEventResponse | null,
    context: CommunityRequestContext = {},
  ): Promise<CommunityEventDto> {
    const access = await this.communityAccess(communityId, actorId)
    requireActiveMembership(access.membership)
    if (response !== null) assertEnum(response, ['going', 'interested'], 'response')
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      await advisoryLock(trx, `community-event-response:${eventId}`)
      const event = await trx.selectFrom('greenfield_community_events').selectAll()
        .where('event_id', '=', eventId).where('community_id', '=', communityId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!event) throw domainError('NOT_FOUND', 'Community event not found')
      if (event.status === 'cancelled') throw domainError('CONFLICT', 'Cancelled events do not accept responses')
      const existing = await trx.selectFrom('greenfield_community_event_responses').selectAll()
        .where('event_id', '=', eventId).where('actor_id', '=', actorId).executeTakeFirst()
      if (response === existing?.response || (response === null && !existing)) return
      if (response === 'going' && existing?.response !== 'going' && event.capacity !== null) {
        const count = await trx.selectFrom('greenfield_community_event_responses')
          .select(sql<number>`count(*)::int`.as('count')).where('event_id', '=', eventId)
          .where('response', '=', 'going').executeTakeFirstOrThrow()
        if (count.count >= event.capacity) throw domainError('CONFLICT', 'Community event capacity has been reached')
      }
      const now = new Date()
      if (response === null) {
        await trx.deleteFrom('greenfield_community_event_responses').where('event_id', '=', eventId).where('actor_id', '=', actorId).execute()
      } else {
        await trx.insertInto('greenfield_community_event_responses').values({
          event_id: eventId, actor_id: actorId, response, created_at: existing?.created_at ?? now, updated_at: now,
        }).onConflict(conflict => conflict.columns(['event_id', 'actor_id']).doUpdateSet({response, updated_at: now})).execute()
      }
      await new AuditRepository(trx).append('community.event-responded', {response}, {
        type: 'communityEventResponse', id: `${eventId}:${actorId}`, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.event-responded', aggregateType: 'communityEventResponse', aggregateId: `${eventId}:${actorId}`,
        actorId, accountId, visibility: 'private', payload: {communityId, eventId, actorId, response}, context,
      })
    })
    return this.getEvent(communityId, eventId, actorId)
  }

  async listPolls(communityId: string, viewerActorId: string | null, limit: number, cursor: string | null): Promise<CommunityPollDto[]> {
    await this.communityAccess(communityId, viewerActorId)
    let query = this.db.selectFrom('greenfield_community_polls').selectAll()
      .where('community_id', '=', communityId).where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc').orderBy('poll_id', 'desc').limit(limit + 1)
    if (cursor) {
      const [createdAtRaw, pollId] = cursor.split('|')
      const createdAt = new Date(createdAtRaw ?? '')
      if (!pollId || Number.isNaN(createdAt.getTime())) throw domainError('VALIDATION_FAILED', 'Invalid cursor')
      query = query.where(eb => eb.or([
        eb('created_at', '<', createdAt), eb.and([eb('created_at', '=', createdAt), eb('poll_id', '<', pollId)]),
      ]))
    }
    const rows = await query.execute()
    return this.pollDtos(rows, viewerActorId)
  }

  async getPoll(communityId: string, pollId: string, viewerActorId: string | null): Promise<CommunityPollDto> {
    await this.communityAccess(communityId, viewerActorId)
    const row = await this.db.selectFrom('greenfield_community_polls').selectAll()
      .where('community_id', '=', communityId).where('poll_id', '=', pollId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('NOT_FOUND', 'Community poll not found')
    return this.pollDto(row, viewerActorId)
  }

  async createPoll(
    actorId: string,
    communityId: string,
    input: CommunityPollCreateInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityPollDto> {
    const access = await this.communityAccess(communityId, actorId)
    assertRole(access.membership, ['owner', 'admin', 'moderator'], 'A moderator role is required to create polls')
    const question = requiredText(input.question, 'question', 500)
    const options = normalizePollOptions(input.options)
    const closesAt = parseFutureDate(input.closesAt, 'closesAt')
    const resultsVisibility = input.resultsVisibility ?? 'afterVote'
    assertEnum(resultsVisibility, ['always', 'afterVote', 'afterClose'], 'resultsVisibility')
    const pollId = randomUUID()
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      await trx.insertInto('greenfield_community_polls').values({
        poll_id: pollId, community_id: communityId, creator_actor_id: actorId, question,
        closes_at: closesAt, allow_vote_changes: input.allowVoteChanges ?? true,
        results_visibility: resultsVisibility, status: 'open', created_at: now, updated_at: now,
        deleted_at: null, version: 1,
      }).execute()
      await trx.insertInto('greenfield_community_poll_options').values(options.map((text, position) => ({
        poll_id: pollId, option_id: randomUUID(), position, text,
      }))).execute()
      await this.touch(trx, communityId, now)
      await new AuditRepository(trx).append('community.poll-created', {optionCount: options.length}, {
        type: 'communityPoll', id: pollId, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.poll-created', aggregateType: 'communityPoll', aggregateId: pollId,
        actorId, accountId, version: 1, visibility: access.community.visibility,
        payload: {communityId, pollId, optionCount: options.length}, context,
      })
    })
    return this.getPoll(communityId, pollId, actorId)
  }

  async updatePoll(
    actorId: string,
    communityId: string,
    pollId: string,
    input: CommunityPollPatchInput,
    context: CommunityRequestContext = {},
  ): Promise<CommunityPollDto> {
    const access = await this.communityAccess(communityId, actorId)
    const row = await this.db.selectFrom('greenfield_community_polls').selectAll()
      .where('community_id', '=', communityId).where('poll_id', '=', pollId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('NOT_FOUND', 'Community poll not found')
    if (row.creator_actor_id !== actorId) assertRole(access.membership, ['owner', 'admin', 'moderator'], 'Only the creator or a moderator can cancel this poll')
    const now = new Date()
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      const result = await trx.updateTable('greenfield_community_polls').set({
        status: input.status, updated_at: now, version: input.expectedVersion + 1,
      }).where('poll_id', '=', pollId).where('community_id', '=', communityId)
        .where('version', '=', input.expectedVersion).executeTakeFirst()
      if (Number(result.numUpdatedRows ?? 0) !== 1) throw domainError('CONFLICT', 'Community poll version conflict')
      await new AuditRepository(trx).append('community.poll-updated', {status: input.status}, {
        type: 'communityPoll', id: pollId, actorId,
      }, auditContext(context, accountId))
    })
    return this.getPoll(communityId, pollId, actorId)
  }

  async vote(
    actorId: string,
    communityId: string,
    pollId: string,
    optionId: string,
    context: CommunityRequestContext = {},
  ): Promise<CommunityPollDto> {
    const access = await this.communityAccess(communityId, actorId)
    requireActiveMembership(access.membership)
    const accountId = context.accountId ?? await this.accountIdForActor(actorId)
    await this.db.transaction().execute(async trx => {
      await advisoryLock(trx, `community-poll-vote:${pollId}:${actorId}`)
      const poll = await trx.selectFrom('greenfield_community_polls').selectAll()
        .where('community_id', '=', communityId).where('poll_id', '=', pollId)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!poll) throw domainError('NOT_FOUND', 'Community poll not found')
      if (poll.status !== 'open' || poll.closes_at <= new Date()) throw domainError('CONFLICT', 'Community poll is closed')
      const option = await trx.selectFrom('greenfield_community_poll_options').select('option_id')
        .where('poll_id', '=', pollId).where('option_id', '=', optionId).executeTakeFirst()
      if (!option) throw domainError('VALIDATION_FAILED', 'Poll option is invalid')
      const existing = await trx.selectFrom('greenfield_community_poll_votes').selectAll()
        .where('poll_id', '=', pollId).where('actor_id', '=', actorId).executeTakeFirst()
      if (existing?.option_id === optionId) return
      if (existing && !poll.allow_vote_changes) throw domainError('CONFLICT', 'This poll does not allow vote changes')
      const now = new Date()
      await trx.insertInto('greenfield_community_poll_votes').values({
        poll_id: pollId, option_id: optionId, actor_id: actorId,
        created_at: existing?.created_at ?? now, updated_at: now,
      }).onConflict(conflict => conflict.columns(['poll_id', 'actor_id']).doUpdateSet({option_id: optionId, updated_at: now})).execute()
      await new AuditRepository(trx).append('community.poll-voted', {optionChanged: Boolean(existing)}, {
        type: 'communityPollVote', id: `${pollId}:${actorId}`, actorId,
      }, auditContext(context, accountId))
      await this.publish(trx, {
        eventType: 'community.poll-voted', aggregateType: 'communityPollVote', aggregateId: `${pollId}:${actorId}`,
        actorId, accountId, visibility: 'private', payload: {communityId, pollId, actorId, optionId}, context,
      })
    })
    return this.getPoll(communityId, pollId, actorId)
  }

  private async communityAccess(communityId: string, viewerActorId: string | null) {
    const community = await this.db.selectFrom('greenfield_communities').selectAll()
      .where('community_id', '=', communityId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!community) throw domainError('NOT_FOUND', 'Community not found')
    const membership = viewerActorId ? await this.db.selectFrom('greenfield_community_memberships').selectAll()
      .where('community_id', '=', communityId).where('actor_id', '=', viewerActorId).executeTakeFirst() : undefined
    if (community.visibility === 'private' && membership?.status !== 'active') {
      throw domainError('NOT_FOUND', 'Community not found')
    }
    return {community, membership: membership ?? null}
  }

  private summary(
    row: CommunityRow,
    memberCount: number,
    status: MembershipRow['status'] | null,
    role: MembershipRow['role'] | null,
  ): CommunitySummaryDto {
    return {
      id: row.community_id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      category: row.category,
      visibility: row.visibility,
      discoverable: row.discoverable,
      featured: row.featured,
      memberCount,
      membership: status === 'active' ? 'active' : status === 'pending' ? 'pending' : status === 'banned' ? 'banned' : 'none',
      viewerRole: status === 'active' ? role : null,
      recentActivityAt: row.updated_at.toISOString(),
      artwork: {
        iconAttachmentId: row.icon_attachment_id,
        iconUrl: attachmentUrl(this.config.publicApiUrl, row.icon_attachment_id),
        coverAttachmentId: row.cover_attachment_id,
        coverUrl: attachmentUrl(this.config.publicApiUrl, row.cover_attachment_id),
      },
      version: row.version,
    }
  }

  private async eventDto(row: Database['greenfield_community_events'], viewerActorId: string | null): Promise<CommunityEventDto> {
    return (await this.eventDtos([row], viewerActorId))[0]!
  }

  private async eventDtos(
    rows: Database['greenfield_community_events'][],
    viewerActorId: string | null,
  ): Promise<CommunityEventDto[]> {
    if (rows.length === 0) return []
    const eventIds = rows.map(row => row.event_id)
    const [countRows, viewerRows] = await Promise.all([
      this.db.selectFrom('greenfield_community_event_responses').select([
        'event_id',
        sql<number>`count(*) FILTER (WHERE response = 'going')::int`.as('going'),
        sql<number>`count(*) FILTER (WHERE response = 'interested')::int`.as('interested'),
      ]).where('event_id', 'in', eventIds).groupBy('event_id').execute(),
      viewerActorId
        ? this.db.selectFrom('greenfield_community_event_responses').select(['event_id', 'response'])
            .where('event_id', 'in', eventIds).where('actor_id', '=', viewerActorId).execute()
        : Promise.resolve([]),
    ])
    const counts = new Map(countRows.map(row => [row.event_id, row]))
    const viewer = new Map(viewerRows.map(row => [row.event_id, row.response]))
    return rows.map(row => ({
      id: row.event_id,
      communityId: row.community_id,
      creatorActorId: row.creator_actor_id,
      title: row.title,
      description: row.description,
      startsAt: row.starts_at.toISOString(),
      endsAt: row.ends_at.toISOString(),
      timezone: row.timezone,
      location: {type: row.location_type, name: row.location_name, onlineUrl: row.online_url},
      coverAttachmentId: row.cover_attachment_id,
      coverUrl: attachmentUrl(this.config.publicApiUrl, row.cover_attachment_id),
      capacity: row.capacity,
      status: row.status,
      goingCount: counts.get(row.event_id)?.going ?? 0,
      interestedCount: counts.get(row.event_id)?.interested ?? 0,
      viewerResponse: viewer.get(row.event_id) ?? null,
      version: row.version,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    }))
  }

  private async pollDto(row: Database['greenfield_community_polls'], viewerActorId: string | null): Promise<CommunityPollDto> {
    return (await this.pollDtos([row], viewerActorId))[0]!
  }

  private async pollDtos(
    rows: Database['greenfield_community_polls'][],
    viewerActorId: string | null,
  ): Promise<CommunityPollDto[]> {
    if (rows.length === 0) return []
    const pollIds = rows.map(row => row.poll_id)
    const [optionRows, viewerRows, totalRows] = await Promise.all([
      this.db.selectFrom('greenfield_community_poll_options as option').selectAll('option').select(
        sql<number>`(SELECT count(*)::int FROM greenfield_community_poll_votes vote WHERE vote.poll_id = option.poll_id AND vote.option_id = option.option_id)`.as('vote_count'),
      ).where('option.poll_id', 'in', pollIds).orderBy('option.poll_id', 'asc').orderBy('option.position', 'asc').execute(),
      viewerActorId
        ? this.db.selectFrom('greenfield_community_poll_votes').select(['poll_id', 'option_id'])
            .where('poll_id', 'in', pollIds).where('actor_id', '=', viewerActorId).execute()
        : Promise.resolve([]),
      this.db.selectFrom('greenfield_community_poll_votes').select([
        'poll_id', sql<number>`count(*)::int`.as('count'),
      ]).where('poll_id', 'in', pollIds).groupBy('poll_id').execute(),
    ])
    const options = new Map<string, typeof optionRows>()
    for (const option of optionRows) options.set(option.poll_id, [...(options.get(option.poll_id) ?? []), option])
    const viewer = new Map(viewerRows.map(row => [row.poll_id, row.option_id]))
    const totals = new Map(totalRows.map(row => [row.poll_id, row.count]))
    const now = new Date()
    return rows.map(row => {
      const viewerOptionId = viewer.get(row.poll_id) ?? null
      const closed = row.status !== 'open' || row.closes_at <= now
      const resultsVisible = row.results_visibility === 'always'
        || (row.results_visibility === 'afterVote' && viewerOptionId !== null)
        || (row.results_visibility === 'afterClose' && closed)
      return {
        id: row.poll_id,
        communityId: row.community_id,
        creatorActorId: row.creator_actor_id,
        question: row.question,
        options: (options.get(row.poll_id) ?? []).map(option => ({
          id: option.option_id, position: option.position, text: option.text,
          voteCount: resultsVisible ? option.vote_count : null,
        })),
        closesAt: row.closes_at.toISOString(),
        allowVoteChanges: row.allow_vote_changes,
        resultsVisibility: row.results_visibility,
        status: row.status,
        closed,
        viewerOptionId,
        totalVotes: resultsVisible ? (totals.get(row.poll_id) ?? 0) : null,
        version: row.version,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      }
    })
  }

  private async activeMemberCount(communityId: string): Promise<number> {
    const row = await this.db.selectFrom('greenfield_community_memberships').select(sql<number>`count(*)::int`.as('count'))
      .where('community_id', '=', communityId).where('status', '=', 'active').executeTakeFirstOrThrow()
    return row.count
  }

  private async accountIdForActor(actorId: string): Promise<string> {
    const actor = await this.db.selectFrom('actors').select('account_id').where('id', '=', actorId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!actor?.account_id) throw domainError('UNAUTHENTICATED', 'Active actor account is required')
    return actor.account_id
  }

  private async bindArtwork(trx: DbTransaction, accountId: string, values: Array<string | null | undefined>): Promise<void> {
    const ids = [...new Set(values.filter((value): value is string => Boolean(value)))]
    if (ids.length === 0) return
    const rows = await trx.selectFrom('attachments').selectAll().where('attachment_id', 'in', ids).forUpdate().execute()
    if (rows.length !== ids.length || rows.some(row => row.owner_account_id !== accountId || row.kind !== 'image' || row.status !== 'ready' || row.attached_at)) {
      throw domainError('VALIDATION_FAILED', 'One or more community artwork attachments are unavailable')
    }
    const now = new Date()
    await trx.updateTable('attachments').set({attached_at: now, updated_at: now}).where('attachment_id', 'in', ids).execute()
  }

  private async touch(trx: DbTransaction, communityId: string, now: Date): Promise<void> {
    await trx.updateTable('greenfield_communities').set({updated_at: now}).where('community_id', '=', communityId).execute()
  }

  private async publish(trx: DbTransaction, input: {
    eventType: string
    aggregateType: string
    aggregateId: string
    actorId: string
    accountId: string
    version?: number
    visibility: 'public' | 'private' | 'internal'
    payload: Record<string, unknown>
    context: CommunityRequestContext
  }): Promise<void> {
    await new GreenfieldEventBus(trx).publish({
      eventType: input.eventType,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      aggregateVersion: input.version ?? null,
      accountId: input.accountId,
      actorId: input.actorId,
      requestId: input.context.requestId ?? null,
      correlationId: input.context.correlationId ?? input.context.requestId ?? null,
      visibility: input.visibility === 'private' ? 'actor' : input.visibility,
      classification: input.visibility === 'private' ? 'private' : 'internal',
      payload: input.payload,
      metadata: {source: 'greenfield.communities'},
    })
  }
}

function settingsDto(
  row: Database['greenfield_community_settings'],
  community: CommunityRow,
  membership: MembershipRow,
): CommunitySettingsDto {
  const canManage = membership.role === 'owner' || membership.role === 'admin'
  return {
    communityId: row.community_id,
    canManage,
    membershipPolicy: community.membership_policy,
    postingPolicy: community.posting_policy,
    inviteLinksEnabled: row.invite_links_enabled,
    allowAttachments: row.allow_attachments,
    reactionsEnabled: row.reactions_enabled,
    featuredPostsEnabled: row.featured_posts_enabled,
    blockedWords: canManage ? row.blocked_words : null,
    notificationPreferences: {
      notifyMentions: membership.notify_mentions,
      weeklyDigest: membership.weekly_digest,
      eventReminders: membership.event_reminders,
    },
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
  }
}

function membershipView(row: MembershipRow) {
  return {communityId: row.community_id, role: row.role, status: row.status, joinedAt: row.joined_at?.toISOString() ?? null, version: row.version}
}

function requireActiveMembership(row: MembershipRow | null): asserts row is MembershipRow {
  if (!row || row.status !== 'active' || row.role === 'restricted') {
    throw domainError('FORBIDDEN', 'Active community membership is required')
  }
}

function assertRole(row: MembershipRow | null, allowed: CommunityRole[], message: string): asserts row is MembershipRow {
  requireActiveMembership(row)
  if (!allowed.includes(row.role)) throw domainError('FORBIDDEN', message)
}

function validateEventInput(input: CommunityEventCreateInput) {
  const title = requiredText(input.title, 'title', 160)
  const description = optionalText(input.description, 'description', 10_000)
  const startsAt = parseDate(input.startsAt, 'startsAt')
  const endsAt = parseDate(input.endsAt, 'endsAt')
  if (endsAt <= startsAt) throw domainError('VALIDATION_FAILED', 'Event end time must be after its start time')
  const timezone = requiredText(input.timezone, 'timezone', 100)
  try {
    new Intl.DateTimeFormat('en-GB', {timeZone: timezone}).format(startsAt)
  } catch {
    throw domainError('VALIDATION_FAILED', 'timezone must be a valid IANA time zone')
  }
  assertEnum(input.location?.type, ['online', 'inPerson', 'tba'], 'location.type')
  const locationName = nullableText(input.location?.name, 'location.name', 300)
  const onlineUrl = nullableText(input.location?.onlineUrl, 'location.onlineUrl', 2000)
  if (input.location.type === 'online') {
    if (!onlineUrl) throw domainError('VALIDATION_FAILED', 'Online events require an HTTPS URL')
    let parsed: URL
    try { parsed = new URL(onlineUrl) } catch { throw domainError('VALIDATION_FAILED', 'Invalid online event URL') }
    if (parsed.protocol !== 'https:') throw domainError('VALIDATION_FAILED', 'Online event URL must use HTTPS')
  }
  const capacity = input.capacity == null ? null : Number(input.capacity)
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 1_000_000)) {
    throw domainError('VALIDATION_FAILED', 'Event capacity must be a positive integer')
  }
  return {
    title, description, startsAt, endsAt, timezone, locationType: input.location.type,
    locationName, onlineUrl, coverAttachmentId: input.coverAttachmentId ?? null, capacity,
  }
}

function normalizePollOptions(values: string[]): string[] {
  if (!Array.isArray(values) || values.length < 2 || values.length > 10) {
    throw domainError('VALIDATION_FAILED', 'Polls require between 2 and 10 options')
  }
  const options = values.map(value => requiredText(value, 'option', 200))
  if (new Set(options.map(value => value.toLocaleLowerCase())).size !== options.length) {
    throw domainError('VALIDATION_FAILED', 'Poll options must be unique')
  }
  return options
}

function normalizeBlockedWords(values: string[]): string[] {
  if (!Array.isArray(values) || values.length > 100) throw domainError('VALIDATION_FAILED', 'Blocked words must contain at most 100 entries')
  const normalized = values.map(value => requiredText(value, 'blockedWord', 80).normalize('NFKC').toLocaleLowerCase())
  return [...new Set(normalized)]
}

function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw domainError('VALIDATION_FAILED', `${field} is required`)
  const text = value.normalize('NFKC').trim()
  if (!text || text.length > max) throw domainError('VALIDATION_FAILED', `${field} must contain 1-${max} characters`)
  return text
}

function optionalText(value: unknown, field: string, max: number): string {
  if (value == null) return ''
  if (typeof value !== 'string') throw domainError('VALIDATION_FAILED', `${field} must be text`)
  const text = value.normalize('NFKC').trim()
  if (text.length > max) throw domainError('VALIDATION_FAILED', `${field} must contain at most ${max} characters`)
  return text
}

function nullableText(value: unknown, field: string, max: number): string | null {
  if (value == null || value === '') return null
  return optionalText(value, field, max) || null
}

function cleanOptional(value: unknown, max: number): string | undefined {
  if (value == null || value === '') return undefined
  return requiredText(value, 'filter', max)
}

function normalizeSlug(value: string): string {
  const slug = value.normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  if (slug.length < 2 || slug.length > 80) throw domainError('VALIDATION_FAILED', 'Community slug must contain 2-80 URL-safe characters')
  return slug
}

function parseDate(value: string, field: string): Date {
  const parsed = new Date(value)
  if (typeof value !== 'string' || Number.isNaN(parsed.getTime())) throw domainError('VALIDATION_FAILED', `${field} must be an ISO date-time`)
  return parsed
}

function parseFutureDate(value: string, field: string): Date {
  const parsed = parseDate(value, field)
  if (parsed <= new Date()) throw domainError('VALIDATION_FAILED', `${field} must be in the future`)
  return parsed
}

function assertEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): asserts value is T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw domainError('VALIDATION_FAILED', `Invalid ${field}`)
}

function attachmentUrl(base: string, attachmentId: string | null): string | null {
  if (!attachmentId) return null
  return `${base.replace(/\/$/, '')}/v1/attachments/${encodeURIComponent(attachmentId)}/content`
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`)
}

function decodeCommunityCursor(value: string | null) {
  if (!value) return null
  const [featuredRaw, updatedAtRaw, id] = value.split('|')
  const updatedAt = new Date(updatedAtRaw ?? '')
  if (!id || !['0', '1'].includes(featuredRaw ?? '') || Number.isNaN(updatedAt.getTime())) {
    throw domainError('VALIDATION_FAILED', 'Invalid cursor')
  }
  return {featured: featuredRaw === '1', updatedAt, id}
}

function auditContext(context: CommunityRequestContext, accountId: string) {
  return {accountId, requestId: context.requestId ?? null, correlationId: context.correlationId ?? context.requestId ?? null}
}

async function advisoryLock(trx: DbTransaction, key: string): Promise<void> {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(trx)
}

function domainError(code: string, message: string): Error & {code: string} {
  return Object.assign(new Error(message), {code})
}

function mapUniqueCommunityError(error: unknown): never {
  if ((error as {code?: string})?.code === '23505') throw domainError('CONFLICT', 'Community slug is already in use')
  throw error
}
