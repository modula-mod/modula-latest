export type DimonCapability =
  | 'dimon:account:read'
  | 'dimon:account:link'
  | 'dimon:transaction:request'
  | 'dimon:transaction:approve'
  | 'dimon:ledger:audit'

export const DIMON_CAPABILITIES: readonly DimonCapability[] = [
  'dimon:account:read',
  'dimon:account:link',
  'dimon:transaction:request',
  'dimon:transaction:approve',
  'dimon:ledger:audit',
] as const
