import AsyncStorage from '@react-native-async-storage/async-storage'

import type {AppearancePreferences} from '@/theme/contracts'
import {migrateAppearancePreferences} from '@/theme/storage/migrateAppearancePreferences'

export const APPEARANCE_STORAGE_KEY = 'modula.appearance.preferences.v1'

export async function loadAppearancePreferences(): Promise<AppearancePreferences | null> {
  try {
    const value = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!value) {
      return null
    }

    return migrateAppearancePreferences(JSON.parse(value))
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to load appearance preferences', error)
    }
    return null
  }
}

export async function saveAppearancePreferences(
  preferences: AppearancePreferences,
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      JSON.stringify(preferences),
    )
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to save appearance preferences', error)
    }
  }
}
