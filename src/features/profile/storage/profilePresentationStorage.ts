import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  DEFAULT_PROFILE_PRESENTATION,
  type ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {validateProfilePresentation} from '@/features/profile/storage/validateProfilePresentation'

export const PROFILE_PRESENTATION_STORAGE_KEY = 'modula.profile.presentation.v1'

export async function loadProfilePresentationPreferences(): Promise<ProfilePresentationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PROFILE_PRESENTATION_STORAGE_KEY)
    if (!stored) return DEFAULT_PROFILE_PRESENTATION
    return validateProfilePresentation(JSON.parse(stored))
  } catch {
    return DEFAULT_PROFILE_PRESENTATION
  }
}

export async function saveProfilePresentationPreferences(
  preferences: ProfilePresentationPreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      PROFILE_PRESENTATION_STORAGE_KEY,
      JSON.stringify(validateProfilePresentation(preferences)),
    )
  } catch {
    // Presentation settings are non-critical and must never block startup.
  }
}

export async function clearProfilePresentationPreferences(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_PRESENTATION_STORAGE_KEY)
  } catch {
    // Storage failure falls back to defaults on the next hydration attempt.
  }
}
