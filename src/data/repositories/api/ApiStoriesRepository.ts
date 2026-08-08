import type {ApiClient} from '@/api/client'
import type {StoriesRepository} from '@/data/repositories/contracts/StoriesRepository'
import type {CreateStoryInput, StoryGroup, StoryItem, StoryRailEntry, StoryRingState} from '@/domain/stories'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function decodeRingState(value: unknown): StoryRingState {
  switch (value) {
    case 'unviewed':
    case 'partial':
    case 'viewed':
    case 'owner':
    case 'uploading':
    case 'failed':
      return value
    default:
      return 'unviewed'
  }
}

function decodeRailEntry(value: unknown): StoryRailEntry {
  const row = asRecord(value)
  return {
    groupId: String(row.groupId ?? ''),
    ownerActorId: String(row.ownerActorId ?? ''),
    ownerProfileId: String(row.ownerProfileId ?? ''),
    displayName: String(row.displayName ?? ''),
    handle: String(row.handle ?? ''),
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
    ringState: decodeRingState(row.ringState),
    itemCount: Number(row.itemCount ?? 0),
    unviewedCount: Number(row.unviewedCount ?? 0),
    expiresAt: String(row.expiresAt ?? ''),
    isOwner: Boolean(row.isOwner),
  }
}

function decodeItem(value: unknown): StoryItem {
  const row = asRecord(value)
  return {
    itemId: String(row.itemId ?? ''),
    groupId: String(row.groupId ?? ''),
    mediaKind: row.mediaKind === 'video' ? 'video' : 'image',
    mediaUrl: typeof row.mediaUrl === 'string' ? row.mediaUrl : null,
    caption: typeof row.caption === 'string' ? row.caption : null,
    status:
      row.status === 'uploading' || row.status === 'failed' ? row.status : 'ready',
    durationMs: typeof row.durationMs === 'number' ? row.durationMs : null,
    viewed: Boolean(row.viewed),
    createdAt: String(row.createdAt ?? ''),
  }
}

function decodeGroup(value: unknown): StoryGroup {
  const row = asRecord(value)
  const items = Array.isArray(row.items) ? row.items.map(decodeItem) : []
  return {
    groupId: String(row.groupId ?? ''),
    ownerActorId: String(row.ownerActorId ?? ''),
    ownerProfileId: String(row.ownerProfileId ?? ''),
    displayName: String(row.displayName ?? ''),
    handle: String(row.handle ?? ''),
    avatarUrl: typeof row.avatarUrl === 'string' ? row.avatarUrl : null,
    visibility:
      row.visibility === 'public' || row.visibility === 'close'
        ? row.visibility
        : 'followers',
    expiresAt: String(row.expiresAt ?? ''),
    items,
    isOwner: Boolean(row.isOwner),
  }
}

export class ApiStoriesRepository implements StoriesRepository {
  constructor(private readonly client: ApiClient) {}

  getRail(): Promise<StoryRailEntry[]> {
    return this.client.get({path: '/v1/stories/rail', authenticated: true}, value => {
      const row = asRecord(value)
      const items = Array.isArray(row.items) ? row.items : []
      return items.map(decodeRailEntry)
    })
  }

  getGroup(groupId: string): Promise<StoryGroup> {
    return this.client.get(
      {path: `/v1/stories/${encodeURIComponent(groupId)}`, authenticated: true},
      decodeGroup,
    )
  }

  create(input: CreateStoryInput): Promise<StoryGroup> {
    return this.client.post(
      {
        path: '/v1/stories',
        body: input,
        authenticated: true,
      },
      decodeGroup,
    )
  }

  markViewed(itemId: string): Promise<void> {
    return this.client.post(
      {
        path: `/v1/stories/items/${encodeURIComponent(itemId)}/viewed`,
        body: {},
        authenticated: true,
      },
      () => undefined,
    )
  }

  deleteItem(itemId: string): Promise<void> {
    return this.client.delete(
      {
        path: `/v1/stories/items/${encodeURIComponent(itemId)}`,
        authenticated: true,
      },
      () => undefined,
    )
  }
}
