import {timingSafeEqual as equal} from 'node:crypto'

export function timingSafeEqualString(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && equal(a, b)
}
