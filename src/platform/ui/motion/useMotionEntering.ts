import {FadeIn, FadeInDown, FadeInRight} from 'react-native-reanimated'

import {useReduceMotion} from '@/lib/accessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type EnterDirection = 'down' | 'right' | 'fade'

/**
 * Build a Reanimated entering transition from canonical MotionTokens.
 * Returns undefined when Reduce Motion is on (instant mount, no movement).
 */
export function useMotionEntering(direction: EnterDirection = 'down', delay = 0) {
  const reduceMotion = useReduceMotion()
  const {motion} = useThemeTokens()

  if (reduceMotion || motion.fast === 0) {
    return undefined
  }

  const spring = motion.springs.navigation
  const scaledDelay = Math.max(0, delay)

  if (direction === 'fade') {
    return FadeIn.delay(scaledDelay).duration(motion.fast)
  }

  const builder =
    direction === 'right'
      ? FadeInRight.delay(scaledDelay).springify()
      : FadeInDown.delay(scaledDelay).springify()

  return builder.damping(spring.damping).stiffness(spring.stiffness).mass(spring.mass)
}
