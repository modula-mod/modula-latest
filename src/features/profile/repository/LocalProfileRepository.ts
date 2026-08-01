import {
  demoOwnerProfile,
  demoProfileList,
  demoProfileRelations,
  ownerProfileId,
} from '../data/demoProfiles'
import type {
  ModulaProfile,
  ProfileHandle,
  ProfileId,
  UpdateProfileInput,
} from '@/features/profile/contracts/profile'
import type {ProfileRepository} from '@/features/profile/repository/ProfileRepository'

function cloneProfile(profile: ModulaProfile): ModulaProfile {
  return {
    ...profile,
    location: profile.location ? {...profile.location} : undefined,
    website: profile.website ? {...profile.website} : undefined,
    focusStatus: {...profile.focusStatus},
    identityClaims: profile.identityClaims.map(claim => ({...claim})),
    links: profile.links.map(link => ({...link})),
    featuredModuleIds: [...profile.featuredModuleIds],
  }
}

export class LocalProfileRepository implements ProfileRepository {
  private profiles: Record<ProfileHandle, ModulaProfile>

  constructor(seedProfiles: ModulaProfile[] = demoProfileList) {
    this.profiles = seedProfiles.reduce<Record<ProfileHandle, ModulaProfile>>(
      (acc, profile) => {
        acc[profile.handle] = cloneProfile(profile)
        return acc
      },
      {},
    )
  }

  async getOwnerProfile(): Promise<ModulaProfile> {
    const owner = Object.values(this.profiles).find(profile => profile.id === ownerProfileId)
    return cloneProfile(owner ?? demoOwnerProfile)
  }

  async getProfileByHandle(handle: string): Promise<ModulaProfile | null> {
    const profile = this.profiles[handle]
    return profile ? cloneProfile(profile) : null
  }

  async getFollowers(handle: string): Promise<ModulaProfile[]> {
    return this.getConnectionProfiles(demoProfileRelations.followers[handle] ?? [])
  }

  async getFollowing(handle: string): Promise<ModulaProfile[]> {
    return this.getConnectionProfiles(demoProfileRelations.following[handle] ?? [])
  }

  async updateOwnerProfile(input: UpdateProfileInput): Promise<ModulaProfile> {
    const owner = await this.getOwnerProfile()
    const next: ModulaProfile = {
      ...owner,
      ...input,
      avatarUri: input.avatarUri === null ? undefined : input.avatarUri ?? owner.avatarUri,
      coverUri: input.coverUri === null ? undefined : input.coverUri ?? owner.coverUri,
      location: input.location === null ? undefined : input.location ?? owner.location,
      website: input.website === null ? undefined : input.website ?? owner.website,
      focusStatus: input.focusStatus ?? owner.focusStatus,
    }

    delete this.profiles[owner.handle]
    this.profiles[next.handle] = cloneProfile(next)
    return cloneProfile(next)
  }

  async followProfile(profileId: ProfileId): Promise<void> {
    this.updateFollowState(profileId, true)
  }

  async unfollowProfile(profileId: ProfileId): Promise<void> {
    this.updateFollowState(profileId, false)
  }

  private getConnectionProfiles(profileIds: ProfileId[]): ModulaProfile[] {
    const byId = Object.values(this.profiles).reduce<Record<ProfileId, ModulaProfile>>(
      (acc, profile) => {
        acc[profile.id] = profile
        return acc
      },
      {},
    )
    return profileIds
      .map(id => byId[id])
      .filter((profile): profile is ModulaProfile => Boolean(profile))
      .map(cloneProfile)
  }

  private updateFollowState(profileId: ProfileId, following: boolean) {
    this.profiles = Object.values(this.profiles).reduce<Record<ProfileHandle, ModulaProfile>>(
      (acc, profile) => {
        const delta = following ? 1 : -1
        const next =
          profile.id === profileId
            ? {
                ...profile,
                isFollowing: following,
                followerCount:
                  profile.isFollowing === following
                    ? profile.followerCount
                    : Math.max(0, profile.followerCount + delta),
              }
            : profile
        acc[next.handle] = next
        return acc
      },
      {},
    )
  }
}
