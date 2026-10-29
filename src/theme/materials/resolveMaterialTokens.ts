import type {
  MaterialTokenMap,
  SemanticColours,
  SurfaceRole,
  SurfaceType,
} from '@/theme/contracts'
import {SURFACE_ROLES} from '@/theme/contracts'
import {createGlassMaterial} from '@/theme/materials/glassMaterial'
import {createGlayMaterial} from '@/theme/materials/glayMaterial'
import {createMinimalSpatialMaterial} from '@/theme/materials/minimalSpatialMaterial'
import {createNeomorphicMaterial} from '@/theme/materials/neomorphicMaterial'
import {createSkeuomorphicMaterial} from '@/theme/materials/skeuomorphicMaterial'
import {createSolidMaterial} from '@/theme/materials/solidMaterial'

export function resolveMaterialTokens(
  surfaceType: SurfaceType,
  colours: SemanticColours,
  isDark: boolean,
  reduceTransparency: boolean,
  increaseContrast: boolean,
): MaterialTokenMap {
  const effectiveSurfaceType = reduceTransparency ? 'solid' : surfaceType

  return SURFACE_ROLES.reduce((map, role) => {
    map[role] = resolveRoleMaterial(
      role,
      effectiveSurfaceType,
      colours,
      isDark,
      reduceTransparency,
      increaseContrast,
    )
    return map
  }, {} as MaterialTokenMap)
}

function resolveRoleMaterial(
  role: SurfaceRole,
  surfaceType: SurfaceType,
  colours: SemanticColours,
  isDark: boolean,
  reduceTransparency: boolean,
  increaseContrast: boolean,
) {
  const token =
    surfaceType === 'native'
      ? createGlassMaterial(role, colours, isDark)
      : surfaceType === 'glass'
        ? createGlassMaterial(role, colours, isDark)
        : surfaceType === 'glay'
          ? createGlayMaterial(role, colours, isDark)
          : surfaceType === 'minimalSpatial'
            ? createMinimalSpatialMaterial(role, colours, isDark)
            : surfaceType === 'skeuomorphic'
              ? createSkeuomorphicMaterial(role, colours, isDark)
              : surfaceType === 'neomorphic'
                ? createNeomorphicMaterial(role, colours, isDark, increaseContrast)
                : createSolidMaterial(role, colours)

  if (!reduceTransparency) {
    return token
  }

  return {
    ...token,
    backgroundColor: role === 'canvas' ? colours.canvas : colours.surface1,
    borderColor: increaseContrast ? colours.borderStrong : colours.border,
    borderWidth: token.borderWidth > 0 ? 1 : token.borderWidth,
    opacity: 1,
    blurIntensity: 0,
    useNativeGlass: false,
    shadowOpacity: 0,
    elevation: 0,
  }
}
