import {createContext} from 'react'

import type {
  ProfileLayoutId,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts'

export type ProfileActions = {
  enableProfileTab(tabId: string): void
  disableProfileTab(tabId: string): void
  moveProfileTab(tabId: string, direction: 'up' | 'down'): void
  setDefaultProfileTab(tabId: string): void
  setProfileLayout(layoutId: ProfileLayoutId): void
  setProfilePresentation(preferences: ProfilePresentationPreferences): void
  resetProfilePresentation(): void
}

export const ProfileActionsContext = createContext<ProfileActions | null>(null)
