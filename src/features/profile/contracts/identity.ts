import type {ProfileVisibility} from '@/features/profile/contracts/profile'

export type IdentityClaimKind =
  | 'email'
  | 'phone'
  | 'domain'
  | 'organisation'
  | 'developer'
  | 'creator'
  | 'professional'
  | 'modulePublisher'

export type IdentityClaimStatus =
  | 'selfDeclared'
  | 'connected'
  | 'verified'

export type IdentityClaim = {
  id: string
  kind: IdentityClaimKind
  label: string
  status: IdentityClaimStatus
  visibility: ProfileVisibility
  issuerLabel?: string
}

export function getIdentityClaimStatusLabel(status: IdentityClaimStatus): string {
  if (status === 'verified') return 'Verified'
  if (status === 'connected') return 'Connected'
  return 'Self-declared'
}
