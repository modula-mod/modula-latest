import {createContext} from 'react'

import type {
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'

export type ProfileState = {
  presentation: ProfilePresentationPreferences
  hydrationComplete: boolean
}

export const ProfileStateContext = createContext<ProfileState | null>(null)
