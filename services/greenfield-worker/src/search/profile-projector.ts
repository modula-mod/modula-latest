import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {entityIdFromEvent, SearchProjector, type SearchProjectionContext} from './projector.js'

export async function projectProfile(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  if (context.event.eventType === 'account.deactivated' || context.event.eventType === 'account.deletion-requested') {
    await tombstoneAccountProfiles(db, projector, context)
    return
  }

  const profileId = entityIdFromEvent(context.event, context.event.aggregateId)
  const row = await db
    .selectFrom('profiles')
    .innerJoin('actors', 'actors.id', 'profiles.actor_id')
    .select([
      'profiles.id',
      'profiles.actor_id',
      'profiles.handle',
      'profiles.display_name',
      'profiles.kind',
      'profiles.bio',
      'profiles.location_label',
      'profiles.location_visibility',
      'profiles.visibility',
      'profiles.module_count',
      'profiles.featured_module_ids',
      'profiles.joined_at',
      'profiles.created_at',
      'profiles.updated_at',
      'profiles.deleted_at',
      'profiles.version',
      'actors.account_id',
    ])
    .where('profiles.id', '=', profileId)
    .executeTakeFirst()

  if (!row || row.deleted_at) {
    await projector.tombstone({...context, entityId: profileId}, {
      sourceVersion: projector.sourceVersionFor(context, row?.version ?? Date.now()),
      accountId: row?.account_id ?? context.event.accountId ?? null,
      ownerId: row?.actor_id ?? context.event.actorId ?? null,
      visibility: row?.visibility === 'public' ? 'public' : row?.visibility === 'followers' || row?.visibility === 'teams' ? 'followers' : 'private',
      updatedAt: row?.updated_at,
    })
    return
  }

  const links = await db
    .selectFrom('profile_links')
    .select(['label', 'domain', 'url'])
    .where('profile_id', '=', row.id)
    .where('visibility', '=', 'public')
    .where('deleted_at', 'is', null)
    .orderBy('sort_order', 'asc')
    .execute()
  const publicLocation = row.location_visibility === 'public' ? row.location_label : null
  const linkText = links.map(link => `${link.label} ${link.domain}`).join(' ')
  const document: GreenfieldSearchDocument = {
    documentId: `profile:${row.id}`,
    schemaVersion: '1.0.0',
    entityType: 'profile',
    entityId: row.id,
    sourceVersion: projector.sourceVersionFor(context, row.version),
    accountId: row.account_id ?? undefined,
    ownerId: row.actor_id,
    title: row.display_name,
    body: [row.handle, row.bio, publicLocation, linkText].filter(Boolean).join(' '),
    summary: row.bio || undefined,
    keywords: Array.from(new Set([row.handle, row.display_name, row.kind, publicLocation].filter(Boolean).map(item => item!.toLowerCase()))),
    tags: [],
    visibility: row.visibility === 'public' ? 'public' : row.visibility === 'followers' || row.visibility === 'teams' ? 'followers' : 'private',
    status: 'active',
    language: 'en',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      handle: row.handle,
      kind: row.kind,
      publicLocation,
      publicLinks: links.map(link => ({label: link.label, domain: link.domain, url: link.url})),
      moduleCount: row.module_count,
      featuredModuleIds: row.featured_module_ids,
    },
  }
  await projector.upsert({...context, entityId: row.id}, document)
}

async function tombstoneAccountProfiles(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const accountId = context.event.accountId ?? context.event.aggregateId
  const rows = await db
    .selectFrom('profiles')
    .innerJoin('actors', 'actors.id', 'profiles.actor_id')
    .select(['profiles.id', 'profiles.actor_id', 'profiles.version', 'profiles.updated_at'])
    .where('actors.account_id', '=', accountId)
    .execute()
  for (const row of rows) {
    await projector.tombstone({...context, entityId: row.id}, {
      sourceVersion: projector.sourceVersionFor(context, row.version + 1),
      accountId,
      ownerId: row.actor_id,
      visibility: 'private',
      status: context.event.eventType === 'account.deletion-requested' ? 'deleted' : 'unavailable',
      updatedAt: row.updated_at,
    })
  }
}
