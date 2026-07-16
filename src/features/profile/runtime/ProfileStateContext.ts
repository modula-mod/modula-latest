import {createContext} from 'react'

import type {
  ModulaProfile,
  ProfileHandle,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'

export type ProfileState = {
  ownerProfile: ModulaProfile
  profiles: Record<ProfileHandle, ModulaProfile>
  presentation: ProfilePresentationPreferences
  hydrationComplete: boolean
}

export const ProfileStateContext = createContext<ProfileState | null>(null)
