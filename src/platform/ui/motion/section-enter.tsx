import type {ReactNode} from 'react'
import Animated, {FadeIn, FadeInDown, FadeInRight} from 'react-native-reanimated'

import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {useReduceMotion} from '@/lib/accessibility'

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

  if (reduceMotion || density === 'minimal') {
    return <>{children}</>
  }

  const scaledDelay = density === 'reduced' ? Math.round(delay * 0.35) : delay
  const entering =
    density === 'reduced'
      ? FadeIn.delay(scaledDelay).duration(160)
      : from === 'right'
        ? FadeInRight.delay(scaledDelay).springify().damping(18).stiffness(180)
        : FadeInDown.delay(scaledDelay).springify().damping(18).stiffness(180)

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}
