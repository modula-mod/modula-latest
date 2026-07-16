import {decodeCursorPage, decodeProfile} from '@/api/decoding'
import {asRecord} from '@/api/decoding/validation'
import type {ApiClient} from '@/api/client'
import type {ConnectionPageInput, FollowResult, SocialGraphRepository} from '@/data/repositories/contracts'
import type {CursorPage, ProfileId} from '@/api/contracts'
import type {ModulaProfile} from '@/features/profile/contracts'

function decodeFollowResult(value: unknown): FollowResult {
  const result = asRecord(value, 'follow result')
  return {
    profile: decodeProfile(result.profile),
    isFollowing: Boolean(result.isFollowing),
    followerCount: Number(result.followerCount ?? 0),
  }
}

export class ApiSocialGraphRepository implements SocialGraphRepository {
  constructor(private readonly client: ApiClient) {}

  follow(profileId: ProfileId): Promise<FollowResult> {
    return this.client.post({path: `/v1/profiles/${profileId}/follow`, authenticated: true}, decodeFollowResult)
  }

  unfollow(profileId: ProfileId): Promise<FollowResult> {
    return this.client.delete({path: `/v1/profiles/${profileId}/follow`, authenticated: true}, decodeFollowResult)
  }

  getFollowers(input: ConnectionPageInput): Promise<CursorPage<ModulaProfile>> {
    return this.client.get({
      path: `/v1/profiles/${encodeURIComponent(input.handle)}/followers`,
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
    }, value => decodeCursorPage(value, decodeProfile))
  }

  getFollowing(input: ConnectionPageInput): Promise<CursorPage<ModulaProfile>> {
    return this.client.get({
      path: `/v1/profiles/${encodeURIComponent(input.handle)}/following`,
      query: {cursor: input.cursor ?? undefined, limit: input.limit},
    }, value => decodeCursorPage(value, decodeProfile))
  }
}
