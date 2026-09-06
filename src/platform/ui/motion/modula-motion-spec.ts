import {useReduceMotion} from '@/lib/accessibility'
import type {MotionTokens} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaMotionName =
  | 'sheet.enter'
  | 'sheet.exit'
  | 'drawer.expand'
  | 'drawer.collapse'
  | 'menu.open'
  | 'menu.close'
  | 'button.press'
  | 'list.insert'
  | 'list.remove'
  | 'tab.change'
  | 'navigation.push'
  | 'navigation.pop'

export type ModulaMotionSpec = {
  duration: number
  spring: MotionTokens['springs'][keyof MotionTokens['springs']]
  translateDistance: number
  animateOpacity: boolean
  reduced: boolean
}

function specFor(
  name: ModulaMotionName,
  motion: MotionTokens,
  reduced: boolean,
): ModulaMotionSpec {
  const overlay = name.startsWith('sheet.') || name.startsWith('drawer.')
  const navigation = name.startsWith('navigation.')
  const press = name === 'button.press'
  const selection = name === 'tab.change' || name.startsWith('list.')
  const spring = overlay
    ? name.startsWith('sheet.')
      ? motion.springs.sheet
      : motion.springs.drawer
    : navigation
      ? motion.springs.navigation
      : press
        ? motion.springs.press
        : motion.springs.selection
  return {
    duration: press ? motion.micro : overlay ? motion.overlay : selection ? motion.normal : motion.fast,
    spring,
    translateDistance: reduced ? 0 : overlay ? 24 : navigation ? 12 : 0,
    animateOpacity: !press,
    reduced,
  }
}

/** Resolves every named interaction through the active Reduce Motion token set. */
export function useModulaMotionSpec(name: ModulaMotionName): ModulaMotionSpec {
  const reduceMotion = useReduceMotion()
  const {motion} = useThemeTokens()
  return specFor(name, motion, reduceMotion)
}
