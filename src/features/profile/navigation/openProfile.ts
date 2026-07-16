import type {Href} from 'expo-router'

import type {ModulaProfile, ProfileId} from '@/features/profile/contracts/profile'

export type ProfileRouteIdentity = {
  id: ProfileId
  handle: string
}

export function getProfileRoute(
  profile: ModulaProfile,
  ownerProfileId: string,
): Href {
  return getProfileRouteForIdentity(profile, ownerProfileId)
}

export function getProfileRouteForIdentity(
  profile: ProfileRouteIdentity,
  ownerProfileId: string,
): Href {
  return profile.id === ownerProfileId
    ? '/profile'
    : `/profile/${profile.handle}` as Href
}
