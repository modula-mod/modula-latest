import type {ReactNode} from 'react'
import {Platform} from 'react-native'
import Animated from 'react-native-reanimated'

import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useReduceMotion} from '@/lib/accessibility'
import {useMotionEntering} from '@/platform/ui/motion/useMotionEntering'

type SectionEnterProps = {
  children: ReactNode
  /** Stagger delay in ms (applied after base delay). */
  delay?: number
  /** Entrance direction. Default slides up slightly. */
  from?: 'down' | 'right'
  /** Optional style on the animated wrapper. */
  style?: object
}

/**
 * Lightweight section entrance for Discover / Home / Activity polish.
 * Respects OS Reduce Motion and Customize → Motion density prefs.
 */
export function SectionEnter({
  children,
  delay = 0,
  from = 'down',
  style,
}: SectionEnterProps) {
  const reduceMotion = useReduceMotion()
  const {preferences} = useProductPreferences()
  const density = preferences.motionDensity
  const scaledDelay = density === 'reduced' ? Math.round(delay * 0.35) : delay
  const fadeEntering = useMotionEntering('fade', scaledDelay)
  const directionalEntering = useMotionEntering(from, scaledDelay)

  if (Platform.OS === 'web') {
    return <>{children}</>
  }

  if (reduceMotion || density === 'minimal') {
    return <>{children}</>
  }

  const entering = density === 'reduced' ? fadeEntering : directionalEntering
  if (!entering) {
    return <>{children}</>
  }

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}
