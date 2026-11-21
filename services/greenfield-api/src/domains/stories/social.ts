import {randomUUID} from 'node:crypto'
import {sql} from 'kysely'

import type {ModulaDb} from '../../database/client.js'
import {OutboxRepository} from '../outbox/repository.js'
import {storyItemLiveCutoff, type StoryService} from './service.js'

/**
 * Story viewer lists, story reactions and story highlights (migration 092).
 * Every method is authenticated by the caller; ownership, visibility and
 * blocks are enforced here.
 */

export const HIGHLIGHTS_MAX_PER_OWNER = 100
export const HIGHLIGHT_ITEMS_MAX = 100
export const HIGHLIGHT_TITLE_MAX = 40
export const STORY_VIEWERS_PAGE_MAX = 100
export const STORY_ARCHIVE_PAGE_MAX = 100

export type StoryPersonDto = {actorId: string; profileId: string; handle: string; displayName: string; avatarUrl: string | null}
export type StoryViewerDto = StoryPersonDto & {viewedAt: string; reaction: string | null}
export type StoryReactionDto = StoryPersonDto & {emoji: string; reactedAt: string}
export type HighlightItemDto = {
  itemId: string
  groupId: string
  mediaKind: 'image' | 'video'
  mediaUrl: string | null
  caption: string | null
  durationMs: number | null
  createdAt: string
}
export type HighlightSummaryDto = {
  highlightId: string
  ownerActorId: string
  title: string
  coverItemId: string | null
  coverMediaUrl: string | null
  coverMediaKind: 'image' | 'video' | null
  itemCount: number
  createdAt: string
  updatedAt: string
  isOwner: boolean
}
export type HighlightDto = HighlightSummaryDto & {items: HighlightItemDto[]}

type Visibility = 'public' | 'followers' | 'close'

function fail(code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT', message: string, reason?: string): never {
  throw Object.assign(new Error(message), {code, ...(reason ? {details: {reason}} : {})})
}

const segmenter = new Intl.Segmenter(undefined, {granularity: 'grapheme'})

/** Exactly one emoji grapheme (including ZWJ sequences, flags and skin tones). */
export function normalizeStoryEmoji(value: unknown): string {
  if (typeof value !== 'string') fail('VALIDATION_FAILED', 'Reaction emoji is required')
  const emoji = value.trim()
  if (!emoji || emoji.length > 16) fail('VALIDATION_FAILED', 'Reaction must be a single emoji')
  const graphemes = [...segmenter.segment(emoji)]
  if (graphemes.length !== 1 || !/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(emoji)) {
    fail('VALIDATION_FAILED', 'Reaction must be a single emoji')
  }
  return emoji
}

