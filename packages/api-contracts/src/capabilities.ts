export type BackendCapability =
  | 'social:read'
  | 'post:create'
  | 'post:update'
  | 'post:delete'
  | 'post:engage'
  | 'attachment:upload'
  | 'profile:update'
  | 'profile:manage'
  | 'profile:customize'
  | 'social:follow'
  | 'social:block'
  | 'social:mute'
  | 'saved:manage'
  | 'module:install'
  | 'module:admin'
  | 'notifications:manage'
  | 'report:create'
  | 'moderation:report'
  | 'moderation:block'
  | 'atproto:connect'
  | 'atproto:publish'
  | 'atproto:import'
  | 'admin:moderation'
  | 'admin:ops'

export const PREVIEW_ACTOR_CAPABILITIES: BackendCapability[] = [
  'social:read',
  'post:create',
  'post:update',
  'post:delete',
  'post:engage',
  'attachment:upload',
  'profile:update',
  'profile:manage',
  'profile:customize',
  'social:follow',
  'social:block',
  'social:mute',
  'saved:manage',
  'module:install',
  'notifications:manage',
  'report:create',
  'moderation:report',
  'moderation:block',
  'atproto:connect',
  'atproto:publish',
  'atproto:import',
]

export const STANDARD_SESSION_CAPABILITIES = PREVIEW_ACTOR_CAPABILITIES

export const ADMIN_SESSION_CAPABILITIES: BackendCapability[] = ['admin:moderation', 'admin:ops', 'module:admin']
