import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

export function createSkeuomorphicMaterial(
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
    borderWidth: 1,
    shadowOpacity: isDark ? 0.22 : 0.12,
    shadowRadius: 9,
    shadowOffsetY: 5,
    elevation: 3,
    innerHighlightColor: isDark ? colours.surface3 : '#FFFFFF',
    innerHighlightOpacity: isDark ? 0.16 : 0.5,
    pressOpacity: 0.88,
    pressScale: 0.99,
  }
}
