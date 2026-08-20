import type {PropsWithChildren} from 'react'
import {View} from 'react-native'

import {useHydrated} from '@/lib/useHydrated'

/**
 * Keeps static-export HTML and the browser hydration pass on the same minimal
 * tree. Use this at route boundaries whose content depends on client routing,
 * persisted session state, portals, or window geometry.
 */
export function HydratedRouteBoundary({children}: PropsWithChildren) {
  const hydrated = useHydrated()

  if (!hydrated) {
    return <View testID="hydrated-route-pending" style={{flex: 1}} />
  }

  return children
}
