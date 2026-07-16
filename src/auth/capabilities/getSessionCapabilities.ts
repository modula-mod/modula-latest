import type {AuthCapability, SessionState} from '@/auth/contracts'

export function getSessionCapabilities(session: SessionState): Set<AuthCapability> {
  const capabilities = new Set<AuthCapability>(['social:read'])
  if (session.status !== 'signedIn') return capabilities
  capabilities.add('post:create')
  capabilities.add('post:engage')
  capabilities.add('profile:manage')
  capabilities.add('profile:customize')
  capabilities.add('social:follow')
  capabilities.add('saved:manage')
  capabilities.add('messages:access')
  capabilities.add('modules:install')
  capabilities.add('account:manage')
  return capabilities
}
