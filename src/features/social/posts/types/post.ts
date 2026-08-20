import type {RemoteMediaAsset} from '@/domain/social/media'
import type {DraftLinkPreview, DraftPoll} from '@/domain/social/SocialPost'

export type MediaAsset = RemoteMediaAsset

export interface ImagePostContent {
  kind: 'image'
  source: MediaAsset
  aspectRatio?: number
  altText?: string
}

export interface TextPostContent {
  kind: 'text'
  body: string
}

export interface CarouselPostContent {
  kind: 'carousel'
  items: MediaAsset[]
  aspectRatio?: number
}

export interface VideoPostContent {
  kind: 'video'
  source: MediaAsset
  aspectRatio?: number
}

export interface MusicPostContent {
  kind: 'music'
  artwork: MediaAsset
  title: string
  artist: string
  durationSec?: number
}

export interface LinkPostContent {
  kind: 'link'
  preview: DraftLinkPreview
}

export interface PollPostContent {
  kind: 'poll'
  poll: DraftPoll
  voteCounts?: number[]
  totalVotes?: number
  hoursLeft?: number
  viewerChoice?: number | null
}

export interface MoviePostContent {
  kind: 'movie'
  source: MediaAsset
  title: string
  subtitle: string
  meta: string
}

export interface EventPostContent {
  kind: 'event'
  title: string
  when: string
  where: string
  cover?: MediaAsset
}

export type PostContent =
  | ImagePostContent
  | TextPostContent
  | CarouselPostContent
  | VideoPostContent
  | MusicPostContent
  | LinkPostContent
  | PollPostContent
  | MoviePostContent
  | EventPostContent

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K`
  }
  return String(value)
}

export function relativePostTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.round(hours / 24)}d`
}
