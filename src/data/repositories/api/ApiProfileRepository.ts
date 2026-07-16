import {decodeProfile} from '@/api/decoding'
import type {ApiClient} from '@/api/client'
import type {ProfileRepository} from '@/data/repositories/contracts'
import type {ModulaProfile, UpdateProfileInput} from '@/features/profile/contracts'

export class ApiProfileRepository implements ProfileRepository {
  constructor(private readonly client: ApiClient) {}

  getProfileByHandle(handle: string): Promise<ModulaProfile> {
    return this.client.get({path: `/v1/profiles/${encodeURIComponent(handle)}`}, decodeProfile)
  }

  updateOwnerProfile(input: UpdateProfileInput): Promise<ModulaProfile> {
    return this.client.patch({path: '/v1/profiles/me', body: input, authenticated: true}, decodeProfile)
  }
}
