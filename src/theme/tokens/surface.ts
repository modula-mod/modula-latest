import type {SurfaceTypeId} from '@/theme/tokens/dimensions'

/**
 * Material / Surface Type contracts.
 * Engines for glass / skeuo / neo are stubs — primitives use solid values today.
 */
export type MaterialTokens = {
  surfaceType: SurfaceTypeId
  /** 0–1 surface opacity hint for material engines */
  opacity: number
  /** Blur radius hint (px); 0 = none */
  blur: number
  /** Elevation step 0–5 */
  elevation: number
  borderWidth: number
  /** Engine status for diagnostics */
  engine: 'solid' | 'native-stub' | 'deferred'
}

const SOLID: Omit<MaterialTokens, 'surfaceType'> = {
  opacity: 1,
  blur: 0,
  elevation: 0,
  borderWidth: 1,
  engine: 'solid',
}

/** Resolve material tokens. Non-solid types return documented stubs. */
export function resolveMaterialTokens(surfaceType: SurfaceTypeId): MaterialTokens {
  switch (surfaceType) {
    case 'solid':
      return {surfaceType, ...SOLID}
    case 'native':
      return {
        surfaceType,
        opacity: 1,
        blur: 0,
        elevation: 1,
        borderWidth: 0,
        engine: 'native-stub',
      }
    case 'glass':
    case 'glay':
    case 'minimalSpatial':
    case 'skeuo':
    case 'neo':
      return {
        surfaceType,
        opacity: surfaceType === 'minimalSpatial' ? 1 : 0.85,
        blur: surfaceType === 'glass' || surfaceType === 'glay' ? 20 : 0,
        elevation: surfaceType === 'neo' ? 2 : 1,
        borderWidth: 1,
        engine: 'deferred',
      }
    default: {
      const _exhaustive: never = surfaceType
      return {surfaceType: _exhaustive, ...SOLID}
    }
  }
}
