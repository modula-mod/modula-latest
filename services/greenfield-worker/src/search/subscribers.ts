import type {GreenfieldSearchEntityType} from '../database.js'

export const SEARCH_PROJECTOR_BY_EVENT: Record<string, {projectorId: string; entityType: GreenfieldSearchEntityType}> = {
  'post.created': {projectorId: 'search.post-projector', entityType: 'post'},
  'post.updated': {projectorId: 'search.post-projector', entityType: 'post'},
  'post.deleted': {projectorId: 'search.post-projector', entityType: 'post'},
  'post.visibility-changed': {projectorId: 'search.post-projector', entityType: 'post'},
  'profile.updated': {projectorId: 'search.profile-projector', entityType: 'profile'},
  'profile.visibility-changed': {projectorId: 'search.profile-projector', entityType: 'profile'},
  'account.deactivated': {projectorId: 'search.profile-projector', entityType: 'profile'},
  'account.deletion-requested': {projectorId: 'search.profile-projector', entityType: 'profile'},
  'module.discovered': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.installed': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.updated': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.quarantined': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.uninstalled': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.health-changed': {projectorId: 'search.module-projector', entityType: 'module'},
  'module.release.imported': {projectorId: 'search.module-release-projector', entityType: 'module-release'},
  'module.release.published': {projectorId: 'search.module-release-projector', entityType: 'module-release'},
  'module.release.quarantined': {projectorId: 'search.module-release-projector', entityType: 'module-release'},
  'module.release.revoked': {projectorId: 'search.module-release-projector', entityType: 'module-release'},
  'module.update-available': {projectorId: 'search.module-release-projector', entityType: 'module-release'},
  'module.record.changed': {projectorId: 'search.module-record-projector', entityType: 'module-record'},
}

export function isSearchOperationalEvent(eventType: string): boolean {
  return eventType.startsWith('search.')
}
