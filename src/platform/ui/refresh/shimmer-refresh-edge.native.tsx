import type {ComponentType} from 'react'

import {isReactNativeSkiaNativeAvailable} from '@/platform/ui/native-modules/expo-native-availability'
import {
  ShimmerRefreshEdgeFallback,
  type ShimmerRefreshEdgeProps,
} from '@/platform/ui/refresh/shimmer-refresh-edge-fallback'

export type {ShimmerRefreshEdgeProps}

function loadSkiaEdge(): ComponentType<ShimmerRefreshEdgeProps> | null {
  if (!isReactNativeSkiaNativeAvailable()) return null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./shimmer-refresh-edge-skia') as {
      ShimmerRefreshEdgeSkia: ComponentType<ShimmerRefreshEdgeProps>
    }
    return mod.ShimmerRefreshEdgeSkia
  } catch {
    return null
  }
}

const SkiaEdge = loadSkiaEdge()

/**
 * Pull-to-refresh shimmering top edge (iPhone edge-glow energy).
 * Skia when linked; Reanimated + LinearGradient otherwise.
 */
export function ShimmerRefreshEdge(props: ShimmerRefreshEdgeProps) {
  if (SkiaEdge) {
    return <SkiaEdge {...props} />
  }
  return <ShimmerRefreshEdgeFallback {...props} />
}
