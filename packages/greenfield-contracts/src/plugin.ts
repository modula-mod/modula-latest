import type {GreenfieldExtensionManifest} from './extension.js'

export type GreenfieldPluginHook =
  | 'session.created'
  | 'session.revoked'
  | 'record.beforeWrite'
  | 'record.afterWrite'
  | 'notification.dispatch'
  | 'moderation.evaluate'
  | 'media.process'
  | 'index.update'

export type GreenfieldPluginManifest = GreenfieldExtensionManifest & {
  kind: 'plugin'
  hooks: GreenfieldPluginHook[]
  trustLevel: 'firstParty' | 'partner' | 'community'
}
