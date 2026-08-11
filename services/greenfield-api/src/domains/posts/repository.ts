import type {SocialPostDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {GreenfieldPolicyEngine} from '../policy/index.js'
import {ProfileRepository} from '../profiles/repository.js'

type PostRow = Database['posts']

export class PostRepository {
  private readonly profiles: ProfileRepository
  private readonly policies: GreenfieldPolicyEngine

  constructor(private readonly db: ModulaDb) {
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
    return this.hydrate(row, viewerActorId)
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

  async listHome(mode: string, limit: number, cursor: string | null, excludedActorIds: string[] = [], viewerActorId: string | null = null): Promise<SocialPostDto[]> {
    let query = this.db
      .selectFrom('posts')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('audience', '=', 'public')
      .orderBy('created_at', 'desc')
      .orderBy('id', 'desc')
      .limit(limit + 1)
    if (mode === 'modules') query = query.where('feed', '=', 'modules')
    else if (mode === 'forYou') query = query.where('feed', 'in', ['forYou', 'following'])
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
    return Promise.all(rows.map(row => this.hydrate(row, viewerActorId)))
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

  private async hydrate(row: PostRow, viewerActorId: string | null = null, depth = 0): Promise<SocialPostDto> {
    const author = await this.profiles.getByActorId(row.author_actor_id)
    if (!author) {
      throw new Error(`Missing author for post ${row.id}`)
    }
    const media = await this.db
      .selectFrom('post_media')
      .selectAll()
      .where('post_id', '=', row.id)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute()

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
      liked: false,
      saved: false,
      reposted: false,
      likeCount: row.like_count,
      replyCount: row.reply_count,
      repostCount: row.repost_count,
      quoteCount: row.quote_count,
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
