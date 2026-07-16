import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

export function createGlayMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
  isDark: boolean,
): MaterialTokens {
  const base = createSolidMaterial(role, colours)
  if (role === 'canvas' || role === 'content' || role === 'post' || role === 'media') {
    return base
  }

  return {
    ...base,
    backgroundColor: role === 'control' ? colours.surface3 : colours.surface2,
    borderColor: colours.borderStrong,
    shadowOpacity: isDark ? 0.16 : 0.08,
    shadowRadius: 8,
    shadowOffsetY: 4,
    elevation: 2,
    innerHighlightColor: isDark ? colours.borderStrong : '#FFFFFF',
    innerHighlightOpacity: isDark ? 0.1 : 0.38,
    pressScale: 0.985,
  }
}
