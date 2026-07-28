import type {SearchResultDto, SearchType} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'
import {PostRepository} from '../posts/repository.js'
import {ProfileRepository} from '../profiles/repository.js'
import {ModerationRepository} from '../moderation/repository.js'
import {sql} from 'kysely'

export class SearchRepository {
  private readonly posts: PostRepository
  private readonly profiles: ProfileRepository
  private readonly moderation: ModerationRepository

  constructor(private readonly db: ModulaDb) {
    this.posts = new PostRepository(db)
    this.profiles = new ProfileRepository(db)
    this.moderation = new ModerationRepository(db)
  }

  async search(input: {
    q: string
    type: SearchType
    limit: number
    cursor: string | null
    viewerActorId: string | null
  }): Promise<SearchResultDto> {
    const q = input.q.trim()
    if (q.length < 1 || q.length > 200) {
      throw Object.assign(new Error('Invalid query'), {code: 'VALIDATION_FAILED'})
    }
    if (!['all', 'profiles', 'posts', 'modules'].includes(input.type)) {
      throw Object.assign(new Error('Invalid search type'), {code: 'VALIDATION_FAILED'})
    }
    const offset = decodeOffsetCursor(input.cursor)
    const nextOffset = offset + input.limit
    const likePattern = `%${escapeLike(q.toLowerCase())}%`
    const blocked = await this.moderation.blockedSet(input.viewerActorId)
    const muted = await this.moderation.mutedSet(input.viewerActorId)
    const result: SearchResultDto = {
      query: q,
      profiles: [],
      posts: [],
      modules: [],
      nextCursor: null,
      hasMore: false,
    }

    if (input.type === 'all' || input.type === 'profiles') {
      const rows = await this.db
        .selectFrom('profiles')
        .select(['id', 'actor_id'])
        .where('deleted_at', 'is', null)
        .where('visibility', '=', 'public')
        .where(sql<boolean>`
          search_vector @@ plainto_tsquery('english', ${q})
          OR lower(display_name) LIKE ${likePattern}
          OR lower(handle) LIKE ${likePattern}
          OR lower(bio) LIKE ${likePattern}
        `)
        .orderBy('updated_at', 'desc')
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(input.limit + 1)
        .execute()
      if (rows.length > input.limit) result.hasMore = true
      for (const row of rows) {
        if (blocked.has(row.actor_id) || muted.has(row.actor_id)) continue
        const profile = await this.profiles.getByActorId(row.actor_id)
        if (profile) result.profiles.push(profile)
        if (result.profiles.length >= input.limit) break
      }
    }

    if (input.type === 'all' || input.type === 'posts') {
      const rows = await this.db
        .selectFrom('posts')
        .select(['id', 'author_actor_id'])
        .where('deleted_at', 'is', null)
        .where('audience', '=', 'public')
        .where(sql<boolean>`
          search_vector @@ plainto_tsquery('english', ${q})
          OR lower(coalesce(text, '')) LIKE ${likePattern}
        `)
        .orderBy('created_at', 'desc')
        .orderBy('id', 'desc')
        .offset(offset)
        .limit(input.limit + 1)
        .execute()
      if (rows.length > input.limit) result.hasMore = true
      for (const row of rows) {
        if (blocked.has(row.author_actor_id) || muted.has(row.author_actor_id)) continue
        const post = await this.posts.getById(row.id)
        if (post) result.posts.push(post)
        if (result.posts.length >= input.limit) break
      }
    }

    if (input.type === 'all' || input.type === 'modules') {
      const rows = await this.db
        .selectFrom('featured_modules')
        .selectAll()
        .where('deleted_at', 'is', null)
        .where(sql<boolean>`lower(payload::text) LIKE ${likePattern}`)
        .orderBy('sort_order', 'asc')
        .orderBy('id', 'asc')
        .offset(offset)
        .limit(input.limit + 1)
        .execute()
      if (rows.length > input.limit) result.hasMore = true
      for (const row of rows) {
        const payload = row.payload as {id?: string; name?: string; description?: string}
        result.modules.push({
          id: payload.id ?? row.id,
          name: payload.name ?? 'Module',
          description: payload.description,
        })
        if (result.modules.length >= input.limit) break
      }
    }

    result.nextCursor = result.hasMore ? `offset:${nextOffset}` : null
    return result
  }
}

function decodeOffsetCursor(cursor: string | null): number {
  if (!cursor) return 0
  const match = /^offset:(\d+)$/.exec(cursor)
  if (!match) {
    throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
  }
  const offset = Number(match[1])
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
  }
  return offset
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, match => `\\${match}`)
}
