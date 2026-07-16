import {useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren} from 'react'

import {
  DEFAULT_PROFILE_PRESENTATION,
  type FocusStatus,
  type ModulaProfile,
  type ProfileHandle,
  type ProfileId,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
  type UpdateProfileInput,
} from '@/features/profile/contracts'
import {demoOwnerProfile, demoProfileList} from '@/features/profile/data/demoProfiles'
import {createCoreProfileTabs} from '@/features/profile/registry/createCoreProfileTabs'
import {RuntimeProfileTabRegistry} from '@/features/profile/registry/ProfileTabRegistry'
import {
  loadProfilePresentationPreferences,
  saveProfilePresentationPreferences,
} from '@/features/profile/storage/profilePresentationStorage'
import {ProfileActionsContext, type ProfileActions} from '@/features/profile/runtime/ProfileActionsContext'
import {ProfileRegistryContext} from '@/features/profile/runtime/ProfileRegistryContext'
import {ProfileStateContext, type ProfileState} from '@/features/profile/runtime/ProfileStateContext'

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

function createInitialProfiles(): Record<ProfileHandle, ModulaProfile> {
  return demoProfileList.reduce<Record<ProfileHandle, ModulaProfile>>(
    (acc, profile) => {
      acc[profile.handle] = cloneProfile(profile)
      return acc
    },
    {},
  )
}

function ensurePostsEnabled(
  presentation: ProfilePresentationPreferences,
): ProfilePresentationPreferences {
  const enabledTabIds = [...new Set(['posts', ...presentation.enabledTabIds])]
  const tabOrder = [...new Set(['posts', ...presentation.tabOrder])]
  const defaultTabId = enabledTabIds.includes(presentation.defaultTabId)
    ? presentation.defaultTabId
    : 'posts'
  return {
    ...presentation,
    enabledTabIds,
    tabOrder,
    defaultTabId,
  }
}

