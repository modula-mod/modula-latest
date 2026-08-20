import type {IdentityClaim} from '@/features/profile/contracts/identity'

export const demoIdentityClaims: Record<string, IdentityClaim[]> = {
  'profile-andrei': [
    {
      id: 'claim-andrei-verified',
      kind: 'organisation',
      label: 'Modula',
      status: 'verified',
      visibility: 'public',
      issuerLabel: 'Demo verification',
    },
    {
      id: 'claim-andrei-domain',
      kind: 'domain',
      label: 'modula.digital',
      status: 'connected',
      visibility: 'public',
      issuerLabel: 'Demo connection',
    },
    {
      id: 'claim-andrei-developer',
      kind: 'developer',
      label: 'Modula builder',
      status: 'selfDeclared',
      visibility: 'public',
    },
    {
      id: 'claim-andrei-professional',
      kind: 'professional',
      label: 'Product and systems work',
      status: 'selfDeclared',
      visibility: 'followers',
    },
  ],
  'profile-gaia': [
    {
      id: 'claim-gaia-developer',
      kind: 'developer',
      label: 'AI systems profile',
      status: 'selfDeclared',
      visibility: 'public',
    },
    {
      id: 'claim-gaia-module-publisher',
      kind: 'modulePublisher',
      label: 'Runtime module publisher',
      status: 'connected',
      visibility: 'public',
      issuerLabel: 'Demo module registry',
    },
  ],
  'profile-design': [
    {
      id: 'claim-design-organisation',
      kind: 'organisation',
      label: 'Modula Design',
      status: 'verified',
      visibility: 'public',
      issuerLabel: 'Demo verification',
    },
    {
      id: 'claim-design-creator',
      kind: 'creator',
      label: 'Interface systems',
      status: 'connected',
      visibility: 'public',
    },
  ],
  'profile-builders': [
    {
      id: 'claim-builders-community',
      kind: 'organisation',
      label: 'Builder community',
      status: 'selfDeclared',
      visibility: 'public',
    },
    {
      id: 'claim-builders-developer',
      kind: 'developer',
      label: 'Module SDK experiments',
      status: 'connected',
      visibility: 'public',
    },
  ],
  'profile-garden': [
    {
      id: 'claim-garden-creator',
      kind: 'creator',
      label: 'Knowledge creator',
      status: 'selfDeclared',
      visibility: 'public',
    },
    {
      id: 'claim-garden-domain',
      kind: 'domain',
      label: 'garden.modula.digital',
      status: 'connected',
      visibility: 'public',
      issuerLabel: 'Demo domain connection',
    },
  ],
}
