import type {
  ModulaProfile,
  ProfileId,
  UpdateProfileInput,
} from '@/features/profile/contracts/profile'

export interface ProfileRepository {
  getOwnerProfile(): Promise<ModulaProfile>
  getProfileByHandle(handle: string): Promise<ModulaProfile | null>
  getFollowers(handle: string): Promise<ModulaProfile[]>
  getFollowing(handle: string): Promise<ModulaProfile[]>
  updateOwnerProfile(
    input: UpdateProfileInput,
  ): Promise<ModulaProfile>
  followProfile(profileId: ProfileId): Promise<void>
  unfollowProfile(profileId: ProfileId): Promise<void>
}
