export const GREENFIELD_CONNECTOR_KINDS = [
  'identity',
  'email',
  'calendar',
  'contacts',
  'storage',
  'documents',
  'messaging',
  'project-management',
  'source-control',
  'social',
  'crm',
  'commerce',
  'analytics',
  'automation',
  'generic-rest',
  'webhook',
] as const

export type GreenfieldConnectorKind = (typeof GREENFIELD_CONNECTOR_KINDS)[number]

export function isGreenfieldConnectorKind(value: string): value is GreenfieldConnectorKind {
  return (GREENFIELD_CONNECTOR_KINDS as readonly string[]).includes(value)
}
