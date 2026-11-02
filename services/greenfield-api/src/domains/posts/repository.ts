import type {PostContentDto, SocialPostDto} from '@modula/api-contracts'
import {toDto as attachmentDto} from '../attachments/service.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {sql} from 'kysely'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import {ProfileRepository} from '../profiles/repository.js'
import {publicIdentitiesForActors} from '../../premium/badges.js'

type PostRow = Database['posts']

export class PostRepository {
  private readonly profiles: ProfileRepository
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb, private readonly publicApiUrl = '') {
    this.profiles = new ProfileRepository(db)
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async getById(postId: string, viewerActorId: string | null = null): Promise<SocialPostDto | null> {
    const row = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    const decision = await this.policies.evaluateAndAudit({
      actorId: viewerActorId,
      action: 'post.read',
      resource: {type: 'post', id: postId, ownerActorId: row.author_actor_id, visibility: row.audience},
    })
    if (!decision.allowed) return null
    try {
      return await this.hydrate(row, viewerActorId)
    } catch (error: any) {
      if (error?.code === 'NOT_FOUND' || String(error?.message || '').startsWith('Missing author')) return null
      throw error
    }
  }

  async getByIdForAuthor(postId: string, authorActorId: string): Promise<SocialPostDto | null> {
    const row = await this.db
      .selectFrom('posts')
      .selectAll()
      .where('id', '=', postId)
      .where('author_actor_id', '=', authorActorId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    return this.hydrate(row, authorActorId)
  }

  /**
   * Home feed modes (N3C / ranking-v1):
   * - following: posts authored by accounts the viewer follows (requires viewerActorId; empty otherwise)
   * - forYou: public posts scored deterministically (no ML):
   *     score = like*2 + reply*3 + repost*4 + reaction*2 + max(0, 48 - ageHours)
   *   Cursor encodes score|createdAt|id when ranking; createdAt|id for chronological modes.
   * - modules: posts with feed=modules (module updates / announcements), reverse chronological
   * Visibility/blocks/mutes are enforced by the route (audience=public + excludedActorIds).
   */
  async listHome(mode: string, limit: number, cursor: string | null, excludedActorIds: string[] = [], viewerActorId: string | null = null): Promise<SocialPostDto[]> {
    if (mode === 'following' && !viewerActorId) {
      return []
    }

    if (mode === 'forYou') {
      return this.listHomeForYou(limit, cursor, excludedActorIds, viewerActorId)
    }

    let query = this.db
      .selectFrom('posts')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('audience', '=', 'public')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)

    if (mode === 'modules') {
      query = query.where('feed', '=', 'modules')
    } else if (mode === 'following' && viewerActorId) {
      query = query.where('author_actor_id', 'in', (eb) =>
        eb
          .selectFrom('follows')
          .select('followed_actor_id')
          .where('follower_actor_id', '=', viewerActorId)
          .where('deleted_at', 'is', null),
      )
    }

    if (excludedActorIds.length > 0) query = query.where('author_actor_id', 'not in', excludedActorIds)
    if (cursor) {
      const [createdAt, id] = cursor.split('|')
      if (!createdAt || !id) throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      query = query.where(({eb, or, and}) =>
        or([
          eb('created_at', '<', new Date(createdAt)),
          and([eb('created_at', '=', new Date(createdAt)), eb('id', '<', id)]),
        ]),
      )
    }
    const rows = await query.execute()
    return this.hydrateMany(rows, viewerActorId)
  }

  private async listHomeForYou(
    limit: number,
    cursor: string | null,
    excludedActorIds: string[],
    viewerActorId: string | null,
  ): Promise<SocialPostDto[]> {
    // ranking-v1: deterministic engagement + recency; not ML / not personalized.
    const scoreExpr = sql<number>`(
      (like_count * 2) + (reply_count * 3) + (repost_count * 4) + (reaction_count * 2)
      + greatest(0, 48 - (extract(epoch from (now() - created_at)) / 3600.0))
    )`

    let query = this.db
      .selectFrom('posts')
      .selectAll()
      .select(scoreExpr.as('ranking_score'))
      .where('deleted_at', 'is', null)
      .where('audience', '=', 'public')
      .where('feed', 'in', ['forYou', 'following'])
      .orderBy(scoreExpr, 'desc')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)

    if (excludedActorIds.length > 0) query = query.where('author_actor_id', 'not in', excludedActorIds)

    if (cursor) {
      const parts = cursor.split('|')
      if (parts.length === 3) {
        const [scoreRaw, createdAt, id] = parts
        const score = Number(scoreRaw)
        if (!Number.isFinite(score) || !createdAt || !id) {
          throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
        }
        query = query.where(({eb, or, and}) =>
          or([
            eb(scoreExpr, '<', score),
            and([
              eb(scoreExpr, '=', score),
              eb('created_at', '<', new Date(createdAt)),
            ]),
            and([
              eb(scoreExpr, '=', score),
              eb('created_at', '=', new Date(createdAt)),
              eb('id', '<', id),
            ]),
          ]),
        )
      } else {
        const [createdAt, id] = parts
        if (!createdAt || !id) throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
        query = query.where(({eb, or, and}) =>
          or([
            eb('created_at', '<', new Date(createdAt)),
            and([eb('created_at', '=', new Date(createdAt)), eb('id', '<', id)]),
          ]),
        )
      }
    }

    const rows = await query.execute()
    return this.hydrateMany(rows, viewerActorId)
  }

  async listForHandle(
    handle: string,
    limit: number,
    cursor: string | null,
    viewerActorId: string | null = null,
  ): Promise<SocialPostDto[] | null> {
    // `getByHandle` already returns null when the viewer and author block each
    // other in either direction, so a blocked author's posts are unreachable here.
    const profile = await this.profiles.getByHandle(handle, viewerActorId)
    if (!profile) return null
    const actor = await this.db
      .selectFrom('profiles')
      .select('actor_id')
      .where('id', '=', profile.id)
      .executeTakeFirstOrThrow()
    let query = this.db
      .selectFrom('posts')
      .selectAll()
      .where('author_actor_id', '=', actor.actor_id)
      .where('deleted_at', 'is', null)
      .where('audience', '=', 'public')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
    if (cursor) {
      const [createdAt, id] = cursor.split('|')
      if (!createdAt || !id) throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      query = query.where(({eb, or, and}) =>
        or([
          eb('created_at', '<', new Date(createdAt)),
          and([eb('created_at', '=', new Date(createdAt)), eb('id', '<', id)]),
        ]),
      )
    }
    const rows = await query.execute()
    return Promise.all(rows.map(row => this.hydrate(row, viewerActorId)))
  }

  async listForCommunity(
    communityId: string,
    limit: number,
    cursor: string | null,
    viewerActorId: string | null,
  ): Promise<Array<{row: PostRow; post: SocialPostDto}>> {
    let query = this.db
      .selectFrom('posts')
      .selectAll()
      .where('community_id', '=', communityId)
      .where('community_moderation_state', '=', 'visible')
      .where('deleted_at', 'is', null)
      .orderBy(sql`community_featured_at desc nulls last`)
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
    if (cursor) {
      const [featuredAtRaw, createdAtRaw, id] = cursor.split('|')
      if (!featuredAtRaw || !createdAtRaw || !id) {
        throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      }
      const featuredAt = featuredAtRaw === '-' ? null : new Date(featuredAtRaw)
      const createdAt = new Date(createdAtRaw)
      if ((featuredAt && Number.isNaN(featuredAt.getTime())) || Number.isNaN(createdAt.getTime())) {
        throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      }
      query = query.where(({eb, or, and}) => featuredAt
        ? or([
            eb('community_featured_at', 'is', null),
            eb('community_featured_at', '<', featuredAt),
            and([eb('community_featured_at', '=', featuredAt), eb('created_at', '<', createdAt)]),
            and([
              eb('community_featured_at', '=', featuredAt),
              eb('created_at', '=', createdAt),
              eb('id', '<', id),
            ]),
          ])
        : or([
            and([eb('community_featured_at', 'is', null), eb('created_at', '<', createdAt)]),
            and([
              eb('community_featured_at', 'is', null),
              eb('created_at', '=', createdAt),
              eb('id', '<', id),
            ]),
          ]))
    }
    const rows = await query.execute()
    const posts = await this.hydrateMany(rows, viewerActorId)
    const byId = new Map(posts.map(post => [post.id, post]))
    return rows.flatMap(row => {
      const post = byId.get(row.id)
      return post ? [{row, post}] : []
    })
  }

  
  private async hydrateMany(rows: PostRow[], viewerActorId: string | null): Promise<SocialPostDto[]> {
    // Pre-warm the bounded identity cache with one batched lookup so feed
    // hydration never adds one membership/verification query per author.
    await publicIdentitiesForActors(this.db, rows.map(row => row.author_actor_id))
    const items: SocialPostDto[] = []
    for (const row of rows) {
      try {
        items.push(await this.hydrate(row, viewerActorId))
      } catch (error: any) {
        // Skip rows with deleted/blocked authors so one bad seed cannot 500 the feed.
        if (error?.code === 'NOT_FOUND' || String(error?.message || '').startsWith('Missing author')) {
          continue
        }
        throw error
      }
    }
    return items
  }

  private async hydrate(row: PostRow, viewerActorId: string | null = null, depth = 0): Promise<SocialPostDto> {
    const author = await this.profiles.getAuthorForReadablePost(row.author_actor_id, viewerActorId)
    if (!author) {
      throw Object.assign(new Error(`Missing author for post ${row.id}`), {code: 'NOT_FOUND'})
    }
    const media = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('post_id', '=', row.id)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute()
    const richRows = await this.db
      .selectFrom('post_content as content')
      .innerJoin('attachments as attachment', 'attachment.attachment_id', 'content.attachment_id')
      .select([
        'content.content_id', 'content.content_type', 'content.sort_order', 'content.caption',
        'attachment.attachment_id', 'attachment.kind', 'attachment.mime_type', 'attachment.original_filename',
        'attachment.byte_size', 'attachment.checksum', 'attachment.status', 'attachment.width', 'attachment.height',
        'attachment.duration_seconds', 'attachment.page_count', 'attachment.preview_key', 'attachment.thumbnail_key',
      ])
      .where('content.post_id', '=', row.id)
      .orderBy('content.sort_order', 'asc')
      .execute()
    const content: PostContentDto[] = richRows.map(item => ({
      id: item.content_id, type: item.content_type, order: item.sort_order,
      caption: item.caption ?? undefined,
      attachment: attachmentDto(item, this.publicApiUrl),
    }))

    let viewerReaction: Database['greenfield_reactions']['reaction_type'] | null = null
    let saved = false
    let reposted = false
    if (viewerActorId) {
      const [reaction, save, repost] = await Promise.all([
        this.db.selectFrom('greenfield_reactions').select('reaction_type').where('actor_id', '=', viewerActorId).where('post_id', '=', row.id).executeTakeFirst(),
        this.db.selectFrom('post_saves').select('id').where('actor_id', '=', viewerActorId).where('post_id', '=', row.id).where('deleted_at', 'is', null).executeTakeFirst(),
        this.db.selectFrom('post_reposts').select('id').where('actor_id', '=', viewerActorId).where('post_id', '=', row.id).where('deleted_at', 'is', null).executeTakeFirst(),
      ])
      viewerReaction = reaction?.reaction_type ?? null
      saved = Boolean(save)
      reposted = Boolean(repost)
    }

    let quotedPost: SocialPostDto | null | undefined
    if (depth === 0) {
      const quoteLink = await this.db
        .selectFrom('greenfield_quote_posts')
        .select(['quoted_post_id'])
        .where('post_id', '=', row.id)
        .executeTakeFirst()
      if (quoteLink) {
        const quotedRow = await this.db
          .selectFrom('posts')
          .selectAll()
          .where('id', '=', quoteLink.quoted_post_id)
          .where('deleted_at', 'is', null)
          .executeTakeFirst()
        if (!quotedRow) {
          quotedPost = null
        } else {
          const quotedDecision = await this.policies.evaluateAndAudit({
            actorId: viewerActorId,
            action: 'post.read',
            resource: {
              type: 'post',
              id: quotedRow.id,
              ownerActorId: quotedRow.author_actor_id,
              visibility: quotedRow.audience,
            },
          })
          quotedPost = quotedDecision.allowed ? await this.hydrate(quotedRow, viewerActorId, depth + 1) : null
        }
      }
    }

    const base = {
      id: row.id,
      author,
      createdAt: row.created_at.toISOString(),
      feed: row.feed,
      text: row.text ?? undefined,
      liked: viewerReaction === 'like',
      viewerReaction,
      reactionCount: row.reaction_count,
      saved,
      reposted,
      likeCount: row.like_count,
      replyCount: row.reply_count,
      repostCount: row.repost_count,
      quoteCount: row.quote_count,
      audience: row.audience,
      version: row.version,
      ...(quotedPost !== undefined ? {quotedPost} : {}),
    }

    if (row.kind === 'media') {
      return {
        ...base,
        kind: 'media',
        glowColour: row.glow_colour ?? '#369CAA',
        media: media.map(item => ({
          id: item.id,
          kind: 'image' as const,
          url: item.url ?? undefined,
          title: item.title ?? undefined,
          colour: item.colour ?? undefined,
          aspectRatio: item.aspect_ratio ? Number(item.aspect_ratio) : undefined,
          altText: item.alt_text ?? undefined,
        })),
        content,
      }
    }
    if (row.kind === 'link') {
      return {
        ...base,
        kind: 'link',
        link: {
          domain: row.link_domain ?? 'modula.digital',
          title: row.link_title ?? 'Link',
          description: row.link_description ?? '',
          image: row.link_image ?? undefined,
        },
      }
    }
    if (row.kind === 'module') {
      return {
        ...base,
        kind: 'module',
        module: {
          name: row.module_name ?? 'Module',
          actionLabel: row.module_action_label ?? 'Open',
          status: row.module_status ?? 'Preview',
        },
      }
    }
    return {...base, kind: 'text', text: row.text ?? ''}
  }
}
