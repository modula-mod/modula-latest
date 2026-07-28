export const GREENFIELD_ENGINE_KINDS = [
  'declarative-ui',
  'records',
  'actions',
  'functions',
  'automation',
  'ai',
  'media',
  'game',
  'spatial',
  'document',
  'connector',
  'custom-native',
] as const

export type GreenfieldEngineKind = (typeof GREENFIELD_ENGINE_KINDS)[number]

const ENGINE_KIND_SET = new Set<string>(GREENFIELD_ENGINE_KINDS)

export function isGreenfieldEngineKind(value: unknown): value is GreenfieldEngineKind {
  return typeof value === 'string' && ENGINE_KIND_SET.has(value)
}

export function assertGreenfieldEngineKind(value: unknown): GreenfieldEngineKind {
  if (isGreenfieldEngineKind(value)) return value
  throw new Error(`Invalid Greenfield engine kind: ${String(value)}`)
}
