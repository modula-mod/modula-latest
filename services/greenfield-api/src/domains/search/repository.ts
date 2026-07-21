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
    viewerActorId: string | null
  }): Promise<SearchResultDto> {
    const q = input.q.trim()
    if (q.length < 1 || q.length > 200) {
      throw Object.assign(new Error('Invalid query'), {code: 'VALIDATION_FAILED'})
    }
    const blocked = await this.moderation.blockedSet(input.viewerActorId)
    const muted = await this.moderation.mutedSet(input.viewerActorId)
    const result: SearchResultDto = {query: q, profiles: [], posts: [], modules: []}

    if (input.type === 'all' || input.type === 'profiles') {
      const rows = await this.db
        .selectFrom('profiles')
        .select(['id', 'actor_id'])
        .where('deleted_at', 'is', null)
        .where('visibility', '=', 'public')
        .where(sql<boolean>`search_vector @@ plainto_tsquery('english', ${q})`)
        .limit(input.limit)
        .execute()
      for (const row of rows) {
        if (blocked.has(row.actor_id) || muted.has(row.actor_id)) continue
        const profile = await this.profiles.getByActorId(row.actor_id)
        if (profile) result.profiles.push(profile)
      }
    }

    if (input.type === 'all' || input.type === 'posts') {
      const rows = await this.db
        .selectFrom('posts')
        .select(['id', 'author_actor_id'])
        .where('deleted_at', 'is', null)
        .where('audience', '=', 'public')
        .where(sql<boolean>`search_vector @@ plainto_tsquery('english', ${q})`)
        .limit(input.limit)
        .execute()
      for (const row of rows) {
        if (blocked.has(row.author_actor_id) || muted.has(row.author_actor_id)) continue
        const post = await this.posts.getById(row.id)
        if (post) result.posts.push(post)
      }
    }

    if (input.type === 'all' || input.type === 'modules') {
      const rows = await this.db
        .selectFrom('featured_modules')
        .selectAll()
        .where('deleted_at', 'is', null)
        .limit(input.limit)
        .execute()
      for (const row of rows) {
        const payload = row.payload as {id?: string; name?: string; description?: string}
        const hay = `${payload.name ?? ''} ${payload.description ?? ''}`.toLowerCase()
        if (!hay.includes(q.toLowerCase())) continue
        result.modules.push({
          id: payload.id ?? row.id,
          name: payload.name ?? 'Module',
          description: payload.description,
        })
      }
    }

    return result
  }
}
