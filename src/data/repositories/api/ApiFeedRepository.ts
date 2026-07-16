import {decodeCursorPage, decodePost} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {FeedRepository, GetHomeFeedInput, GetProfileFeedInput} from '@/data/repositories/contracts'
import type {SocialPost} from '@/domain/social'
import type {CursorPage} from '@/api/contracts'

export class ApiFeedRepository implements FeedRepository {
  constructor(private readonly client: ApiClient) {}

  getHomeFeed(input: GetHomeFeedInput): Promise<CursorPage<SocialPost>> {
    return this.client.get({
      path: '/v1/feed/home',
      query: {mode: input.mode, cursor: input.cursor ?? undefined, limit: input.limit},
    }, value => decodeCursorPage(value, decodePost))
  }

  getProfileFeed(input: GetProfileFeedInput): Promise<CursorPage<SocialPost>> {
    return this.client.get({
      path: `/v1/feed/profile/${encodeURIComponent(input.profileId)}`,
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
    }, value => decodeCursorPage(value, decodePost))
  }
}
