import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

export function createMinimalSpatialMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
  isDark: boolean,
): MaterialTokens {
  const base = createSolidMaterial(role, colours)
  if (role === 'canvas' || role === 'content' || role === 'post') {
    return base
  }

  return {
    ...base,
    backgroundColor: role === 'navigation' ? colours.canvas : colours.surface1,
    borderColor: colours.border,
    shadowOpacity: isDark ? 0 : 0.04,
    shadowRadius: role === 'modal' ? 10 : 4,
    shadowOffsetY: role === 'modal' ? 6 : 2,
    elevation: role === 'modal' ? 2 : 1,
  }
}
