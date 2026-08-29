export const MPS_PRODUCT_KINDS = [
  'module',
  'addon',
  'plugin',
  'function',
  'tool',
  'widget',
  'connector',
  'service',
  'engine',
  'game',
  'integration',
  'theme',
] as const

export type MpsProductKind = (typeof MPS_PRODUCT_KINDS)[number]

export const REGISTRY_PRODUCT_KINDS = [
  ...MPS_PRODUCT_KINDS,
] as const

export type RegistryProductKind = (typeof REGISTRY_PRODUCT_KINDS)[number]

export const DEVELOPER_KIND_ALIASES: Record<string, MpsProductKind> = {
  'backend-service': 'service',
  'backend-engine': 'engine',
  'game-module': 'game',
}

export const MPS_TO_DEVELOPER_KIND: Record<MpsProductKind, string> = {
  module: 'module',
  addon: 'addon',
  plugin: 'plugin',
  function: 'function',
  tool: 'tool',
  widget: 'widget',
  connector: 'connector',
  service: 'backend-service',
  engine: 'backend-engine',
  game: 'game-module',
  integration: 'integration',
  theme: 'theme',
}

export const MPS_TO_GREENFIELD_BACKEND_MODE = {
  none: 'frontend-only',
  'greenfield-records': 'greenfield-managed',
  service: 'module-managed',
  'engine-backed': 'greenfield-managed',
} as const

export function isMpsProductKind(value: string): value is MpsProductKind {
  return (MPS_PRODUCT_KINDS as readonly string[]).includes(value)
}

export function registryKindFromDeclared(kind: string): RegistryProductKind {
  const aliased = DEVELOPER_KIND_ALIASES[kind] ?? kind
  if (!isMpsProductKind(aliased)) {
    throw new Error(`Unsupported product kind: ${kind}`)
  }
  return aliased
}

export function developerKindFromMps(kind: MpsProductKind): string {
  return MPS_TO_DEVELOPER_KIND[kind]
}

export function greenfieldBackendModeFromMps(
  mode: 'none' | 'greenfield-records' | 'service' | 'engine-backed',
): (typeof MPS_TO_GREENFIELD_BACKEND_MODE)[typeof mode] {
  return MPS_TO_GREENFIELD_BACKEND_MODE[mode]
}
