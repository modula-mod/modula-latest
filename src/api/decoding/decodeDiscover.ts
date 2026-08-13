import type {DiscoverResult, ReelItem} from '@/domain/discovery'
import type {
  DiscoverSearchResult,
  UniversalRecentSearch,
  UniversalSavedSearch,
  UniversalSearchPage,
} from '@/data/repositories/contracts/DiscoverRepository'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {decodePost} from '@/api/decoding/decodePost'
import {
  asArray,
  asBoolean,
  asIsoDate,
  asNumber,
  asOptionalString,
  asRecord,
  asString,
  optional,
} from '@/api/decoding/validation'
import type {GreenfieldSearchResult} from '@modula/api-contracts'

function decodeReel(value: unknown): ReelItem {
  const reel = asRecord(value, 'reel')
  return {
    id: asString(reel.id, 'reel id'),
    author: decodeProfile(reel.author),
    caption: asString(reel.caption, 'reel caption'),
    source: asString(reel.source, 'reel source'),
    colour: asString(reel.colour, 'reel colour'),
    videoUri: asOptionalString(reel.videoUri, 'reel videoUri'),
    liked: Boolean(reel.liked),
    likeCount: asNumber(reel.likeCount, 'reel like count'),
    replyCount: asNumber(reel.replyCount, 'reel reply count'),
  }
}

export function decodeDiscoverResult(value: unknown): DiscoverResult {
  const result = asRecord(value, 'discover result')
  return {
    suggestedProfiles: asArray(result.suggestedProfiles, 'suggested profiles', decodeProfile),
    trendingTopics: asArray(result.trendingTopics, 'trending topics', item => {
      const topic = asRecord(item, 'trending topic')
      return {
        id: asString(topic.id, 'topic id'),
        label: asString(topic.label, 'topic label'),
        postCount: asNumber(topic.postCount, 'topic post count'),
      }
    }),
    featuredModules: asArray(result.featuredModules, 'featured modules', item => asRecord(item, 'module preview') as DiscoverResult['featuredModules'][number]),
    media: asArray(result.media, 'discover media', item => asRecord(item, 'media asset') as DiscoverResult['media'][number]),
    reels: asArray(result.reels, 'discover reels', decodeReel),
  }
}

export function decodeReels(value: unknown): ReelItem[] {
  return asArray(value, 'reels', decodeReel)
}

export function decodeSearchResult(value: unknown): DiscoverSearchResult {
  const result = asRecord(value, 'search result')
  return {
    query: asOptionalString(result.query, 'search query'),
    profiles: asArray(result.profiles, 'search profiles', decodeProfile),
    posts: asArray(result.posts, 'search posts', decodePost),
    modules: asArray(result.modules, 'search modules', item => {
      const module = asRecord(item, 'search module')
      return {
        id: asString(module.id, 'search module id'),
        name: asString(module.name, 'search module name'),
        description: asOptionalString(module.description, 'search module description'),
      }
    }),
    nextCursor: result.nextCursor === null ? null : asString(result.nextCursor, 'search next cursor'),
    hasMore: asBoolean(result.hasMore, 'search has more'),
  }
}

export function decodeUniversalSearchPage(value: unknown): UniversalSearchPage {
  const result = asRecord(value, 'universal search result')
  return {
    results: asArray(result.results, 'universal search results', decodeUniversalSearchResult),
    nextCursor:
      result.nextCursor === undefined || result.nextCursor === null
        ? null
        : asString(result.nextCursor, 'universal search next cursor'),
    requestId: asString(result.requestId, 'universal search request id'),
    tookMs: asNumber(result.tookMs, 'universal search duration'),
  }
}

export function decodeRecentSearches(value: unknown): UniversalRecentSearch[] {
  const result = asRecord(value, 'recent searches')
  return asArray(result.items, 'recent search items', item => {
    const row = asRecord(item, 'recent search')
    return {
      recentSearchId: asString(row.recentSearchId, 'recent search id'),
      accountId: asString(row.accountId, 'recent search account id'),
      query: asString(row.query, 'recent search query'),
      filters: decodeFilterRecord(row.filters),
      searchedAt: asIsoDate(row.searchedAt, 'recent search searchedAt'),
    }
  })
}

export function decodeSavedSearches(value: unknown): UniversalSavedSearch[] {
  const result = asRecord(value, 'saved searches')
  return asArray(result.items, 'saved search items', decodeSavedSearch)
}

export function decodeSavedSearch(value: unknown): UniversalSavedSearch {
  const row = asRecord(value, 'saved search')
  return {
    savedSearchId: asString(row.savedSearchId, 'saved search id'),
    accountId: asString(row.accountId, 'saved search account id'),
    name: asString(row.name, 'saved search name'),
    query: asString(row.query, 'saved search query'),
    filters: decodeFilterRecord(row.filters),
    createdAt: asIsoDate(row.createdAt, 'saved search createdAt'),
    updatedAt: asIsoDate(row.updatedAt, 'saved search updatedAt'),
  }
}

function decodeUniversalSearchResult(value: unknown): GreenfieldSearchResult {
  const row = asRecord(value, 'universal search item')
  return {
    entityType: asString(row.entityType, 'search item entityType'),
    entityId: asString(row.entityId, 'search item entityId'),
    title: optional(row.title, item => asString(item, 'search item title')),
    excerpt: optional(row.excerpt, item => asString(item, 'search item excerpt')),
    score: optional(row.score, item => asNumber(item, 'search item score')),
    matchedFields: asArray(row.matchedFields, 'search item matched fields', item =>
      asString(item, 'search item matched field'),
    ),
    ownerId: optional(row.ownerId, item => asString(item, 'search item ownerId')),
    createdAt: asIsoDate(row.createdAt, 'search item createdAt'),
    updatedAt: asIsoDate(row.updatedAt, 'search item updatedAt'),
    metadata: decodeFilterRecord(row.metadata),
  }
}

function decodeFilterRecord(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {}
  return asRecord(value, 'search filters')
}
