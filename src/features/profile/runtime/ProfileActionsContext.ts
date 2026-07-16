import {createContext} from 'react'

import type {
  FocusStatus,
  ProfileId,
  ProfileLayoutId,
  ProfilePresentationPreferences,
  UpdateProfileInput,
} from '@/features/profile/contracts'

export type ProfileActions = {
  updateOwnerProfile(input: UpdateProfileInput): void
  setOwnerAvatar(uri: string | null): void
  setOwnerCover(uri: string | null): void
  followProfile(profileId: ProfileId): void
  unfollowProfile(profileId: ProfileId): void
  setFocusStatus(status: FocusStatus): void
  enableProfileTab(tabId: string): void
  disableProfileTab(tabId: string): void
  moveProfileTab(tabId: string, direction: 'up' | 'down'): void
  setDefaultProfileTab(tabId: string): void
  setProfileLayout(layoutId: ProfileLayoutId): void
  setProfilePresentation(preferences: ProfilePresentationPreferences): void
  resetProfilePresentation(): void
}

export const ProfileActionsContext = createContext<ProfileActions | null>(null)
