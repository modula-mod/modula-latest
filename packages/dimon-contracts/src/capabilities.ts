export type DimonCapability =
  | 'dimon:account:read'
  | 'dimon:account:link'
  | 'dimon:transaction:request'
  | 'dimon:transaction:approve'
  | 'dimon:ledger:audit'
  | 'dimon:asset:read'
  | 'dimon:asset:mint:request'
  | 'dimon:asset:transfer:request'
  | 'dimon:asset:entitlement:read'

export const DIMON_CAPABILITIES: readonly DimonCapability[] = [
  'dimon:account:read',
  'dimon:account:link',
  'dimon:transaction:request',
  'dimon:transaction:approve',
  'dimon:ledger:audit',
  'dimon:asset:read',
  'dimon:asset:mint:request',
  'dimon:asset:transfer:request',
  'dimon:asset:entitlement:read',
] as const