function encodeCursor(at: Date, id: string): string {
  return Buffer.from(`${at.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(raw: unknown): {at: Date; id: string} | null {
  if (typeof raw !== 'string' || !raw || raw.length > 200) return null
  const [iso, id] = Buffer.from(raw, 'base64url').toString('utf8').split('|')
  const at = new Date(iso ?? '')
  if (!id || Number.isNaN(at.getTime())) return null
  return {at, id}
}

function clampLimit(raw: unknown, fallback: number, max: number): number {
  const value = typeof raw === 'string' ? Number.parseInt(raw, 10) : typeof raw === 'number' ? raw : Number.NaN
  if (!Number.isFinite(value) || value < 1) return fallback
  return Math.min(Math.floor(value), max)
}

export class StorySocialService {
  constructor(private readonly db: ModulaDb, private readonly stories: StoryService) {}

  // ---- helpers -------------------------------------------------------------

  private async blockedSet(actorId: string): Promise<Set<string>> {
    const rows = await this.db.selectFrom('blocks').select(['blocker_actor_id', 'blocked_actor_id'])
      .where('deleted_at', 'is', null)
      .where(eb => eb.or([eb('blocker_actor_id', '=', actorId), eb('blocked_actor_id', '=', actorId)]))
      .execute()
    return new Set(rows.map(row => row.blocker_actor_id === actorId ? row.blocked_actor_id : row.blocker_actor_id))
  }

  private async people(actorIds: string[]): Promise<Map<string, StoryPersonDto>> {
    const map = new Map<string, StoryPersonDto>()
    if (actorIds.length === 0) return map
    const rows = await this.db.selectFrom('profiles').select(['actor_id', 'id', 'handle', 'display_name', 'avatar_url'])
      .where('actor_id', 'in', [...new Set(actorIds)]).where('deleted_at', 'is', null).execute()
    for (const row of rows) {
      map.set(row.actor_id, {actorId: row.actor_id, profileId: row.id, handle: row.handle, displayName: row.display_name, avatarUrl: row.avatar_url})
    }
    return map
  }

  /** An item the caller owns (any age, not deleted). */
  private async ownedItem(actorId: string, itemId: string) {
    const item = await this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.group_id', 'g.owner_actor_id', 'g.deleted_at as group_deleted_at'])
      .where('i.item_id', '=', itemId).where('i.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!item || item.group_deleted_at) fail('NOT_FOUND', 'Story item not found')
    // Never confirm that someone else's item exists.
    if (item.owner_actor_id !== actorId) fail('NOT_FOUND', 'Story item not found')
    return item
  }

  // ---- viewers ---------------------------------------------------------------

  /** Owner-only list of who viewed an item, newest first. Blocked pairs are omitted. */
  async listViewers(ownerActorId: string, itemId: string, cursorRaw: unknown, limitRaw: unknown) {
    await this.ownedItem(ownerActorId, itemId)
    const limit = clampLimit(limitRaw, 50, STORY_VIEWERS_PAGE_MAX)
    const cursor = decodeCursor(cursorRaw)
    const blocked = [...await this.blockedSet(ownerActorId)]
    let query = this.db.selectFrom('greenfield_story_views as v')
      .innerJoin('profiles as p', 'p.actor_id', 'v.viewer_actor_id')
      .leftJoin('greenfield_story_reactions as r', join => join.onRef('r.item_id', '=', 'v.item_id').onRef('r.actor_id', '=', 'v.viewer_actor_id'))
      .select(['v.view_id', 'v.viewer_actor_id', 'v.viewed_at', 'r.emoji'])
      .where('v.item_id', '=', itemId)
      .where('v.viewer_actor_id', '!=', ownerActorId)
      .where('p.deleted_at', 'is', null)
    if (blocked.length) query = query.where('v.viewer_actor_id', 'not in', blocked)
    let countQuery = this.db.selectFrom('greenfield_story_views as v')
      .innerJoin('profiles as p', 'p.actor_id', 'v.viewer_actor_id')
      .select(eb => eb.fn.countAll<number>().as('count'))
      .where('v.item_id', '=', itemId).where('v.viewer_actor_id', '!=', ownerActorId).where('p.deleted_at', 'is', null)
    if (blocked.length) countQuery = countQuery.where('v.viewer_actor_id', 'not in', blocked)
    if (cursor) {
      query = query.where(eb => eb.or([
        eb('v.viewed_at', '<', cursor.at),
        eb.and([eb('v.viewed_at', '=', cursor.at), eb('v.view_id', '<', cursor.id)]),
      ]))
    }
    const [rows, total] = await Promise.all([
      query.orderBy('v.viewed_at', 'desc').orderBy('v.view_id', 'desc').limit(limit + 1).execute(),
      countQuery.executeTakeFirst(),
    ])
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const people = await this.people(page.map(row => row.viewer_actor_id))
    const items: StoryViewerDto[] = page.flatMap(row => {
      const person = people.get(row.viewer_actor_id)
      return person ? [{...person, viewedAt: row.viewed_at.toISOString(), reaction: row.emoji ?? null}] : []
    })
    const last = page.at(-1)
    return {
      items,
      viewerCount: Number(total?.count ?? 0),
      nextCursor: hasMore && last ? encodeCursor(last.viewed_at, last.view_id) : null,
      hasMore,
    }
  }

  // ---- reactions -------------------------------------------------------------

  /** A live, ready item the reactor can see and does not own. */
  private async reactableItem(actorId: string, itemId: string) {
    const item = await this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.group_id', 'i.status', 'g.owner_actor_id', 'g.visibility', 'g.expires_at', 'g.deleted_at'])
      .where('i.item_id', '=', itemId).where('i.deleted_at', 'is', null)
      .where('i.created_at', '>', storyItemLiveCutoff())
      .executeTakeFirst()
    if (!item || item.deleted_at || item.expires_at <= new Date() || item.status !== 'ready') fail('NOT_FOUND', 'Story item not found')
    if (!(await this.stories.canViewGroup(actorId, item.owner_actor_id, item.visibility))) fail('NOT_FOUND', 'Story item not found')
    if (item.owner_actor_id === actorId) fail('VALIDATION_FAILED', 'You cannot react to your own story', 'own-story')
    return item
  }

  async react(actorId: string, itemId: string, emojiRaw: unknown, requestId: string) {
    const emoji = normalizeStoryEmoji(emojiRaw)
    const item = await this.reactableItem(actorId, itemId)
    const now = new Date()
    const changed = await this.db.transaction().execute(async trx => {
      const previous = await trx.selectFrom('greenfield_story_reactions').select('emoji')
        .where('item_id', '=', itemId).where('actor_id', '=', actorId).forUpdate().executeTakeFirst()
      if (previous?.emoji === emoji) return false
      await trx.insertInto('greenfield_story_reactions')
        .values({item_id: itemId, actor_id: actorId, emoji, created_at: now, updated_at: now})
        .onConflict(oc => oc.columns(['item_id', 'actor_id']).doUpdateSet({emoji, updated_at: now}))
        .execute()
      // A reaction implies the item was seen.
      await trx.insertInto('greenfield_story_views')
        .values({view_id: randomUUID(), item_id: itemId, viewer_actor_id: actorId, viewed_at: now})
        .onConflict(oc => oc.columns(['item_id', 'viewer_actor_id']).doNothing())
        .execute()
      if (!previous) {
        await new OutboxRepository(trx).enqueue(trx, {
          eventType: 'notification.create',
          aggregateType: 'story-item',
          aggregateId: itemId,
          payload: {
            type: 'like',
            actorId,
            recipientActorId: item.owner_actor_id,
            resourceType: 'story',
            resourceId: itemId,
            dedupeKey: `story-reaction:${itemId}:${actorId}`,
            deliveryMode: 'idempotent',
            body: 'reacted to your story',
            requestId,
          },
        })
      }
      return true
    })
    return {itemId, groupId: item.group_id, ownerActorId: item.owner_actor_id, emoji, changed, reactedAt: now.toISOString()}
  }

  async removeReaction(actorId: string, itemId: string) {
    // Removing is allowed even after expiry, but only on items the actor reacted to.
    const item = await this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .innerJoin('greenfield_story_reactions as r', join => join.onRef('r.item_id', '=', 'i.item_id').on('r.actor_id', '=', actorId))
      .select(['i.item_id', 'i.group_id', 'g.owner_actor_id'])
      .where('i.item_id', '=', itemId)
      .executeTakeFirst()
    if (!item) return {itemId, removed: false, groupId: null as string | null, ownerActorId: null as string | null}
    const result = await this.db.deleteFrom('greenfield_story_reactions').where('item_id', '=', itemId).where('actor_id', '=', actorId).executeTakeFirst()
    return {itemId, removed: Number(result.numDeletedRows) > 0, groupId: item.group_id as string | null, ownerActorId: item.owner_actor_id as string | null}
  }

  /** Owner-only reactions for an item, newest first. Blocked pairs are omitted. */
  async listReactions(ownerActorId: string, itemId: string) {
    await this.ownedItem(ownerActorId, itemId)
    const blocked = [...await this.blockedSet(ownerActorId)]
    let query = this.db.selectFrom('greenfield_story_reactions').select(['actor_id', 'emoji', 'updated_at'])
      .where('item_id', '=', itemId)
    if (blocked.length) query = query.where('actor_id', 'not in', blocked)
    const rows = await query.orderBy('updated_at', 'desc').limit(500).execute()
    const people = await this.people(rows.map(row => row.actor_id))
    const items: StoryReactionDto[] = rows.flatMap(row => {
      const person = people.get(row.actor_id)
      return person ? [{...person, emoji: row.emoji, reactedAt: row.updated_at.toISOString()}] : []
    })
    const counts = new Map<string, number>()
    for (const item of items) counts.set(item.emoji, (counts.get(item.emoji) ?? 0) + 1)
    return {items, summary: [...counts.entries()].map(([emoji, count]) => ({emoji, count})).sort((a, b) => b.count - a.count)}
  }

  /** The reactor's own reaction on an item, for viewer UI state. */
  async viewerReactions(actorId: string, itemIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    if (itemIds.length === 0) return map
    const rows = await this.db.selectFrom('greenfield_story_reactions').select(['item_id', 'emoji'])
      .where('actor_id', '=', actorId).where('item_id', 'in', itemIds).execute()
    for (const row of rows) map.set(row.item_id, row.emoji)
    return map
  }

  // ---- archive (source for highlights) -------------------------------------

  /** The owner's own ready items of any age, newest first. */
  async listArchive(ownerActorId: string, cursorRaw: unknown, limitRaw: unknown) {
    const limit = clampLimit(limitRaw, 50, STORY_ARCHIVE_PAGE_MAX)
    const cursor = decodeCursor(cursorRaw)
    let query = this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.group_id', 'i.media_kind', 'i.media_url', 'i.caption', 'i.duration_ms', 'i.created_at', 'g.visibility'])
      .where('g.owner_actor_id', '=', ownerActorId)
      .where('g.deleted_at', 'is', null)
      .where('i.deleted_at', 'is', null)
      .where('i.status', '=', 'ready')
    if (cursor) {
      query = query.where(eb => eb.or([
        eb('i.created_at', '<', cursor.at),
        eb.and([eb('i.created_at', '=', cursor.at), eb('i.item_id', '<', cursor.id)]),
      ]))
    }
    const rows = await query.orderBy('i.created_at', 'desc').orderBy('i.item_id', 'desc').limit(limit + 1).execute()
    const hasMore = rows.length > limit
    const page = rows.slice(0, limit)
    const last = page.at(-1)
    const liveCutoff = storyItemLiveCutoff()
    return {
      items: page.map(row => ({
        itemId: row.item_id,
        groupId: row.group_id,
        mediaKind: row.media_kind,
        mediaUrl: row.media_url,
        caption: row.caption,
        durationMs: row.duration_ms,
        createdAt: row.created_at.toISOString(),
        visibility: row.visibility,
        live: row.created_at > liveCutoff,
      })),
      nextCursor: hasMore && last ? encodeCursor(last.created_at, last.item_id) : null,
      hasMore,
    }
  }

  // ---- highlights ------------------------------------------------------------

  private normalizeTitle(value: unknown, required: boolean): string | undefined {
    if (value === undefined && !required) return undefined
    if (typeof value !== 'string') fail('VALIDATION_FAILED', 'Highlight title is required')
    const title = value.trim().replace(/\s+/g, ' ')
    if (!title || [...title].length > HIGHLIGHT_TITLE_MAX) fail('VALIDATION_FAILED', `Highlight title must be 1-${HIGHLIGHT_TITLE_MAX} characters`)
    return title
  }

  private normalizeItemIds(value: unknown, required: boolean): string[] | undefined {
    if (value === undefined && !required) return undefined
    if (!Array.isArray(value) || value.length === 0) fail('VALIDATION_FAILED', 'Highlight needs at least one story item')
    if (value.length > HIGHLIGHT_ITEMS_MAX) fail('VALIDATION_FAILED', `Highlight holds at most ${HIGHLIGHT_ITEMS_MAX} items`)
    const ids: string[] = []
    for (const id of value) {
      if (typeof id !== 'string' || id.length < 1 || id.length > 64) fail('VALIDATION_FAILED', 'Invalid story item id')
      if (!ids.includes(id)) ids.push(id)
    }
    return ids
  }

  /** Every id must be the owner's own non-deleted ready item. */
  private async assertOwnItems(ownerActorId: string, itemIds: string[]) {
    const rows = await this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select('i.item_id')
      .where('i.item_id', 'in', itemIds)
      .where('g.owner_actor_id', '=', ownerActorId)
      .where('g.deleted_at', 'is', null)
      .where('i.deleted_at', 'is', null)
      .where('i.status', '=', 'ready')
      .execute()
    if (rows.length !== itemIds.length) fail('VALIDATION_FAILED', 'Highlights can only contain your own stories', 'not-own-item')
  }

  private validCover(value: unknown, itemIds: string[]): string | null | undefined {
    if (value === undefined) return undefined
    if (value === null) return null
    if (typeof value !== 'string' || !itemIds.includes(value)) fail('VALIDATION_FAILED', 'Cover must be one of the highlight items')
    return value
  }

  async createHighlight(ownerActorId: string, input: {title?: unknown; itemIds?: unknown; coverItemId?: unknown}) {
    const title = this.normalizeTitle(input.title, true)!
    const itemIds = this.normalizeItemIds(input.itemIds, true)!
    const cover = this.validCover(input.coverItemId, itemIds) ?? null
    await this.assertOwnItems(ownerActorId, itemIds)
    const highlightId = randomUUID()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      // Serialize per owner so the cap cannot be raced.
      await sql`SELECT pg_advisory_xact_lock(hashtext(${`story-highlights:${ownerActorId}`}))`.execute(trx)
      const existing = await trx.selectFrom('greenfield_story_highlights').select(eb => eb.fn.countAll<number>().as('count'))
        .where('owner_actor_id', '=', ownerActorId).where('deleted_at', 'is', null).executeTakeFirst()
      const count = Number(existing?.count ?? 0)
      if (count >= HIGHLIGHTS_MAX_PER_OWNER) fail('CONFLICT', 'Highlight limit reached', 'highlight-limit')
      await trx.insertInto('greenfield_story_highlights').values({
        highlight_id: highlightId, owner_actor_id: ownerActorId, title, cover_item_id: cover,
        sort_order: count, created_at: now, updated_at: now, deleted_at: null,
      }).execute()
      await trx.insertInto('greenfield_story_highlight_items')
        .values(itemIds.map((itemId, index) => ({highlight_id: highlightId, item_id: itemId, sort_order: index, added_at: now})))
        .execute()
    })
    return (await this.getHighlight(ownerActorId, highlightId))!
  }

  async updateHighlight(ownerActorId: string, highlightId: string, input: {title?: unknown; itemIds?: unknown; coverItemId?: unknown}) {
    const highlight = await this.db.selectFrom('greenfield_story_highlights').selectAll()
      .where('highlight_id', '=', highlightId).where('deleted_at', 'is', null).executeTakeFirst()
    if (!highlight || highlight.owner_actor_id !== ownerActorId) fail('NOT_FOUND', 'Highlight not found')
    const title = this.normalizeTitle(input.title, false)
    const itemIds = this.normalizeItemIds(input.itemIds, false)
    if (title === undefined && itemIds === undefined && input.coverItemId === undefined) fail('VALIDATION_FAILED', 'Nothing to update')
    if (itemIds) await this.assertOwnItems(ownerActorId, itemIds)
    const currentIds = itemIds ?? (await this.db.selectFrom('greenfield_story_highlight_items').select('item_id')
      .where('highlight_id', '=', highlightId).execute()).map(row => row.item_id)
    let cover = this.validCover(input.coverItemId, currentIds)
    // Dropping the cover item from the list resets the cover.
    if (cover === undefined && itemIds && highlight.cover_item_id && !itemIds.includes(highlight.cover_item_id)) cover = null
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx.updateTable('greenfield_story_highlights')
        .set({
          ...(title !== undefined ? {title} : {}),
          ...(cover !== undefined ? {cover_item_id: cover} : {}),
          updated_at: now,
        })
        .where('highlight_id', '=', highlightId).execute()
      if (itemIds) {
        await trx.deleteFrom('greenfield_story_highlight_items').where('highlight_id', '=', highlightId).execute()
        await trx.insertInto('greenfield_story_highlight_items')
          .values(itemIds.map((itemId, index) => ({highlight_id: highlightId, item_id: itemId, sort_order: index, added_at: now})))
          .execute()
      }
    })
    return (await this.getHighlight(ownerActorId, highlightId))!
  }

  async deleteHighlight(ownerActorId: string, highlightId: string) {
    const now = new Date()
    const result = await this.db.updateTable('greenfield_story_highlights').set({deleted_at: now, updated_at: now})
      .where('highlight_id', '=', highlightId).where('owner_actor_id', '=', ownerActorId).where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (Number(result.numUpdatedRows) === 0) fail('NOT_FOUND', 'Highlight not found')
    return {deleted: true}
  }

  /**
   * Items of a set of highlights the viewer may see: not deleted, ready, in a
   * live group row, and visible under the original group's visibility.
   */
  private async visibleItems(viewerActorId: string | null, ownerActorId: string, highlightIds: string[]) {
    const byHighlight = new Map<string, HighlightItemDto[]>()
    if (highlightIds.length === 0) return byHighlight
    const rows = await this.db.selectFrom('greenfield_story_highlight_items as h')
      .innerJoin('greenfield_story_items as i', 'i.item_id', 'h.item_id')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['h.highlight_id', 'h.sort_order', 'i.item_id', 'i.group_id', 'i.media_kind', 'i.media_url', 'i.caption', 'i.duration_ms', 'i.created_at', 'g.visibility'])
      .where('h.highlight_id', 'in', highlightIds)
      .where('g.owner_actor_id', '=', ownerActorId)
      .where('g.deleted_at', 'is', null)
      .where('i.deleted_at', 'is', null)
      .where('i.status', '=', 'ready')
      .orderBy('h.highlight_id').orderBy('h.sort_order', 'asc')
      .execute()
    const allowed = new Map<Visibility, boolean>()
    for (const visibility of new Set(rows.map(row => row.visibility))) {
      allowed.set(visibility, await this.stories.canViewGroup(viewerActorId, ownerActorId, visibility))
    }
    for (const row of rows) {
      if (!allowed.get(row.visibility)) continue
      const list = byHighlight.get(row.highlight_id) ?? []
      list.push({
        itemId: row.item_id, groupId: row.group_id, mediaKind: row.media_kind, mediaUrl: row.media_url,
        caption: row.caption, durationMs: row.duration_ms, createdAt: row.created_at.toISOString(),
      })
      byHighlight.set(row.highlight_id, list)
    }
    return byHighlight
  }

  private summarize(row: {highlight_id: string; owner_actor_id: string; title: string; cover_item_id: string | null; created_at: Date; updated_at: Date}, items: HighlightItemDto[], viewerActorId: string | null): HighlightSummaryDto {
    const cover = items.find(item => item.itemId === row.cover_item_id) ?? items[0] ?? null
    return {
      highlightId: row.highlight_id,
      ownerActorId: row.owner_actor_id,
      title: row.title,
      coverItemId: cover?.itemId ?? null,
      coverMediaUrl: cover?.mediaUrl ?? null,
      coverMediaKind: cover?.mediaKind ?? null,
      itemCount: items.length,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      isOwner: viewerActorId === row.owner_actor_id,
    }
  }

  /** Viewer-filtered highlight. Hidden (404) across blocks or when no item is visible. */
  async getHighlight(viewerActorId: string | null, highlightId: string): Promise<HighlightDto | null> {
    const row = await this.db.selectFrom('greenfield_story_highlights as h')
      .innerJoin('profiles as p', 'p.actor_id', 'h.owner_actor_id')
      .select(['h.highlight_id', 'h.owner_actor_id', 'h.title', 'h.cover_item_id', 'h.created_at', 'h.updated_at'])
      .where('h.highlight_id', '=', highlightId).where('h.deleted_at', 'is', null).where('p.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) return null
    const isOwner = viewerActorId === row.owner_actor_id
    if (!isOwner && viewerActorId && (await this.blockedSet(viewerActorId)).has(row.owner_actor_id)) return null
    const items = (await this.visibleItems(viewerActorId, row.owner_actor_id, [row.highlight_id])).get(row.highlight_id) ?? []
    if (items.length === 0 && !isOwner) return null
    return {...this.summarize(row, items, viewerActorId), items}
  }

  /** Highlights on a profile, filtered for the viewer. */
  async listForProfile(viewerActorId: string | null, handle: string): Promise<{items: HighlightSummaryDto[]} | null> {
    const profile = await this.db.selectFrom('profiles').select(['actor_id'])
      .where(sql`lower(handle)`, '=', handle.toLowerCase()).where('deleted_at', 'is', null).executeTakeFirst()
    if (!profile) return null
    const ownerActorId = profile.actor_id
    const isOwner = viewerActorId === ownerActorId
    if (!isOwner && viewerActorId && (await this.blockedSet(viewerActorId)).has(ownerActorId)) return null
    const rows = await this.db.selectFrom('greenfield_story_highlights')
      .select(['highlight_id', 'owner_actor_id', 'title', 'cover_item_id', 'created_at', 'updated_at'])
      .where('owner_actor_id', '=', ownerActorId).where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc').orderBy('created_at', 'asc')
      .limit(HIGHLIGHTS_MAX_PER_OWNER)
      .execute()
    const items = await this.visibleItems(viewerActorId, ownerActorId, rows.map(row => row.highlight_id))
    return {
      items: rows
        .map(row => this.summarize(row, items.get(row.highlight_id) ?? [], viewerActorId))
        .filter(summary => summary.itemCount > 0 || isOwner),
    }
  }

  /**
   * Media authorization for items kept beyond 24h by an active highlight.
   * Used by the story media and attachment routes after the live check fails.
   */
  async canViewHighlightedMedia(viewerActorId: string | null, where: {mediaFileName?: string; attachmentId?: string}): Promise<boolean> {
    let query = this.db.selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .innerJoin('greenfield_story_highlight_items as hi', 'hi.item_id', 'i.item_id')
      .innerJoin('greenfield_story_highlights as h', 'h.highlight_id', 'hi.highlight_id')
      .select(['g.owner_actor_id', 'g.visibility'])
      .where('i.deleted_at', 'is', null)
      .where('i.status', '=', 'ready')
      .where('g.deleted_at', 'is', null)
      .where('h.deleted_at', 'is', null)
      .whereRef('h.owner_actor_id', '=', 'g.owner_actor_id')
    if (where.mediaFileName) query = query.where('i.media_file_name', '=', where.mediaFileName)
    else if (where.attachmentId) query = query.where('i.attachment_id', '=', where.attachmentId)
    else return false
    const row = await query.limit(1).executeTakeFirst()
    if (!row) return false
    return this.stories.canViewGroup(viewerActorId, row.owner_actor_id, row.visibility)
  }
}
