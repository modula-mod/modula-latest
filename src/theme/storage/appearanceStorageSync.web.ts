import {APPEARANCE_STORAGE_KEY, type AppearanceCache} from '@/theme/storage/appearanceStorage'
import {migrateAppearancePreferences} from '@/theme/storage/migrateAppearancePreferences'

/** Safe synchronous bootstrap used only in a browser layout effect. */
export function loadAppearanceCacheSync(): AppearanceCache | null {
  if (typeof window === 'undefined') return null
  try {
    const value = window.localStorage.getItem(APPEARANCE_STORAGE_KEY)
    if (!value) return null
    const parsed = JSON.parse(value) as unknown
    const row = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    return {
      preferences: migrateAppearancePreferences(row.preferences ?? parsed),
      version: typeof row.version === 'number' && row.version >= 0 ? row.version : 0,
    }
  } catch {
    return null
  }
}
