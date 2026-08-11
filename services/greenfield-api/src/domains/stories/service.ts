import {randomUUID} from 'node:crypto'
import {mkdir, writeFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'

const STORY_TTL_MS = 24 * 60 * 60 * 1000
const IMAGE_DURATION_MS = 5_000

export type StoryRingState =
  | 'unviewed'
  | 'partial'
  | 'viewed'
  | 'owner'
  | 'uploading'
  | 'failed'

export type StoryRailEntry = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  ringState: StoryRingState
  itemCount: number
  unviewedCount: number
  expiresAt: string
  isOwner: boolean
}

export type StoryItemDto = {
  itemId: string
  groupId: string
  mediaKind: 'image' | 'video'
  mediaUrl: string | null
  caption: string | null
  status: 'uploading' | 'ready' | 'failed'
  durationMs: number | null
  viewed: boolean
  createdAt: string
}

export type StoryGroupDto = {
  groupId: string
  ownerActorId: string
  ownerProfileId: string
  displayName: string
  handle: string
  avatarUrl: string | null
  visibility: 'public' | 'followers' | 'close'
  expiresAt: string
  items: StoryItemDto[]
  isOwner: boolean
}

type CreateStoryInput = {
  mediaKind: 'image' | 'video'
  base64: string
  contentType: string
  caption?: string | null
  visibility?: 'public' | 'followers' | 'close'
  width?: number
  height?: number
  durationMs?: number
}

const SUPPORTED = {
  'image/jpeg': {extension: 'jpg', kind: 'image' as const},
  'image/jpg': {extension: 'jpg', kind: 'image' as const},
  'image/png': {extension: 'png', kind: 'image' as const},
  'image/webp': {extension: 'webp', kind: 'image' as const},
  'video/mp4': {extension: 'mp4', kind: 'video' as const},
} as const

