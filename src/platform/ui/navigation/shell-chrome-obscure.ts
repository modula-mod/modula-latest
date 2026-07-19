import {
  Easing,
  makeMutable,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {PULL_ACTION_ARM_DISTANCE} from '@/platform/ui/refresh/pull-action-types'

/**
 * Shell chrome (tab bar, bottom blur, home header actions) fade progress 0→1.
 * `pull` follows the Home pull gesture; `hold` stays high during refresh / search.
 */
export const shellChromePullObscure: SharedValue<number> = makeMutable(0)
export const shellChromeHoldObscure: SharedValue<number> = makeMutable(0)

const SMOOTH_OUT = Easing.bezier(0.22, 1, 0.36, 1)
const SMOOTH_IN = Easing.bezier(0.4, 0, 0.2, 1)

function smoothstep(t: number): number {
  'worklet'
  const x = Math.min(1, Math.max(0, t))
  return x * x * (3 - 2 * x)
}

/** Call from pull-action worklets while the finger is down. */
export function syncShellChromePullObscure(pullDistance: number): void {
  'worklet'
  // Hide chrome early so the pull stage owns the screen quickly.
  const t = pullDistance / (PULL_ACTION_ARM_DISTANCE * 0.55)
  shellChromePullObscure.value = smoothstep(t)
}

/** Softly clear pull-driven obscure (release / cancel). */
export function releaseShellChromePullObscure(): void {
  'worklet'
  shellChromePullObscure.value = withTiming(0, {
    duration: 480,
    easing: SMOOTH_OUT,
  })
}

/** Keep chrome hidden while refresh animation or search modal is up. */
export function setShellChromeHoldObscure(hold: boolean): void {
  shellChromeHoldObscure.value = withTiming(hold ? 1 : 0, {
    duration: hold ? 320 : 520,
    easing: hold ? SMOOTH_IN : SMOOTH_OUT,
  })
}

export function shellChromeObscureAmount(): number {
  'worklet'
  const pull = shellChromePullObscure.value
  const hold = shellChromeHoldObscure.value
  return pull > hold ? pull : hold
}
