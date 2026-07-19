import type {ProductPreferences} from '@/features/product/storage/productPreferencesStorage'

/** Known Feature Control row ids (defaults in product preferences). */
export type FeatureControlId =
  | 'reels'
  | 'merge'
  | 'focus'
  | 'gaia'
  | 'agents'
  | 'forge'
  | 'dimon'
  | 'automations'

/**
 * Whether a Feature Control channel is enabled for this device.
 * Unknown ids default to true so new surfaces are not accidentally locked out.
 */
export function isFeatureEnabled(
  preferences: ProductPreferences,
  id: FeatureControlId | string,
): boolean {
  const row = preferences.featureControl.find(item => item.id === id)
  if (!row) return true
  return row.enabled
}