export function ProfileProvider({children}: PropsWithChildren) {
  const [profiles, setProfiles] = useState<Record<ProfileHandle, ModulaProfile>>(
    () => createInitialProfiles(),
  )
  const [ownerProfile, setOwnerProfile] = useState<ModulaProfile>(() =>
    cloneProfile(demoOwnerProfile),
  )
  const [presentation, setPresentation] = useState<ProfilePresentationPreferences>(
    DEFAULT_PROFILE_PRESENTATION,
  )
  const [hydrationComplete, setHydrationComplete] = useState(false)
  const didHydrateRef = useRef(false)

  const registry = useMemo(() => {
    const next = new RuntimeProfileTabRegistry()
    createCoreProfileTabs(next)
    return next
  }, [])

  useEffect(() => {
    let active = true
    loadProfilePresentationPreferences()
      .then(next => {
        if (active) {
          setPresentation(ensurePostsEnabled(next))
        }
      })
      .finally(() => {
        if (active) {
          didHydrateRef.current = true
          setHydrationComplete(true)
        }
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!didHydrateRef.current) return
    void saveProfilePresentationPreferences(ensurePostsEnabled(presentation))
  }, [presentation])

  const replaceOwnerProfile = useCallback((nextProfile: ModulaProfile) => {
    setOwnerProfile(nextProfile)
    setProfiles(prev => {
      const next = {...prev}
      Object.keys(next).forEach(handle => {
        if (next[handle]?.id === nextProfile.id && handle !== nextProfile.handle) {
          delete next[handle]
        }
      })
      next[nextProfile.handle] = nextProfile
      return next
    })
  }, [])

  const updateOwnerProfile = useCallback(
    (input: UpdateProfileInput) => {
      replaceOwnerProfile({
        ...ownerProfile,
        ...input,
        location: input.location === null ? undefined : input.location ?? ownerProfile.location,
        website: input.website === null ? undefined : input.website ?? ownerProfile.website,
        focusStatus: input.focusStatus ?? ownerProfile.focusStatus,
      })
    },
    [ownerProfile, replaceOwnerProfile],
  )

  const setOwnerAvatar = useCallback(
    (uri: string | null) => {
      replaceOwnerProfile({
        ...ownerProfile,
        avatarUri: uri ?? undefined,
      })
    },
    [ownerProfile, replaceOwnerProfile],
  )

  const setOwnerCover = useCallback(
    (uri: string | null) => {
      replaceOwnerProfile({
        ...ownerProfile,
        coverUri: uri ?? undefined,
      })
    },
    [ownerProfile, replaceOwnerProfile],
  )

  const updateFollowState = useCallback((profileId: ProfileId, isFollowing: boolean) => {
    setProfiles(prev =>
      Object.values(prev).reduce<Record<ProfileHandle, ModulaProfile>>((acc, profile) => {
        const next =
          profile.id === profileId
            ? {
                ...profile,
                isFollowing,
                followerCount:
                  profile.isFollowing === isFollowing
                    ? profile.followerCount
                    : Math.max(0, profile.followerCount + (isFollowing ? 1 : -1)),
              }
            : profile
        acc[next.handle] = next
        return acc
      }, {}),
    )
  }, [])

  const setFocusStatus = useCallback(
    (status: FocusStatus) => {
      replaceOwnerProfile({
        ...ownerProfile,
        focusStatus: {
          ...status,
          updatedAt: new Date().toISOString(),
        },
      })
    },
    [ownerProfile, replaceOwnerProfile],
  )

  const enableProfileTab = useCallback((tabId: string) => {
    setPresentation(prev =>
      ensurePostsEnabled({
        ...prev,
        enabledTabIds: [...new Set([...prev.enabledTabIds, tabId])],
      }),
    )
  }, [])

  const disableProfileTab = useCallback((tabId: string) => {
    if (tabId === 'posts') return
    setPresentation(prev => {
      const enabledTabIds = prev.enabledTabIds.filter(id => id !== tabId)
      return ensurePostsEnabled({
        ...prev,
        enabledTabIds,
        defaultTabId: enabledTabIds.includes(prev.defaultTabId)
          ? prev.defaultTabId
          : 'posts',
      })
    })
  }, [])

  const moveProfileTab = useCallback((tabId: string, direction: 'up' | 'down') => {
    setPresentation(prev => {
      const tabOrder = [...prev.tabOrder]
      const index = tabOrder.indexOf(tabId)
      if (index < 0) return prev
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (nextIndex < 0 || nextIndex >= tabOrder.length) return prev
      const moving = tabOrder[index]
      tabOrder[index] = tabOrder[nextIndex]
      tabOrder[nextIndex] = moving
      return ensurePostsEnabled({...prev, tabOrder})
    })
  }, [])

  const setDefaultProfileTab = useCallback((tabId: string) => {
    setPresentation(prev =>
      ensurePostsEnabled({
        ...prev,
        defaultTabId: prev.enabledTabIds.includes(tabId) ? tabId : 'posts',
      }),
    )
  }, [])

  const setProfileLayout = useCallback((layoutId: ProfileLayoutId) => {
    setPresentation(prev => ensurePostsEnabled({...prev, layoutId}))
  }, [])

  const setProfilePresentation = useCallback(
    (preferences: ProfilePresentationPreferences) => {
      setPresentation(ensurePostsEnabled(preferences))
    },
    [],
  )

  const resetProfilePresentation = useCallback(() => {
    setPresentation(DEFAULT_PROFILE_PRESENTATION)
  }, [])

  const actions = useMemo<ProfileActions>(
    () => ({
      updateOwnerProfile,
      setOwnerAvatar,
      setOwnerCover,
      followProfile: profileId => updateFollowState(profileId, true),
      unfollowProfile: profileId => updateFollowState(profileId, false),
      setFocusStatus,
      enableProfileTab,
      disableProfileTab,
      moveProfileTab,
      setDefaultProfileTab,
      setProfileLayout,
      setProfilePresentation,
      resetProfilePresentation,
    }),
    [
      disableProfileTab,
      enableProfileTab,
      moveProfileTab,
      resetProfilePresentation,
      setDefaultProfileTab,
      setProfilePresentation,
      setFocusStatus,
      setOwnerAvatar,
      setOwnerCover,
      setProfileLayout,
      updateFollowState,
      updateOwnerProfile,
    ],
  )

  const state = useMemo<ProfileState>(
    () => ({
      ownerProfile,
      profiles,
      presentation: ensurePostsEnabled(presentation),
      hydrationComplete,
    }),
    [hydrationComplete, ownerProfile, presentation, profiles],
  )

  return (
    <ProfileRegistryContext.Provider value={registry}>
      <ProfileStateContext.Provider value={state}>
        <ProfileActionsContext.Provider value={actions}>
          {children}
        </ProfileActionsContext.Provider>
      </ProfileStateContext.Provider>
    </ProfileRegistryContext.Provider>
  )
}
