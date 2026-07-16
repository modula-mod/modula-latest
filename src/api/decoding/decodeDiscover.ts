import type {DiscoverResult, ReelItem} from '@/domain/discovery'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {asArray, asNumber, asRecord, asString} from '@/api/decoding/validation'

function decodeReel(value: unknown): ReelItem {
  const reel = asRecord(value, 'reel')
  return {
    id: asString(reel.id, 'reel id'),
    author: decodeProfile(reel.author),
    caption: asString(reel.caption, 'reel caption'),
    source: asString(reel.source, 'reel source'),
    colour: asString(reel.colour, 'reel colour'),
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
