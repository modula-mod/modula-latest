import {randomUUID} from 'node:crypto'
import type {SavedCollectionDto, SavedCollectionItemDto} from '@modula/api-contracts'
import {sql} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'
import {PostRepository} from '../posts/repository.js'

export type CollectionRequestContext = {
  accountId?: string | null
  requestId?: string | null
  correlationId?: string | null
}

export class SavedCollectionService {
  private readonly posts: PostRepository

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.posts = new PostRepository(db, config.publicApiUrl)
  }

  async list(actorId: string, limit: number, cursor: string | null): Promise<SavedCollectionDto[]> {
    const decoded = decodeCollectionCursor(cursor)
    let query = this.db.selectFrom('greenfield_saved_collections as collection')
      .selectAll('collection')
      .select(sql<number>`(
        SELECT count(*)::int FROM greenfield_saved_collection_items item
        WHERE item.collection_id = collection.collection_id AND item.deleted_at IS NULL
      )`.as('item_count'))
      .where('collection.owner_actor_id', '=', actorId)
      .where('collection.deleted_at', 'is', null)
      .orderBy('collection.updated_at', 'desc')
      .orderBy('collection.collection_id', 'desc')
      .limit(limit + 1)
    if (decoded) {
      query = query.where(eb => eb.or([
        eb('collection.updated_at', '<', decoded.updatedAt),
        eb.and([
          eb('collection.updated_at', '=', decoded.updatedAt),
          eb('collection.collection_id', '<', decoded.id),
        ]),
      ]))
    }
    return (await query.execute()).map(row => collectionDto(row, Number(row.item_count)))
  }

  async get(actorId: string, collectionId: string): Promise<SavedCollectionDto> {
    const row = await this.ownedCollection(actorId, collectionId)
    const count = await this.db.selectFrom('greenfield_saved_collection_items')
      .select(sql<number>`count(*)::int`.as('count'))
      .where('collection_id', '=', collectionId).where('deleted_at', 'is', null).executeTakeFirstOrThrow()
    return collectionDto(row, Number(count.count))
  }

  async create(actorId: string, nameInput: string, context: CollectionRequestContext = {}): Promise<SavedCollectionDto> {
    const name = collectionName(nameInput)
    const id = randomUUID()
    const now = new Date()
    try {
      await this.db.transaction().execute(async trx => {
        await trx.insertInto('greenfield_saved_collections').values({
          collection_id: id, owner_actor_id: actorId, name,
          created_at: now, updated_at: now, deleted_at: null, version: 1,
        }).execute()
        await new AuditRepository(trx).append('saved.collection.created', {},
          {type: 'savedCollection', id, actorId}, auditContext(context))
      })
    } catch (error) {
      if ((error as {code?: string})?.code === '23505') throw domainError('A collection with that name already exists', 'CONFLICT')
      throw error
    }
    return {id, name, itemCount: 0, version: 1, createdAt: now.toISOString(), updatedAt: now.toISOString()}
  }

  async update(
    actorId: string,
    collectionId: string,
    input: {name: string; expectedVersion: number},
    context: CollectionRequestContext = {},
  ): Promise<SavedCollectionDto> {
    const name = collectionName(input.name)
    const now = new Date()
    try {
      await this.db.transaction().execute(async trx => {
        const updated = await trx.updateTable('greenfield_saved_collections')
          .set({name, updated_at: now, version: input.expectedVersion + 1})
          .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
          .where('deleted_at', 'is', null).where('version', '=', input.expectedVersion).executeTakeFirst()
        if (updated.numUpdatedRows !== 1n) await assertCollectionConflict(trx, actorId, collectionId)
        await new AuditRepository(trx).append('saved.collection.updated', {expectedVersion: input.expectedVersion},
          {type: 'savedCollection', id: collectionId, actorId}, auditContext(context))
      })
    } catch (error) {
      if ((error as {code?: string})?.code === '23505') throw domainError('A collection with that name already exists', 'CONFLICT')
      throw error
    }
    return this.get(actorId, collectionId)
  }

  async remove(
    actorId: string,
    collectionId: string,
    expectedVersion: number,
    context: CollectionRequestContext = {},
  ): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const now = new Date()
      const removed = await trx.updateTable('greenfield_saved_collections')
        .set({deleted_at: now, updated_at: now, version: expectedVersion + 1})
        .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
        .where('deleted_at', 'is', null).where('version', '=', expectedVersion).executeTakeFirst()
      if (removed.numUpdatedRows !== 1n) await assertCollectionConflict(trx, actorId, collectionId)
      await new AuditRepository(trx).append('saved.collection.deleted', {expectedVersion},
        {type: 'savedCollection', id: collectionId, actorId}, auditContext(context))
    })
  }

  async listItems(actorId: string, collectionId: string, limit: number, cursor: string | null): Promise<SavedCollectionItemDto[]> {
    await this.ownedCollection(actorId, collectionId)
    const decoded = decodeItemCursor(cursor)
    let query = this.db.selectFrom('greenfield_saved_collection_items as item')
      .innerJoin('post_saves as save', 'save.id', 'item.save_id')
      .selectAll('item').select(['save.post_id', 'save.deleted_at as save_deleted_at'])
      .where('item.collection_id', '=', collectionId).where('item.deleted_at', 'is', null)
      .orderBy('item.position', 'asc').orderBy('item.item_id', 'asc').limit(limit + 1)
    if (decoded) {
      query = query.where(eb => eb.or([
        eb('item.position', '>', decoded.position),
        eb.and([eb('item.position', '=', decoded.position), eb('item.item_id', '>', decoded.id)]),
      ]))
    }
    const rows = await query.execute()
    return Promise.all(rows.map(async row => {
      const post = row.save_deleted_at ? null : await this.posts.getById(row.post_id, actorId)
      return itemDto(row, post ? {...post, saved: true} : null)
    }))
  }

  async addItem(
    actorId: string,
    collectionId: string,
    postId: string,
    context: CollectionRequestContext = {},
  ): Promise<{item: SavedCollectionItemDto; created: boolean}> {
    const outcome = await this.db.transaction().execute(async trx => {
      const collection = await trx.selectFrom('greenfield_saved_collections').selectAll()
        .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!collection) throw domainError('Collection not found', 'NOT_FOUND')
      const save = await trx.selectFrom('post_saves').selectAll().where('actor_id', '=', actorId)
        .where('post_id', '=', postId).where('deleted_at', 'is', null).executeTakeFirst()
      if (!save) throw domainError('Only currently saved posts can be added to a collection', 'VALIDATION_FAILED')
      const existing = await trx.selectFrom('greenfield_saved_collection_items').selectAll()
        .where('collection_id', '=', collectionId).where('save_id', '=', save.id).executeTakeFirst()
      if (existing && !existing.deleted_at) return {row: existing, created: false, postId}
      const max = await trx.selectFrom('greenfield_saved_collection_items')
        .select(sql<number>`coalesce(max(position), -1)::int`.as('position'))
        .where('collection_id', '=', collectionId).where('deleted_at', 'is', null).executeTakeFirstOrThrow()
      const now = new Date()
      const row = existing
        ? await trx.updateTable('greenfield_saved_collection_items').set({
            position: Number(max.position) + 1, deleted_at: null, updated_at: now, version: existing.version + 1,
          }).where('item_id', '=', existing.item_id).returningAll().executeTakeFirstOrThrow()
        : await trx.insertInto('greenfield_saved_collection_items').values({
            item_id: randomUUID(), collection_id: collectionId, save_id: save.id,
            position: Number(max.position) + 1, created_at: now, updated_at: now, deleted_at: null, version: 1,
          }).returningAll().executeTakeFirstOrThrow()
      await trx.updateTable('greenfield_saved_collections').set({updated_at: now, version: collection.version + 1})
        .where('collection_id', '=', collectionId).execute()
      await new AuditRepository(trx).append('saved.collection-item.added', {postId},
        {type: 'savedCollection', id: collectionId, actorId}, auditContext(context))
      return {row, created: true, postId}
    })
    const post = await this.posts.getById(postId, actorId)
    return {item: itemDto({...outcome.row, post_id: postId}, post ? {...post, saved: true} : null), created: outcome.created}
  }

  async removeItem(
    actorId: string,
    collectionId: string,
    itemId: string,
    context: CollectionRequestContext = {},
  ): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const collection = await trx.selectFrom('greenfield_saved_collections').selectAll()
        .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!collection) throw domainError('Collection not found', 'NOT_FOUND')
      const now = new Date()
      const removed = await trx.updateTable('greenfield_saved_collection_items')
        .set(eb => ({deleted_at: now, updated_at: now, version: eb('version', '+', 1)}))
        .where('item_id', '=', itemId).where('collection_id', '=', collectionId)
        .where('deleted_at', 'is', null).executeTakeFirst()
      if (removed.numUpdatedRows !== 1n) throw domainError('Collection item not found', 'NOT_FOUND')
      await trx.updateTable('greenfield_saved_collections').set({updated_at: now, version: collection.version + 1})
        .where('collection_id', '=', collectionId).execute()
      await new AuditRepository(trx).append('saved.collection-item.removed', {},
        {type: 'savedCollectionItem', id: itemId, actorId}, auditContext(context))
    })
  }

  private async ownedCollection(actorId: string, collectionId: string) {
    const row = await this.db.selectFrom('greenfield_saved_collections').selectAll()
      .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
      .where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('Collection not found', 'NOT_FOUND')
    return row
  }
}

