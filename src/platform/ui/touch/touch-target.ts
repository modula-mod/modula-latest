/** Minimum comfortable touch target (Apple HIG). */
export const MODULA_MIN_TOUCH_TARGET = 44

export function meetsTouchTarget(size: number): boolean {
  return size >= MODULA_MIN_TOUCH_TARGET
}
