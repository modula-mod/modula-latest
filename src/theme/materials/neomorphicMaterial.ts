import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

export function createNeomorphicMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
  isDark: boolean,
  increaseContrast: boolean,
): MaterialTokens {
  const base = createSolidMaterial(role, colours)
  if (
    increaseContrast ||
    role === 'canvas' ||
    role === 'content' ||
    role === 'post' ||
    role === 'media'
  ) {
    return base
  }

  return {
    ...base,
    backgroundColor: colours.surface1,
    borderColor: colours.border,
    shadowOpacity: isDark ? 0.34 : 0.1,
    shadowRadius: 12,
    shadowOffsetY: isDark ? 8 : 6,
    elevation: 3,
    innerHighlightColor: isDark ? colours.borderStrong : '#FFFFFF',
    innerHighlightOpacity: isDark ? 0.1 : 0.45,
    pressOpacity: 0.9,
    pressScale: 0.99,
  }
}
