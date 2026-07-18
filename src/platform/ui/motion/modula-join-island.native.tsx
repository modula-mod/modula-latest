import type {ComponentType} from 'react'

import {
  ModulaJoinIslandFallback,
  type ModulaJoinIslandProps,
} from '@/platform/ui/motion/modula-join-island-fallback'
import {isReactNativeSkiaNativeAvailable} from '@/platform/ui/native-modules/expo-native-availability'

export type {ModulaJoinIslandProps}

function loadSkiaJoinIsland(): ComponentType<ModulaJoinIslandProps> | null {
  if (!isReactNativeSkiaNativeAvailable()) return null
  try {
    // Dynamic require — static Skia import crashes binaries without RNSkiaModule.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./modula-join-island-skia') as {
      ModulaJoinIslandSkia: ComponentType<ModulaJoinIslandProps>
    }
    return mod.ModulaJoinIslandSkia
  } catch {
    return null
  }
}

/**
 * Telegram-style join island / meatball (Motionary MIT pattern).
 * Uses Skia when linked; otherwise Reanimated fallback.
 */
export function ModulaJoinIsland(props: ModulaJoinIslandProps) {
  const SkiaIsland = loadSkiaJoinIsland()
  if (SkiaIsland) {
    return <SkiaIsland {...props} />
  }
  return <ModulaJoinIslandFallback {...props} />
}
