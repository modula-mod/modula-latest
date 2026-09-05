import {controls} from '@/theme/foundations/controls'

/** Minimum comfortable touch target, independent of painted control size. */
export const MODULA_MIN_TOUCH_TARGET = controls.touchTarget.minimum

export function meetsTouchTarget(size: number): boolean {
  return size >= MODULA_MIN_TOUCH_TARGET
}
