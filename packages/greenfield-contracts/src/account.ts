/**
 * Greenfield account authority types.
 * accountId is a permanent opaque UUIDv7 — not a DID, not email, not an external id.
 */

export type GreenfieldAccountStatus =
  | 'pendingVerification'
  | 'active'
  | 'suspended'
  | 'deactivated'
  | 'deleted'

export type GreenfieldAccount = {
  /** Permanent opaque identifier (UUIDv7). Never changes. */
  accountId: string
  /** Current primary handle; may change over time. */
  primaryHandle: string
  status: GreenfieldAccountStatus
  createdAt: string
  updatedAt: string
}
