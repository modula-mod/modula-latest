import type {AppearanceCache} from '@/theme/storage/appearanceStorage'

/** Native/static fallback. Web supplies a pre-paint localStorage reader. */
export function loadAppearanceCacheSync(): AppearanceCache | null {
  return null
}
