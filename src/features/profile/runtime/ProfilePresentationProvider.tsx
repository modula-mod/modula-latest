import {useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren} from 'react'

import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfileLayoutId,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts'
import {createCoreProfileTabs} from '@/features/profile/registry/createCoreProfileTabs'
import {RuntimeProfileTabRegistry} from '@/features/profile/registry/ProfileTabRegistry'
import {ProfileActionsContext, type ProfileActions} from '@/features/profile/runtime/ProfileActionsContext'
import {ProfileRegistryContext} from '@/features/profile/runtime/ProfileRegistryContext'
import {ProfileStateContext, type ProfileState} from '@/features/profile/runtime/ProfileStateContext'
import {
  loadProfilePresentationPreferences,
  saveProfilePresentationPreferences,
} from '@/features/profile/storage/profilePresentationStorage'

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

export function ProfilePresentationProvider({children}: PropsWithChildren) {
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
        if (active) setPresentation(ensurePostsEnabled(next))
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
      const nextIndex = direction === 'up' ? index - 1 : index + 1
      if (index < 0 || nextIndex < 0 || nextIndex >= tabOrder.length) return prev
      const current = tabOrder[index]
      tabOrder[index] = tabOrder[nextIndex]
      tabOrder[nextIndex] = current
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

  const setProfilePresentation = useCallback((preferences: ProfilePresentationPreferences) => {
    setPresentation(ensurePostsEnabled(preferences))
  }, [])

  const resetProfilePresentation = useCallback(() => {
    setPresentation(DEFAULT_PROFILE_PRESENTATION)
  }, [])

  const actions = useMemo<ProfileActions>(
    () => ({
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
      setProfileLayout,
      setProfilePresentation,
    ],
  )

  const state = useMemo<ProfileState>(
    () => ({
      presentation: ensurePostsEnabled(presentation),
      hydrationComplete,
    }),
    [hydrationComplete, presentation],
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
