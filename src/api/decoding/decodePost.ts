import type {ReactionType, SocialPost} from '@/domain/social'
import {decodeProfile} from '@/api/decoding/decodeProfile'
import {asArray, asBoolean, asIsoDate, asNumber, asRecord, asString, optional} from '@/api/decoding/validation'

export function decodePost(value: unknown): SocialPost {
  const record = asRecord(value, 'post')
  const base = {
    id: asString(record.id, 'post id') as SocialPost['id'],
    author: decodeProfile(record.author),
    createdAt: asIsoDate(record.createdAt, 'post createdAt'),
    feed: asString(record.feed, 'post feed') as SocialPost['feed'],
    text: optional(record.text, item => asString(item, 'post text')),
    liked: asBoolean(record.liked, 'post liked'),
    saved: asBoolean(record.saved, 'post saved'),
    reposted: asBoolean(record.reposted, 'post reposted'),
    likeCount: asNumber(record.likeCount, 'post like count'),
    replyCount: asNumber(record.replyCount, 'post reply count'),
    repostCount: asNumber(record.repostCount, 'post repost count'),
    viewerReaction: optional(
      record.viewerReaction,
      item => asString(item, 'post viewer reaction') as ReactionType,
    ),
    reactionCount: optional(record.reactionCount, item => asNumber(item, 'post reaction count')),
    quoteCount: optional(record.quoteCount, item => asNumber(item, 'post quote count')),
    version: optional(record.version, item => asNumber(item, 'post version')),
    quotedPost:
      record.quotedPost === null
        ? null
        : optional(record.quotedPost, item => decodePost(item)),
    optimisticState: optional(record.optimisticState, item => asString(item, 'optimistic state')) as SocialPost['optimisticState'],
  }
  const kind = asString(record.kind, 'post kind')
  if (kind === 'text') {
    return {...base, kind, text: asString(record.text, 'post text')}
  }
  if (kind === 'media') {
    return {
      ...base,
      kind,
      media: asArray(record.media, 'post media', item => asRecord(item, 'media asset') as SocialPost & never),
      glowColour: asString(record.glowColour, 'media glow colour'),
    }
  }
  if (kind === 'link') {
    const link = asRecord(record.link, 'link preview')
    return {
      ...base,
      kind,
      link: {
        domain: asString(link.domain, 'link domain'),
        title: asString(link.title, 'link title'),
        description: asString(link.description, 'link description'),
        image: optional(link.image, item => asString(item, 'link image')),
      },
    }
  }
  if (kind === 'module') {
    const module = asRecord(record.module, 'module post')
    return {
      ...base,
      kind,
      module: {
        name: asString(module.name, 'module name'),
        actionLabel: asString(module.actionLabel, 'module action'),
        status: asString(module.status, 'module status'),
      },
    }
  }
  throw new Error('Invalid post kind.')
}
