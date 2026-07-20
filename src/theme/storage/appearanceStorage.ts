import AsyncStorage from '@react-native-async-storage/async-storage'

import type {AppearancePreferences} from '@/theme/contracts'
import {migrateAppearancePreferences} from '@/theme/storage/migrateAppearancePreferences'

export const APPEARANCE_STORAGE_KEY = 'modula.appearance.preferences.v1'

export type AppearanceCache = {
  preferences: AppearancePreferences
  version: number
}

export async function loadAppearanceCache(): Promise<AppearanceCache | null> {
  try {
    const value = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as unknown
    const row = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return {
      preferences: migrateAppearancePreferences(row.preferences ?? parsed),
      version: typeof row.version === 'number' && row.version >= 0 ? row.version : 0,
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to load appearance preferences', error)
    }
    return null
  }
}

export async function loadAppearancePreferences(): Promise<AppearancePreferences | null> {
  return (await loadAppearanceCache())?.preferences ?? null
}

export async function saveAppearanceCache(cache: AppearanceCache): Promise<void> {
  try {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(cache))
  } catch (error) {
    if (__DEV__) {
      console.warn('Failed to save appearance preferences', error)
    }
  }
}

export async function saveAppearancePreferences(
  preferences: AppearancePreferences,
): Promise<void> {
  await saveAppearanceCache({preferences, version: 0})
}
