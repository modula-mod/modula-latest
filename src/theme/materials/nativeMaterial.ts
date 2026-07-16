import {Platform} from 'react-native'
import {
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect'

import type {MaterialTokens, SemanticColours, SurfaceRole} from '@/theme/contracts'
import {createGlassMaterial} from '@/theme/materials/glassMaterial'

const NATIVE_GLASS_ROLES = new Set<SurfaceRole>([
  'navigation',
  'floating',
  'modal',
  'control',
])

let cachedNativeGlassAvailable: boolean | null = null

export function isNativeGlassRuntimeAvailable(): boolean {
  if (Platform.OS !== 'ios') {
    return false
  }

  if (cachedNativeGlassAvailable !== null) {
    return cachedNativeGlassAvailable
  }

  try {
    cachedNativeGlassAvailable =
      Boolean(isLiquidGlassAvailable()) && Boolean(isGlassEffectAPIAvailable())
  } catch {
    cachedNativeGlassAvailable = false
  }

  return cachedNativeGlassAvailable
}

export function createNativeMaterial(
  role: SurfaceRole,
  colours: SemanticColours,
  isDark: boolean,
): MaterialTokens {
  const glass = createGlassMaterial(role, colours, isDark)

  return {
    ...glass,
    useNativeGlass: NATIVE_GLASS_ROLES.has(role),
    blurIntensity: NATIVE_GLASS_ROLES.has(role) ? 0 : glass.blurIntensity,
    opacity: NATIVE_GLASS_ROLES.has(role) ? 1 : glass.opacity,
  }
}
