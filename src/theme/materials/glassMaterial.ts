import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

const GLASS_ROLES = new Set<SurfaceRole>([
  'navigation',
  'floating',
  'modal',
  'control',
])

export function createGlassMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
  isDark: boolean,
): MaterialTokens {
  const base = createSolidMaterial(role, colours)

  if (!GLASS_ROLES.has(role)) {
    return base
  }

  return {
    ...base,
    backgroundColor: colours.surfaceOverlay,
    borderColor: colours.borderStrong,
    opacity: isDark ? 0.72 : 0.78,
    blurIntensity:
      role === 'navigation' ? 35 : role === 'floating' ? 45 : role === 'modal' ? 40 : 32,
    blurTint: isDark ? 'dark' : 'light',
    shadowOpacity: isDark ? 0.2 : 0.12,
    shadowRadius: role === 'modal' ? 22 : 14,
    shadowOffsetY: role === 'modal' ? 10 : 6,
    elevation: role === 'navigation' ? 2 : 4,
    innerHighlightColor: isDark ? colours.borderStrong : '#FFFFFF',
    innerHighlightOpacity: isDark ? 0.12 : 0.44,
  }
}
