export const RESERVED_MODULE_NAMESPACES = [
  'digital.modula',
  'digital.greenfield',
  'digital.dimon',
  'modula',
  'greenfield',
  'dimon',
] as const

export type ReservedModuleNamespace = (typeof RESERVED_MODULE_NAMESPACES)[number]

export const MODULE_ID_MAX_LENGTH = 160
const MODULE_ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/

export function isGreenfieldModuleId(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length < 3 || value.length > MODULE_ID_MAX_LENGTH) return false
  if (!MODULE_ID_PATTERN.test(value)) return false
  return !value.split('.').some(segment => segment.length === 0)
}

export function getNamespacePrefix(moduleId: string): string {
  const parts = moduleId.split('.')
  return parts.length >= 2 ? parts.slice(0, 2).join('.') : moduleId
}

export function usesReservedNamespace(moduleId: string): boolean {
  return RESERVED_MODULE_NAMESPACES.some(namespace => moduleId === namespace || moduleId.startsWith(`${namespace}.`))
}

export function canPublisherUseNamespace(moduleId: string, firstPartyPublisher: boolean): boolean {
  return !usesReservedNamespace(moduleId) || firstPartyPublisher
}

export function assertGreenfieldModuleId(value: string): void {
  if (!isGreenfieldModuleId(value)) {
    throw new Error('Module identifiers must be lowercase reverse-domain IDs without versions')
  }
}
