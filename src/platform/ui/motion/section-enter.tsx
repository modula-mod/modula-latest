import type {ReactNode} from 'react'
import Animated, {FadeInDown, FadeInRight} from 'react-native-reanimated'

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
 * Respects Reduce Motion — children render immediately with no enter anim.
 */
export function SectionEnter({
  children,
  delay = 0,
  from = 'down',
  style,
}: SectionEnterProps) {
  const reduceMotion = useReduceMotion()

  if (reduceMotion) {
    return <>{children}</>
  }

  const entering =
    from === 'right'
      ? FadeInRight.delay(delay).springify().damping(18).stiffness(180)
      : FadeInDown.delay(delay).springify().damping(18).stiffness(180)

  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  )
}
