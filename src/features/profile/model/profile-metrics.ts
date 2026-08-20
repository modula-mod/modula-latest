import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {formatCompactNumber, formatFullNumber} from '@/lib/formatCompactNumber'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'

export type ProfileMetricId = 'posts' | 'followers' | 'following' | 'modules'

export type ProfileMetricDestination =
  | {type: 'profile-tab'; tabId: string}
  | {type: 'route'; href: string}
  | {type: 'none'}

export type ProfileMetricVisibility = 'public' | 'owner' | 'hidden'

export type ProfileMetricDescriptor = {
  id: ProfileMetricId
  label: string
  value: number
  formattedValue: string
  formattedFullValue: string
  secondaryText?: string
  visibility: ProfileMetricVisibility
  destination: ProfileMetricDestination
  loading?: boolean
  unavailable?: boolean
}

export type ProfileMetricDefinition = {
  id: ProfileMetricId
  label: string
  defaultOrder: number
  selectValue: (profile: ModulaProfile) => number
  destinationFor: (profile: ModulaProfile, ownerHandle: string) => ProfileMetricDestination
  secondaryText?: (profile: ModulaProfile) => string | undefined
}

export const SYSTEM_PROFILE_METRIC_IDS: ProfileMetricId[] = [
  'posts',
  'followers',
  'following',
  'modules',
]

export const DEFAULT_PROFILE_METRIC_ORDER: ProfileMetricId[] = [
  'posts',
  'followers',
  'following',
  'modules',
]

export const profileMetricRegistry: Record<ProfileMetricId, ProfileMetricDefinition> = {
  posts: {
    id: 'posts',
    label: 'Posts',
    defaultOrder: 0,
    selectValue: profile => profile.postCount,
    destinationFor: () => ({type: 'profile-tab', tabId: 'posts'}),
    secondaryText: () => "Content you've shared so far on Modula.",
  },
  followers: {
    id: 'followers',
    label: 'Followers',
    defaultOrder: 1,
    selectValue: profile => profile.followerCount,
    destinationFor: (profile, ownerHandle) => ({
      type: 'route',
      href: `/profile/${ownerHandle || profile.handle}/followers`,
    }),
    secondaryText: () => 'People who follow this profile.',
  },
  following: {
    id: 'following',
    label: 'Following',
    defaultOrder: 2,
    selectValue: profile => profile.followingCount,
    destinationFor: (profile, ownerHandle) => ({
      type: 'route',
      href: `/profile/${ownerHandle || profile.handle}/following`,
    }),
    secondaryText: () => 'Accounts this profile follows.',
  },
  modules: {
    id: 'modules',
    label: 'Modules',
    defaultOrder: 3,
    selectValue: profile => profile.moduleCount,
    destinationFor: () => ({type: 'profile-tab', tabId: 'modules'}),
    secondaryText: () => 'Installed modules on this profile.',
  },
}

export function isProfileMetricId(value: string): value is ProfileMetricId {
  return value in profileMetricRegistry
}

export function defaultHiddenMetricIds(
  presentation: Pick<ProfilePresentationPreferences, 'showFollowerCount' | 'showModuleCount'>,
): ProfileMetricId[] {
  const hidden: ProfileMetricId[] = []
  if (!presentation.showFollowerCount) {
    hidden.push('followers', 'following')
  }
  if (!presentation.showModuleCount) {
    hidden.push('modules')
  }
  return hidden
}

export function normaliseMetricPreferences(
  presentation: ProfilePresentationPreferences,
): {
  orderedMetricIds: ProfileMetricId[]
  hiddenMetricIds: ProfileMetricId[]
  defaultMetricId: ProfileMetricId
} {
  const orderedFromPrefs = (presentation.orderedMetricIds ?? [])
    .filter(isProfileMetricId)
  const orderedMetricIds = uniqueMetrics([
    ...orderedFromPrefs,
    ...DEFAULT_PROFILE_METRIC_ORDER,
  ])
  const hiddenFromPrefs = presentation.hiddenMetricIds
    ? presentation.hiddenMetricIds.filter(isProfileMetricId)
    : defaultHiddenMetricIds(presentation)
  const hiddenMetricIds = uniqueMetrics(hiddenFromPrefs)
  const visible = orderedMetricIds.filter(id => !hiddenMetricIds.includes(id))
  const fallbackVisible = visible.length ? visible : (['posts'] as ProfileMetricId[])
  const requestedDefault = presentation.defaultMetricId
  const defaultMetricId =
    requestedDefault &&
    isProfileMetricId(requestedDefault) &&
    fallbackVisible.includes(requestedDefault)
      ? requestedDefault
      : fallbackVisible[0]

  return {
    orderedMetricIds,
    hiddenMetricIds: hiddenMetricIds.filter(id => id !== 'posts' || fallbackVisible.length > 1),
    defaultMetricId,
  }
}

export function resolveProfileMetrics(input: {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  isOwner: boolean
}): ProfileMetricDescriptor[] {
  const {orderedMetricIds, hiddenMetricIds} = normaliseMetricPreferences(input.presentation)
  const visibleIds = orderedMetricIds.filter(id => !hiddenMetricIds.includes(id))
  const ids = visibleIds.length ? visibleIds : (['posts'] as ProfileMetricId[])
  const capped = ids.slice(0, PROFILE_LAYOUT.metricMaxVisible)

  return capped
    .map(id => {
      const definition = profileMetricRegistry[id]
      const value = definition.selectValue(input.profile)
      return {
        id,
        label: definition.label,
        value,
        formattedValue: formatCompactNumber(value),
        formattedFullValue: formatFullNumber(value),
        secondaryText: definition.secondaryText?.(input.profile),
        visibility: 'public' as const,
        destination: definition.destinationFor(input.profile, input.ownerHandle),
      }
    })
    .filter(metric => metric.visibility === 'public' || input.isOwner)
}

export function metricPreferencesFromHidden(
  orderedMetricIds: ProfileMetricId[],
  hiddenMetricIds: ProfileMetricId[],
  defaultMetricId: ProfileMetricId,
): Pick<
  ProfilePresentationPreferences,
  | 'orderedMetricIds'
  | 'hiddenMetricIds'
  | 'defaultMetricId'
  | 'showFollowerCount'
  | 'showModuleCount'
> {
  const hidden = uniqueMetrics(hiddenMetricIds)
  const visible = orderedMetricIds.filter(id => !hidden.includes(id))
  const safeDefault =
    visible.includes(defaultMetricId) ? defaultMetricId : visible[0] ?? 'posts'
  return {
    orderedMetricIds,
    hiddenMetricIds: hidden,
    defaultMetricId: safeDefault,
    showFollowerCount: !hidden.includes('followers') || !hidden.includes('following'),
    showModuleCount: !hidden.includes('modules'),
  }
}

function uniqueMetrics(ids: ProfileMetricId[]): ProfileMetricId[] {
  return [...new Set(ids)]
}