function collectionDto(row: any, itemCount: number): SavedCollectionDto {
  return {id: row.collection_id, name: row.name, itemCount, version: row.version,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
}

function itemDto(row: any, post: any): SavedCollectionItemDto {
  return {id: row.item_id, collectionId: row.collection_id, postId: row.post_id, position: row.position,
    available: Boolean(post), post, version: row.version,
    addedAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()}
}

function collectionName(value: string): string {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  if (!name || name.length > 120) throw domainError('Collection name must be between 1 and 120 characters', 'VALIDATION_FAILED')
  return name
}

function decodeCollectionCursor(cursor: string | null): {updatedAt: Date; id: string} | null {
  if (!cursor) return null
  const separator = cursor.lastIndexOf('|')
  const updatedAt = new Date(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (separator < 1 || Number.isNaN(updatedAt.valueOf()) || !id) throw domainError('Invalid collection cursor', 'VALIDATION_FAILED')
  return {updatedAt, id}
}

function decodeItemCursor(cursor: string | null): {position: number; id: string} | null {
  if (!cursor) return null
  const separator = cursor.indexOf('|')
  const position = Number(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (separator < 1 || !Number.isSafeInteger(position) || position < 0 || !id) throw domainError('Invalid collection item cursor', 'VALIDATION_FAILED')
  return {position, id}
}

async function assertCollectionConflict(trx: any, actorId: string, collectionId: string): Promise<never> {
  const exists = await trx.selectFrom('greenfield_saved_collections').select('collection_id')
    .where('collection_id', '=', collectionId).where('owner_actor_id', '=', actorId)
    .where('deleted_at', 'is', null).executeTakeFirst()
  throw domainError(exists ? 'Collection version conflict' : 'Collection not found', exists ? 'CONFLICT' : 'NOT_FOUND')
}

function auditContext(context: CollectionRequestContext) {
  return {accountId: context.accountId ?? null, requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? context.requestId ?? null}
}

function domainError(message: string, code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'CONFLICT') {
  return Object.assign(new Error(message), {code})
}
