export type GreenfieldRuntimeCapability = string

const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*(?:[.:][a-z0-9][a-z0-9-]*)+$/

export function isGreenfieldRuntimeCapability(value: unknown): value is GreenfieldRuntimeCapability {
  return typeof value === 'string' && CAPABILITY_PATTERN.test(value) && !value.includes('*')
}

export function assertGreenfieldRuntimeCapability(value: unknown): GreenfieldRuntimeCapability {
  if (isGreenfieldRuntimeCapability(value)) return value
  throw new Error(`Invalid Greenfield runtime capability: ${String(value)}`)
}
