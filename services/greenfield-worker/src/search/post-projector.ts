import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {entityIdFromEvent, SearchProjector, type SearchProjectionContext} from './projector.js'

export async function projectPost(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const postId = entityIdFromEvent(context.event, context.event.aggregateId)
  const row = await db
    .selectFrom('posts')
    .innerJoin('actors', 'actors.id', 'posts.author_actor_id')
    .leftJoin('profiles', 'profiles.actor_id', 'posts.author_actor_id')
    .select([
      'posts.id',
      'posts.author_actor_id',
      'posts.kind',
      'posts.text',
      'posts.feed',
      'posts.audience',
      'posts.link_domain',
      'posts.link_title',
      'posts.link_description',
      'posts.module_name',
      'posts.module_status',
      'posts.created_at',
      'posts.updated_at',
      'posts.deleted_at',
      'posts.version',
      'actors.account_id',
      'profiles.handle',
      'profiles.display_name',
    ])
    .where('posts.id', '=', postId)
    .executeTakeFirst()

  if (!row || context.event.eventType === 'post.deleted' || row.deleted_at) {
    await projector.tombstone(
      {...context, entityId: postId},
      {
        sourceVersion: projector.sourceVersionFor(context, row?.version ?? Date.now()),
        accountId: row?.account_id ?? context.event.accountId ?? null,
        ownerId: row?.author_actor_id ?? context.event.actorId ?? null,
        visibility: row?.audience === 'public' ? 'public' : row?.audience === 'followers' ? 'followers' : 'private',
        updatedAt: row?.updated_at,
      },
    )
    return
  }

  const media = await db
    .selectFrom('post_media')
    .select(['title', 'alt_text'])
    .where('post_id', '=', postId)
    .where('deleted_at', 'is', null)
    .orderBy('sort_order', 'asc')
    .execute()
  const hashtags = extractHashtags(row.text)
  const mediaText = media.map(item => [item.title, item.alt_text].filter(Boolean).join(' ')).filter(Boolean)
  const title = row.link_title ?? row.module_name ?? firstSentence(row.text) ?? row.display_name ?? row.handle ?? 'Post'
  const document: GreenfieldSearchDocument = {
    documentId: `post:${postId}`,
    schemaVersion: '1.0.0',
    entityType: 'post',
    entityId: postId,
    sourceVersion: projector.sourceVersionFor(context, row.version),
    accountId: row.account_id ?? undefined,
    ownerId: row.author_actor_id,
    title,
    body: [row.text, row.link_description, ...mediaText].filter(Boolean).join(' '),
    summary: firstSentence(row.text) ?? row.link_description ?? undefined,
    keywords: Array.from(new Set([row.handle, row.display_name, row.link_domain, row.module_name, ...hashtags].filter(Boolean).map(item => item!.toLowerCase()))),
    tags: hashtags,
    visibility: row.audience === 'public' ? 'public' : row.audience === 'followers' ? 'followers' : 'private',
    status: 'active',
    language: 'en',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      handle: row.handle,
      authorDisplayName: row.display_name,
      feed: row.feed,
      kind: row.kind,
      linkDomain: row.link_domain,
      mediaCount: media.length,
      audience: row.audience,
    },
  }
  await projector.upsert({...context, entityId: postId}, document)
}

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return []
  return Array.from(new Set(Array.from(text.matchAll(/(^|\s)#([\p{L}\p{N}_-]{1,80})/gu)).map(match => match[2]!.toLowerCase())))
}

function firstSentence(text: string | null | undefined): string | undefined {
  if (!text) return undefined
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return undefined
  return compact.length <= 120 ? compact : `${compact.slice(0, 117).trim()}...`
}