export class StoryService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: AppConfig,
  ) {}

  async listRail(viewerActorId: string | null): Promise<StoryRailEntry[]> {
    const now = new Date()
    const groups = await this.db
      .selectFrom('greenfield_story_groups as g')
      .innerJoin('actors as a', 'a.id', 'g.owner_actor_id')
      .innerJoin('profiles as p', 'p.actor_id', 'g.owner_actor_id')
      .select([
        'g.group_id',
        'g.owner_actor_id',
        'g.visibility',
        'g.expires_at',
        'p.id as profile_id',
        'p.display_name',
        'p.handle',
        'p.avatar_url',
      ])
      .where('g.deleted_at', 'is', null)
      .where('g.expires_at', '>', now)
      .orderBy('g.updated_at', 'desc')
      .execute()

    const entries: StoryRailEntry[] = []
    for (const group of groups) {
      if (!(await this.canViewGroup(viewerActorId, group.owner_actor_id, group.visibility))) {
        continue
      }
      const items = await this.db
        .selectFrom('greenfield_story_items')
        .select(['item_id', 'status'])
        .where('group_id', '=', group.group_id)
        .where('deleted_at', 'is', null)
        .execute()
      if (items.length === 0) continue

      const readyOrPending = items.filter(item => item.status !== 'failed' || group.owner_actor_id === viewerActorId)
      if (readyOrPending.length === 0) continue

      let viewedCount = 0
      if (viewerActorId) {
        const views = await this.db
          .selectFrom('greenfield_story_views')
          .select('item_id')
          .where('viewer_actor_id', '=', viewerActorId)
          .where(
            'item_id',
            'in',
            items.map(item => item.item_id),
          )
          .execute()
        viewedCount = views.length
      }

      const isOwner = viewerActorId === group.owner_actor_id
      const hasUploading = items.some(item => item.status === 'uploading')
      const hasFailed = items.some(item => item.status === 'failed')
      const readyCount = items.filter(item => item.status === 'ready').length
      let ringState: StoryRingState = 'unviewed'
      if (isOwner) ringState = hasFailed ? 'failed' : hasUploading ? 'uploading' : 'owner'
      else if (viewedCount === 0) ringState = 'unviewed'
      else if (viewedCount < readyCount) ringState = 'partial'
      else ringState = 'viewed'

      entries.push({
        groupId: group.group_id,
        ownerActorId: group.owner_actor_id,
        ownerProfileId: group.profile_id,
        displayName: group.display_name,
        handle: group.handle,
        avatarUrl: group.avatar_url,
        ringState,
        itemCount: items.length,
        unviewedCount: Math.max(0, readyCount - viewedCount),
        expiresAt: group.expires_at.toISOString(),
        isOwner,
      })
    }

    // Owner Add Story always first when authenticated.
    if (viewerActorId) {
      const owner = await this.db
        .selectFrom('profiles')
        .select(['id', 'display_name', 'handle', 'avatar_url'])
        .where('actor_id', '=', viewerActorId)
        .executeTakeFirst()
      if (owner) {
        const existingOwner = entries.find(entry => entry.ownerActorId === viewerActorId)
        if (existingOwner) {
          entries.splice(entries.indexOf(existingOwner), 1)
          entries.unshift(existingOwner)
        } else {
          entries.unshift({
            groupId: `add:${viewerActorId}`,
            ownerActorId: viewerActorId,
            ownerProfileId: owner.id,
            displayName: owner.display_name,
            handle: owner.handle,
            avatarUrl: owner.avatar_url,
            ringState: 'owner',
            itemCount: 0,
            unviewedCount: 0,
            expiresAt: new Date(Date.now() + STORY_TTL_MS).toISOString(),
            isOwner: true,
          })
        }
      }
    }

    return entries
  }

  async getGroup(groupId: string, viewerActorId: string | null): Promise<StoryGroupDto | null> {
    const group = await this.db
      .selectFrom('greenfield_story_groups as g')
      .innerJoin('profiles as p', 'p.actor_id', 'g.owner_actor_id')
      .select([
        'g.group_id',
        'g.owner_actor_id',
        'g.visibility',
        'g.expires_at',
        'g.deleted_at',
        'p.id as profile_id',
        'p.display_name',
        'p.handle',
        'p.avatar_url',
      ])
      .where('g.group_id', '=', groupId)
      .executeTakeFirst()
    if (!group || group.deleted_at || group.expires_at <= new Date()) return null
    if (!(await this.canViewGroup(viewerActorId, group.owner_actor_id, group.visibility))) {
      return null
    }

    const items = await this.db
      .selectFrom('greenfield_story_items')
      .selectAll()
      .where('group_id', '=', groupId)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order', 'asc')
      .execute()

    const viewedIds = new Set<string>()
    if (viewerActorId) {
      const views = await this.db
        .selectFrom('greenfield_story_views')
        .select('item_id')
        .where('viewer_actor_id', '=', viewerActorId)
        .where(
          'item_id',
          'in',
          items.map(item => item.item_id),
        )
        .execute()
      for (const view of views) viewedIds.add(view.item_id)
    }

    return {
      groupId: group.group_id,
      ownerActorId: group.owner_actor_id,
      ownerProfileId: group.profile_id,
      displayName: group.display_name,
      handle: group.handle,
      avatarUrl: group.avatar_url,
      visibility: group.visibility,
      expiresAt: group.expires_at.toISOString(),
      isOwner: viewerActorId === group.owner_actor_id,
      items: items
        .filter(item => item.status === 'ready' || viewerActorId === group.owner_actor_id)
        .map(item => ({
          itemId: item.item_id,
          groupId: item.group_id,
          mediaKind: item.media_kind,
          mediaUrl: item.media_url,
          caption: item.caption,
          status: item.status,
          durationMs: item.duration_ms,
          viewed: viewedIds.has(item.item_id),
          createdAt: item.created_at.toISOString(),
        })),
    }
  }

  async create(actorId: string, input: CreateStoryInput): Promise<StoryGroupDto> {
    const definition = SUPPORTED[input.contentType as keyof typeof SUPPORTED]
    if (!definition || definition.kind !== input.mediaKind) {
      throw Object.assign(new Error('Unsupported story media type'), {code: 'VALIDATION_FAILED'})
    }
    if (!input.base64 || input.base64.length < 32) {
      throw Object.assign(new Error('Story media payload is required'), {code: 'VALIDATION_FAILED'})
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + STORY_TTL_MS)
    const visibility = input.visibility ?? 'followers'

    let group = await this.db
      .selectFrom('greenfield_story_groups')
      .selectAll()
      .where('owner_actor_id', '=', actorId)
      .where('deleted_at', 'is', null)
      .where('expires_at', '>', now)
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    if (!group) {
      const groupId = randomUUID()
      await this.db
        .insertInto('greenfield_story_groups')
        .values({
          group_id: groupId,
          owner_actor_id: actorId,
          visibility,
          expires_at: expiresAt,
          created_at: now,
          updated_at: now,
          deleted_at: null,
        })
        .execute()
      group = await this.db
        .selectFrom('greenfield_story_groups')
        .selectAll()
        .where('group_id', '=', groupId)
        .executeTakeFirstOrThrow()
    } else {
      await this.db
        .updateTable('greenfield_story_groups')
        .set({updated_at: now, visibility, expires_at: expiresAt})
        .where('group_id', '=', group.group_id)
        .execute()
    }

    const itemId = randomUUID()
    const fileName = `${itemId}.${definition.extension}`
    const directory = join(this.config.mediaRoot, 'stories')
    await mkdir(directory, {recursive: true})
    await writeFile(join(directory, fileName), Buffer.from(input.base64, 'base64'), {flag: 'wx'})
    const mediaUrl = `${this.config.publicApiUrl.replace(/\/+$/, '')}/v1/media/stories/${fileName}`

    const maxOrder = await this.db
      .selectFrom('greenfield_story_items')
      .select(eb => eb.fn.max('sort_order').as('max'))
      .where('group_id', '=', group.group_id)
      .executeTakeFirst()

    await this.db
      .insertInto('greenfield_story_items')
      .values({
        item_id: itemId,
        group_id: group.group_id,
        media_kind: input.mediaKind,
        media_url: mediaUrl,
        media_file_name: fileName,
        caption: input.caption?.trim() ? input.caption.trim().slice(0, 500) : null,
        status: 'ready',
        sort_order: (maxOrder?.max ?? -1) + 1,
        duration_ms:
          input.mediaKind === 'video'
            ? input.durationMs ?? 15_000
            : IMAGE_DURATION_MS,
        created_at: now,
        deleted_at: null,
      })
      .execute()

    const dto = await this.getGroup(group.group_id, actorId)
    if (!dto) {
      throw Object.assign(new Error('Story group missing after create'), {code: 'SERVER_ERROR'})
    }
    return dto
  }

  async markViewed(itemId: string, viewerActorId: string): Promise<void> {
    const item = await this.db
      .selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.status', 'g.owner_actor_id', 'g.visibility', 'g.expires_at', 'g.deleted_at'])
      .where('i.item_id', '=', itemId)
      .where('i.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!item || item.deleted_at || item.expires_at <= new Date() || item.status !== 'ready') {
      throw Object.assign(new Error('Story item not found'), {code: 'NOT_FOUND'})
    }
    if (!(await this.canViewGroup(viewerActorId, item.owner_actor_id, item.visibility))) {
      throw Object.assign(new Error('Story not visible'), {code: 'FORBIDDEN'})
    }
    await this.db
      .insertInto('greenfield_story_views')
      .values({
        view_id: randomUUID(),
        item_id: itemId,
        viewer_actor_id: viewerActorId,
        viewed_at: new Date(),
      })
      .onConflict(oc => oc.columns(['item_id', 'viewer_actor_id']).doNothing())
      .execute()
  }

  async deleteItem(itemId: string, actorId: string): Promise<void> {
    const item = await this.db
      .selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.item_id', 'i.group_id', 'g.owner_actor_id'])
      .where('i.item_id', '=', itemId)
      .where('i.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!item) {
      throw Object.assign(new Error('Story item not found'), {code: 'NOT_FOUND'})
    }
    if (item.owner_actor_id !== actorId) {
      throw Object.assign(new Error('Only the owner can delete a story'), {code: 'FORBIDDEN'})
    }
    const now = new Date()
    await this.db
      .updateTable('greenfield_story_items')
      .set({deleted_at: now})
      .where('item_id', '=', itemId)
      .execute()

    const remaining = await this.db
      .selectFrom('greenfield_story_items')
      .select('item_id')
      .where('group_id', '=', item.group_id)
      .where('deleted_at', 'is', null)
      .execute()
    if (remaining.length === 0) {
      await this.db
        .updateTable('greenfield_story_groups')
        .set({deleted_at: now, updated_at: now})
        .where('group_id', '=', item.group_id)
        .execute()
    }
  }

  private async canViewGroup(
    viewerActorId: string | null,
    ownerActorId: string,
    visibility: 'public' | 'followers' | 'close',
  ): Promise<boolean> {
    if (viewerActorId === ownerActorId) return true
    if (viewerActorId && (await this.isBlockedEitherDirection(viewerActorId, ownerActorId))) return false
    if (visibility === 'public') return true
    if (!viewerActorId) return false
    if (visibility === 'close' || visibility === 'followers') {
      const follow = await this.db
        .selectFrom('follows')
        .select('id')
        .where('follower_actor_id', '=', viewerActorId)
        .where('followed_actor_id', '=', ownerActorId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      return Boolean(follow)
    }
    return false
  }

  private async isBlockedEitherDirection(actorA: string, actorB: string): Promise<boolean> {
    const row = await this.db
      .selectFrom('blocks')
      .select('id')
      .where('deleted_at', 'is', null)
      .where(({eb, or, and}) =>
        or([
          and([eb('blocker_actor_id', '=', actorA), eb('blocked_actor_id', '=', actorB)]),
          and([eb('blocker_actor_id', '=', actorB), eb('blocked_actor_id', '=', actorA)]),
        ]),
      )
      .executeTakeFirst()
    return Boolean(row)
  }
}
